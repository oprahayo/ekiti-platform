import type {Client} from 'pg';
import {validateCoordinates} from '../geo/resolve.ts';
import type {Category} from './public-data.ts';

/** An explicit one-off location search, never a GPS-derived subscriber profile. */
export interface NearbySearch {
  latitude:number;longitude:number;confirmed:true;
  category:Category|null;lga:string|null;query:string|null;limit:number;radiusKm:number;
}
export interface NearbyPlace {
  id:string;name:string;category:Category;lga_id:string;
  address_text:string;publisher:string;source_url:string;distance_km:number;
}
export class NearbyQueryError extends Error {
  constructor(){super('Invalid nearby search');this.name='NearbyQueryError';}
}
const allowed=new Set(['latitude','longitude','confirmed','category','lga','q','limit','radiusKm']);
export function parseNearbySearch(raw:string):NearbySearch {
  if(new TextEncoder().encode(raw).byteLength>650)throw new NearbyQueryError();
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new NearbyQueryError();}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new NearbyQueryError();
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(key=>!allowed.has(key))||
    v.confirmed!==true||typeof v.latitude!=='number'||typeof v.longitude!=='number')
    throw new NearbyQueryError();
  try{validateCoordinates(v.latitude,v.longitude);}catch{throw new NearbyQueryError();}
  const category=v.category===undefined||v.category===null?null:v.category;
  if(category!==null&&!['Health','Schools','Offices','Hotels','Other'].includes(String(category)))
    throw new NearbyQueryError();
  const lga=v.lga===undefined||v.lga===null?null:v.lga;
  if(lga!==null&&(typeof lga!=='string'||!/^[a-z0-9][a-z0-9-]{1,63}$/.test(lga)))
    throw new NearbyQueryError();
  const query=v.q===undefined||v.q===null?null:v.q;
  if(query!==null&&(typeof query!=='string'||query.trim().length>100||
    [...query].some(char=>char.codePointAt(0)!<32)))throw new NearbyQueryError();
  const limit=v.limit===undefined?20:v.limit;
  if(!Number.isInteger(limit)||typeof limit!=='number'||limit<1||limit>20)
    throw new NearbyQueryError();
  const radiusKm=v.radiusKm===undefined?25:v.radiusKm;
  if(!Number.isInteger(radiusKm)||typeof radiusKm!=='number'||radiusKm<1||radiusKm>50)
    throw new NearbyQueryError();
  return {latitude:v.latitude,longitude:v.longitude,confirmed:true,
    category:category as Category|null,lga:lga as string|null,
    query:typeof query==='string'?(query.trim()||null):null,limit,radiusKm};
}
export async function searchVerifiedNearby(db:Client,filters:NearbySearch):Promise<NearbyPlace[]> {
  // SECURITY DEFINER function accepts only published, sourced and geocoded
  // entries. All ordering happens in the DB before LIMIT, not on a
  // potentially truncated client-side list.
  const results=await db.query<NearbyPlace>(
    'SELECT * FROM civic.public_places_nearby($1,$2,$3,$4,$5,$6,$7)',[
      filters.latitude,filters.longitude,filters.category,
      filters.lga,filters.query,filters.radiusKm,filters.limit,
    ]);
  return results.rows;
}
