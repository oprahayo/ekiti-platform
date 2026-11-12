#!/usr/bin/env node
/**
 * Reproducible, operator-run GRID3 settlement-source staging.
 *
 * Usage:
 *   node scripts/import-grid3-settlements.mjs fetch
 *   node scripts/import-grid3-settlements.mjs prepare --sha256 <sha printed by fetch>
 *
 * All raw/processed data stay in ignored data/review/grid3-settlements/.
 * This never imports into production, Supabase or the public frontend.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {
  SOURCE_ITEM_ID,SOURCE_LAYER_URL,SOURCE_ATTRIBUTION,
  buildSettlementReview,
} from './grid3-settlement-core.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const outputDir=join(root,'data/review/grid3-settlements');
const sourcePath=join(outputDir,'ekiti-settlement-names-raw.geojson');
const PAGE_SIZE=1000, MAX_PAGES=100;
const OUT_FIELDS='FID,set_id,set_name,set_altnam,is_primary,lganame,lgacode,statename,statecode';
const WHERE="statename = 'Ekiti'";
const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const textJson=(obj)=>JSON.stringify(obj,null,2)+'\n';

async function arcgisQuery(fields){
  const url=new URL(SOURCE_LAYER_URL+'/query');
  for(const [k,v] of Object.entries(fields))url.searchParams.set(k,String(v));
  const response=await fetch(url,{method:'GET',headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('GRID3 server HTTP '+response.status);
  const size=Number(response.headers.get('content-length')||'0');
  if(size>10_000_000)throw new Error('GRID3 response exceeds page byte cap');
  const body=await response.text();
  if(body.length>10_000_000)throw new Error('GRID3 response exceeds page byte cap');
  let data;
  try{data=JSON.parse(body)}catch{throw new Error('GRID3 did not return JSON');}
  if(data?.error)throw new Error('GRID3 ArcGIS query error '+String(data.error.code||'unknown'));
  return data;
}

async function fetchSnapshot(){
  const count=await arcgisQuery({where:WHERE,returnCountOnly:'true',f:'json'});
  if(!Number.isSafeInteger(count.count)||count.count<1||count.count>100_000)
    throw new Error('Source state-filter count is unavailable or unreasonable');
  const all=[],seen=new Set();
  for(let offset=0;offset<count.count;offset+=PAGE_SIZE){
    if(offset/PAGE_SIZE>=MAX_PAGES)throw new Error('Refusing unbounded pagination');
    const response=await arcgisQuery({
      where:WHERE,outFields:OUT_FIELDS,
      orderByFields:'FID ASC',returnGeometry:'true',outSR:4326,
      resultOffset:offset,resultRecordCount:PAGE_SIZE,f:'geojson',
    });
    if(response.type!=='FeatureCollection'||!Array.isArray(response.features))
      throw new Error('Source returned an unexpected page shape');
    const requested=Math.min(PAGE_SIZE,count.count-offset);
    if(response.features.length!==requested)
      throw new Error('Incomplete or changing source: page at '+offset);
    for(const f of response.features){
      const id=f?.properties?.FID ?? f?.id;
      if(!Number.isSafeInteger(id)||seen.has(id))
        throw new Error('Unstable or duplicate FID in source page '+offset);
      seen.add(id);all.push(f);
    }
  }
  if(all.length!==count.count)throw new Error('Incomplete source snapshot');
  all.sort((a,b)=>(a.properties.FID ?? a.id)-(b.properties.FID ?? b.id));
  const raw=Buffer.from(textJson({type:'FeatureCollection',features:all}),'utf8');
  if(raw.byteLength>90_000_000)throw new Error('Source snapshot unexpectedly large');
  await mkdir(outputDir,{recursive:true});
  await writeFile(sourcePath,raw,{flag:'wx'}).catch(async error=>{
    if(error?.code==='EEXIST')
      throw new Error('Snapshot exists. Move it aside explicitly before fetching a new revision.');
    throw error;
  });
  const hash=sha256(raw);
  const metadata={
    status:'unreviewed-raw-snapshot',sourceItemId:SOURCE_ITEM_ID,
    sourceLayer:SOURCE_LAYER_URL,query:WHERE,sourceCount:count.count,
    downloadedAt:new Date().toISOString(),sha256:hash,bytes:raw.byteLength,
    license:'CC BY 4.0',attribution:SOURCE_ATTRIBUTION,
  };
  await writeFile(join(outputDir,'download-manifest.json'),textJson(metadata),{flag:'wx'});
  process.stdout.write('Saved unreviewed GRID3 snapshot: '+sourcePath+'\n');
  process.stdout.write('SHA-256: '+hash+'\n');
  process.stdout.write('Review the snapshot and pin its hash before prepare.\n');
}

async function prepareSnapshot(expectedHash){
  if(!/^[0-9a-f]{64}$/i.test(expectedHash||''))
    throw new Error('prepare requires --sha256 <64-character reviewed snapshot digest>');
  const raw=await readFile(sourcePath);
  if(raw.byteLength>90_000_000)throw new Error('Raw file exceeds safety cap');
  const hash=sha256(raw);
  if(hash.toLowerCase()!==expectedHash.toLowerCase())
    throw new Error('Pinned SHA-256 mismatch: refusing to process changed raw data');
  const metadata=JSON.parse(await readFile(join(outputDir,'download-manifest.json'),'utf8'));
  if(metadata.sourceItemId!==SOURCE_ITEM_ID||metadata.sourceLayer!==SOURCE_LAYER_URL||
    metadata.sha256!==hash)throw new Error('Source metadata is missing or inconsistent');
  const rawCollection=JSON.parse(raw.toString('utf8'));
  if(rawCollection.features.length!==metadata.sourceCount)
    throw new Error('Raw snapshot count differs from source metadata');
  const boundaries=JSON.parse(await readFile(join(root,'data/grid3/lga.json'),'utf8'));
  const result=buildSettlementReview(rawCollection,boundaries);
  if(result.audit.sourceFeatureCount!==metadata.sourceCount)
    throw new Error('Source count differs from validation report');
  if(result.audit.coveredLgas!==16)
    throw new Error('Incomplete Ekiti LGA candidate coverage; refuse export');
  if(result.audit.candidateCount<1)throw new Error('No accepted review candidates');
  const audit={
    ...result.audit,
    rawSha256:hash,
    downloadedAt:metadata.downloadedAt,
    generatedAt:new Date().toISOString(),
    boundaryData:'data/grid3/lga.json',
    publicationAllowed:false,
    reviewRequired:true,
    attribution:SOURCE_ATTRIBUTION,
  };
  await writeFile(join(outputDir,'candidate-points.review-only.geojson'),
    textJson(result.candidates));
  await writeFile(join(outputDir,'quarantine.review-only.json'),
    textJson(result.quarantine));
  await writeFile(join(outputDir,'audit.review-only.json'),textJson(audit));
  process.stdout.write(textJson({
    status:'review-only',candidateCount:audit.candidateCount,
    quarantinedCount:audit.quarantinedCount,coveredLgas:audit.coveredLgas,
    rawSha256:hash,outputDir,
  }));
}

const [command,...args]=process.argv.slice(2);
if(!['fetch','prepare'].includes(command)){
  process.stderr.write('Usage: node scripts/import-grid3-settlements.mjs fetch | prepare --sha256 <SHA>\n');
  process.exitCode=2;
}else{
  try{
    if(command==='fetch'){
      if(args.length)throw new Error('fetch accepts no extra options');
      await fetchSnapshot();
    }else{
      if(args.length!==2||args[0]!=='--sha256')
        throw new Error('prepare requires only --sha256 <SHA>');
      await prepareSnapshot(args[1]);
    }
  }catch(error){
    process.stderr.write(String(error?.message||error)+'\n');
    process.exitCode=1;
  }
}
