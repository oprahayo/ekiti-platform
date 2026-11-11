export interface PublicDirectoryPin {
  id:string;name:string;category:string;lga:string;
  latitude:number;longitude:number;
}
export function parseReviewedMapPins(payload:unknown,areas:ReadonlyMap<string,string>):
  PublicDirectoryPin[]{
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Unverified directory data');
  const raw=payload as Record<string,unknown>;
  if(raw.reviewedOnly!==true||!Array.isArray(raw.items)||raw.items.length>25)
    throw Error('No reviewed directory source');
  const ids=new Set<string>();
  return raw.items.flatMap(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))return [];
    const p=item as Record<string,unknown>;
    if(typeof p.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id)||
      ids.has(p.id))return [];
    ids.add(p.id);
    if(typeof p.name!=='string'||!p.name.trim()||p.name.length>120||
      typeof p.category!=='string'||!p.category.trim()||p.category.length>100||
      typeof p.lga_id!=='string'||!areas.has(p.lga_id)||
      typeof p.publisher!=='string'||!p.publisher.trim()||
      typeof p.reviewed_at!=='string'||!Number.isFinite(Date.parse(p.reviewed_at)))
      return [];
    // Coordinates may legitimately be absent. Never infer them from an
    // address, LGA centroid, IP or fictional place.
    const lat=p.latitude,lon=p.longitude;
    if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||
      !Number.isFinite(lon)||lat<7.1||lat>8.3||lon<4.6||lon>6.0)
      return [];
    return [{
      id:p.id,name:p.name,category:p.category,lga:areas.get(p.lga_id)!,
      latitude:lat,longitude:lon,
    }];
  });
}
