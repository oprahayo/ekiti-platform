/**
 * Offline-only GRID3 named-settlement candidate validation.
 *
 * Never imported by the public Worker or frontend. Nothing here can publish a
 * location to civic.public_places or a public map. The output is a REVIEW QUEUE.
 */
export const SOURCE_ITEM_ID = '73d8522d1c4d4c75be6c10fa790c685c';
export const SOURCE_LAYER_URL =
  'https://services3.arcgis.com/BU6Aadhn6tbBEdyk/ArcGIS/rest/services/Settlements_in_Nigeria/FeatureServer/0';
export const SOURCE_ATTRIBUTION =
  'eHealth Africa, Proxy Logics, and Oak Ridge National Laboratory (ORNL). 2020. Settlement Points in Nigeria. GRID3. CC BY 4.0.';

const LGA_IDS = Object.freeze({
  adoekiti:'ado-ekiti', efon:'efon', ekitieast:'ekiti-east',
  ekitisouthwest:'ekiti-south-west', ekitiwest:'ekiti-west',
  emure:'emure', gbonyin:'gbonyin', idoosi:'ido-osi', ijero:'ijero',
  ikere:'ikere', ikole:'ikole', ilejemeje:'ilejemeje',
  irepodunifelodun:'irepodun-ifelodun', iseorun:'ise-orun',
  moba:'moba', oye:'oye',
});
export const EXPECTED_LGA_COUNT = 16;
export const normalizeArea = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]/g,'');

export function pointOnSegment([x,y],[ax,ay],[bx,by]) {
  const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
  if(Math.abs(cross)>1e-10)return false;
  return x>=Math.min(ax,bx)-1e-10&&x<=Math.max(ax,bx)+1e-10&&
    y>=Math.min(ay,by)-1e-10&&y<=Math.max(ay,by)+1e-10;
}

/** Returns inside, outside, or border. Handles rings with either winding. */
export function pointInRing(point,ring) {
  if(!Array.isArray(ring)||ring.length<4)return 'outside';
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2)
      throw new Error('Invalid boundary polygon vertex');
    if(pointOnSegment(point,a,b))return 'border';
    if((a[1]>point[1])!==(b[1]>point[1])){
      const x=a[0]+(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1]);
      if(point[0]<x)inside=!inside;
    }
  }
  return inside?'inside':'outside';
}

export function pointInPolygon(point,rings){
  if(!Array.isArray(rings)||!rings.length)return 'outside';
  const outer=pointInRing(point,rings[0]);
  if(outer!=='inside')return outer;
  for(const hole of rings.slice(1)){
    const within=pointInRing(point,hole);
    if(within==='border')return 'border';
    if(within==='inside')return 'outside';
  }
  return 'inside';
}

export function pointInGeometry(point,geometry){
  if(!geometry || !['Polygon','MultiPolygon'].includes(geometry.type))
    throw new Error('Expected Polygon or MultiPolygon LGA boundary');
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  let sawBorder=false;
  for(const rings of polygons){
    const result=pointInPolygon(point,rings);
    if(result==='inside')return 'inside';
    if(result==='border')sawBorder=true;
  }
  return sawBorder?'border':'outside';
}

export function validatedLgaIndex(boundaries){
  if(boundaries?.type!=='FeatureCollection'||!Array.isArray(boundaries.features)
    ||boundaries.features.length!==EXPECTED_LGA_COUNT)
    throw new Error('Expected exactly 16 pinned GRID3 Ekiti LGA polygons');
  const seen=new Set();
  const result=boundaries.features.map(feature=>{
    const label=feature?.properties?.lganame;
    const slug=LGA_IDS[normalizeArea(label)];
    if(feature?.properties?.statename!=='Ekiti'||!slug||seen.has(slug))
      throw new Error('Missing, duplicated or unexpected Ekiti LGA: '+String(label));
    seen.add(slug);
    if(!feature.geometry||!['Polygon','MultiPolygon'].includes(feature.geometry.type))
      throw new Error('Missing polygon for '+slug);
    return {id:slug,name:label,geometry:feature.geometry};
  });
  if(seen.size!==EXPECTED_LGA_COUNT)throw new Error('Incomplete LGA index');
  return result;
}

