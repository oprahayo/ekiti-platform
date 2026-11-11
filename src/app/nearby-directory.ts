import {acquireDevicePosition,PositionError} from './verified-location.ts';
import {lgas} from './fixtures.ts';

export type ReviewedGroup='Health'|'Schools'|'Offices'|'Hotels'|'Other';
export interface NearbyListing {
  id:string;name:string;category:ReviewedGroup;lga_id:string;
  address_text:string;publisher:string;source_url:string;distance_km:number;
}
export interface NearbyResponse {
  items:NearbyListing[];reviewedOnly:true;order:'distance';
  status:'ready'|'outside_ekiti'|'uncertain_coverage';radiusKm:number;
}
export class NearbyDirectoryError extends Error {
  readonly reason:'denied'|'unavailable';
  constructor(reason:'denied'|'unavailable'){super(reason);this.name='NearbyDirectoryError';this.reason=reason;}
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const categories=['Health','Schools','Offices','Hotels','Other'];
export function validateNearbyResponse(raw:unknown,radiusKm:number):NearbyResponse {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    throw new NearbyDirectoryError('unavailable');
  const result=raw as Record<string,unknown>;
  if(result.reviewedOnly!==true||result.order!=='distance'||result.radiusKm!==radiusKm||
    !['ready','outside_ekiti','uncertain_coverage'].includes(String(result.status))||
    !Array.isArray(result.items)||result.items.length>20)
    throw new NearbyDirectoryError('unavailable');
  const seen=new Set<string>();let previous=-1;
  const items:NearbyListing[]=[];
  for(const item of result.items){
    if(!item||typeof item!=='object'||Array.isArray(item))
      throw new NearbyDirectoryError('unavailable');
    const v=item as Record<string,unknown>;
    if(typeof v.id!=='string'||!uuid.test(v.id)||seen.has(v.id)||
      typeof v.name!=='string'||!v.name.trim()||v.name.length>180||
      !categories.includes(String(v.category))||
      typeof v.lga_id!=='string'||!lgas.some(area=>area.id===v.lga_id)||
      typeof v.publisher!=='string'||!v.publisher.trim()||v.publisher.length>160||
      typeof v.address_text!=='string'||v.address_text.length>280||
      typeof v.source_url!=='string'||!/^https:\/\/[^\s]+$/u.test(v.source_url)||
      typeof v.distance_km!=='number'||!Number.isFinite(v.distance_km)||
      v.distance_km<0||v.distance_km>radiusKm||v.distance_km<previous)
      throw new NearbyDirectoryError('unavailable');
    previous=v.distance_km;seen.add(v.id);
    items.push({
      id:v.id,name:v.name,category:v.category as ReviewedGroup,lga_id:v.lga_id,
      address_text:v.address_text,publisher:v.publisher,source_url:v.source_url,
      distance_km:v.distance_km,
    });
  }
  if(result.status!=='ready'&&items.length)
    throw new NearbyDirectoryError('unavailable');
  return {items,reviewedOnly:true,order:'distance',
    status:result.status as NearbyResponse['status'],radiusKm};
}

export interface NearbyOptions {
  category:ReviewedGroup|null;lga:string|null;query:string|null;radiusKm:number;
}
export async function requestNearbyPlaces(
  options:NearbyOptions,
  provider:Geolocation|undefined,
  secure:boolean,
  fetcher:typeof fetch,
  signal?:AbortSignal,
):Promise<NearbyResponse> {
  let point:{latitude:number;longitude:number};
  try{point=await acquireDevicePosition(provider,secure);}
  catch(error){
    if(error instanceof PositionError&&error.reason==='denied')
      throw new NearbyDirectoryError('denied');
    throw new NearbyDirectoryError('unavailable');
  }
  if(signal?.aborted)throw new NearbyDirectoryError('unavailable');
  try{
    const response=await fetcher('/api/places/nearby',{
      method:'POST',signal,cache:'no-store',referrerPolicy:'no-referrer',
      credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        latitude:point.latitude,longitude:point.longitude,confirmed:true,
        category:options.category,lga:options.lga,q:options.query,
        radiusKm:options.radiusKm,limit:20,
      }),
    });
    if(!response.ok)throw new NearbyDirectoryError('unavailable');
    return validateNearbyResponse(await response.json(),options.radiusKm);
  }catch{throw new NearbyDirectoryError('unavailable');}
}
