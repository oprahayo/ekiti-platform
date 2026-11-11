/**
 * Sprint 07 shared, explicitly-invoked geolocation boundary helper.
 * There is NO location request on import or mount, and no persistent storage.
 * Coordinates are sent solely to the verified /api/resolve endpoint after
 * a resident's direct choice; no raw coordinate is retained in a draft.
 */
import {validateCoordinates} from '../geo/resolve.ts';

export interface PositionCoordinates {latitude:number;longitude:number;}
export type PositionFailure='denied'|'unavailable';
export class PositionError extends Error {
  readonly reason:PositionFailure;
  constructor(reason:PositionFailure){super(reason);this.name='PositionError';this.reason=reason;}
}
export interface PositionProvider {
  getCurrentPosition(
    success:(position:GeolocationPosition)=>void,
    error?:(error:GeolocationPositionError)=>void,
    options?:PositionOptions
  ):void;
}
export async function acquireDevicePosition(
  provider:PositionProvider|undefined,secureContext:boolean,
):Promise<PositionCoordinates>{
  if(!secureContext||!provider)throw new PositionError('unavailable');
  let position:GeolocationPosition;
  try{
    position=await new Promise<GeolocationPosition>((resolve,reject)=>{
      provider.getCurrentPosition(resolve,reject,{
        enableHighAccuracy:true,timeout:12000,maximumAge:0,
      });
    });
  }catch(error){
    throw new PositionError((error as {code?:number}|null)?.code===1?'denied':'unavailable');
  }
  const point={latitude:position.coords.latitude,longitude:position.coords.longitude};
  try {validateCoordinates(point.latitude,point.longitude);}
  catch {throw new PositionError('unavailable');}
  return point;
}

export type ResolutionTransport=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
export interface LocationServerResult {
  stateBoundaryStatus?:string;
  stateOnBoundary?:boolean;
  consistency?:string;
  requiresConfirmation?:boolean;
  lga?:{status?:string;match?:{id?:string;name?:string;onBoundary?:boolean}|null;
    candidates?:readonly {id?:string;name?:string}[]};
  ward?:{status?:string;match?:{id?:string;name?:string;parentId?:string;onBoundary?:boolean}|null};
}
/** Bounded request with no URL parameters, referrer, cache or analytics fields. */
export async function resolveVerifiedPoint(
  point:PositionCoordinates,send:ResolutionTransport,
):Promise<LocationServerResult>{
  validateCoordinates(point.latitude,point.longitude);
  const response=await send('/api/resolve',{
    method:'POST',cache:'no-store',referrerPolicy:'no-referrer',
    credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...point,confirmed:true}),
  });
  if(!response.ok)throw new PositionError('unavailable');
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    throw new PositionError('unavailable');
  return raw as LocationServerResult;
}

export type IncidentCoverage =
  | {status:'suggested';lgaId:string;lgaName:string;wardName?:string;requiresConfirmation:true}
  | {status:'ambiguous';candidates:readonly {id:string;name:string}[]}
  | {status:'outside'|'unmapped'|'conflict';candidates:readonly []};

function areaName(value:unknown):string|null {
  if(typeof value!=='string'||value.length<1||value.length>100||
    /[\u0000-\u001f<>]/u.test(value))return null;
  return value;
}
/** Fail closed; LGA or ward precision is never invented from a name. */
export function assessIncidentCoverage(
  input:LocationServerResult,validLgaIds:readonly string[],
):IncidentCoverage {
  if(input.stateBoundaryStatus==='outside')
    return {status:'outside',candidates:[]};
  if(input.stateBoundaryStatus!=='inside')
    return {status:'unmapped',candidates:[]};
  if(input.consistency==='conflict')
    return {status:'conflict',candidates:[]};
  if(input.lga?.status==='ambiguous'){
    const seen=new Set<string>();
    const options=(input.lga.candidates??[]).flatMap(candidate=>{
      const id=candidate?.id,name=areaName(candidate?.name);
      if(typeof id!=='string'||!validLgaIds.includes(id)||!name||seen.has(id))return [];
      seen.add(id);return [{id,name}];
    });
    return {status:'ambiguous',candidates:options.slice(0,16)};
  }
  const lga=input.lga?.match;
  if(input.lga?.status!=='matched'||typeof lga?.id!=='string'||
    !validLgaIds.includes(lga.id)||!areaName(lga.name))
    return {status:'unmapped',candidates:[]};
  // Only a verified ward consistent with the matched LGA may be shown,
  // and even that remains an unpersisted informational suggestion.
  const ward=input.ward?.match;
  const wardName=input.consistency==='consistent'&&input.ward?.status==='matched'&&
    ward?.parentId===lga.id&&!ward.onBoundary&&
    !input.stateOnBoundary&&!lga.onBoundary ? areaName(ward?.name):null;
  return {status:'suggested',lgaId:lga.id,lgaName:lga.name!,
    ...(wardName?{wardName}:{}),requiresConfirmation:true};
}

/** Short decimal coordinate input only; never accept malformed or over-precise values. */
export function parseManualPoint(latitude:string,longitude:string):PositionCoordinates|null{
  const pattern=/^-?(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,6})?$/u;
  const lat=latitude.trim(),lon=longitude.trim();
  if(!pattern.test(lat)||!pattern.test(lon))return null;
  const point={latitude:Number(lat),longitude:Number(lon)};
  try{validateCoordinates(point.latitude,point.longitude);return point;}
  catch{return null;}
}