function cleanText(value,max=158){
  if(typeof value!=='string')return '';
  return value.normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,max);
}
function altNames(value,primary){
  const parts=cleanText(value,150).split(/[;|]/).map(s=>s.trim()).filter(Boolean);
  const seen=new Set([normalizeArea(primary)]);
  return parts.filter(s=>{
    const key=normalizeArea(s);
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,8);
}

/** Review queue only. Duplicate names and boundary/mismatched locations are
 * retained in the quarantine report, never silently reassigned. */
export function buildSettlementReview(raw,boundaries){
  const lgas=validatedLgaIndex(boundaries);
  if(raw?.type!=='FeatureCollection'||!Array.isArray(raw.features))
    throw new Error('GRID3 source must be a GeoJSON FeatureCollection');
  const candidates=[],quarantine=[],seenIds=new Set(),names=new Map();
  const reject=(id,reason)=>{quarantine.push({sourceId:id,reason});};
  for(const feature of raw.features){
    const attrs=feature?.properties||{};
    const rawId=attrs.FID;
    const id=Number.isSafeInteger(rawId)&&rawId>=0?String(rawId):'';
    if(!id){reject(null,'missing-source-object-id');continue;}
    if(seenIds.has(id)){reject(id,'duplicate-source-object-id');continue;}
    seenIds.add(id);
    if(normalizeArea(attrs.statename)!=='ekiti'){
      reject(id,'source-state-not-ekiti');continue;
    }
    const name=cleanText(attrs.set_name);
    if(!name){reject(id,'missing-settlement-name');continue;}
    const coordinates=feature?.geometry?.coordinates;
    if(feature?.geometry?.type!=='Point'||!Array.isArray(coordinates)||
      coordinates.length!==2||coordinates.some(x=>typeof x!=='number'||!Number.isFinite(x))||
      coordinates[0]<4.7||coordinates[0]>5.95||
      coordinates[1]<7.15||coordinates[1]>8.25){
      reject(id,'invalid-or-out-of-range-point');continue;
    }
    const inside=[],boundary=[];
    for(const lga of lgas){
      const v=pointInGeometry(coordinates,lga.geometry);
      if(v==='inside')inside.push(lga);
      if(v==='border')boundary.push(lga);
    }
    if(boundary.length||inside.length!==1){
      reject(id,boundary.length?'boundary-requires-review':
        inside.length===0?'outside-ekiti-polygons':'overlapping-lga-polygons');
      continue;
    }
    const lga=inside[0];
    if(normalizeArea(attrs.lganame)!==normalizeArea(lga.name)){
      reject(id,'source-lga-disagrees-with-polygon');continue;
    }
    const sourceId=cleanText(attrs.set_id,16);
    const aliases=altNames(attrs.set_altnam,name);
    const candidate={
      type:'Feature',
      geometry:{type:'Point',coordinates:[coordinates[0],coordinates[1]]},
      properties:{
        sourceObjectId:id,sourceSetId:sourceId||null,
        name,aliases,lgaId:lga.id,lgaName:lga.name,
        sourceItemId:SOURCE_ITEM_ID,reviewStatus:'pending-human-review',
      },
    };
    candidates.push(candidate);
    const collisionKey=lga.id+'|'+normalizeArea(name);
    const existing=names.get(collisionKey)||[];
    existing.push(id);names.set(collisionKey,existing);
  }
  const collisions=[...names.entries()].filter(([,ids])=>ids.length>1);
  const ambiguousIds=new Set(collisions.flatMap(([,ids])=>ids));
  const final=candidates.filter(x=>!ambiguousIds.has(x.properties.sourceObjectId))
    .sort((a,b)=>Number(a.properties.sourceObjectId)-Number(b.properties.sourceObjectId));
  for(const id of ambiguousIds)reject(id,'same-name-in-lga-requires-review');
  quarantine.sort((a,b)=>String(a.sourceId).localeCompare(String(b.sourceId)));
  const perLga=Object.fromEntries(lgas.map(x=>[x.id,0]));
  for(const item of final)perLga[item.properties.lgaId]++;
  return {
    candidates:{type:'FeatureCollection',features:final},
    quarantine,
    audit:{
      sourceFeatureCount:raw.features.length,
      candidateCount:final.length,
      quarantinedCount:quarantine.length,
      duplicateNameGroups:collisions.length,
      coveredLgas:Object.values(perLga).filter(n=>n>0).length,
      perLga,
      source:SOURCE_LAYER_URL,sourceItemId:SOURCE_ITEM_ID,
      license:'CC BY 4.0',
      status:'unreviewed-candidates-only',
    },
  };
}
