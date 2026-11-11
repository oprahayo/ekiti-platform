/**
 * Optional, privacy-conscious web discovery through a configured search API.
 * Results are external references, NEVER reviewed civic knowledge or AI facts.
 * The Worker contacts a single fixed upstream; URL results are displayed as links,
 * never fetched/crawled by our Worker.
 */
export interface ExternalWebResult {
  title: string;
  description: string;
  url: string;
  domain: string;
}
export interface ExternalWebResultSet {
  query: string;
  scope: 'ekiti-public-web';
  provider: 'Brave Search';
  verifiedByEkitiCivic: false;
  results: ExternalWebResult[];
}
export class ExternalQueryError extends Error {}
export class ExternalProviderError extends Error {}

const sensitiveText=/\b(i (want|need|would like) to report|my report|report an incident|submit (my|a) (report|complaint)|file a complaint|my phone|my address|my name|confidential|private case|witnessed an emergency)\b/i;

export function parseExternalQuery(params:URLSearchParams):string {
  if(params.getAll('q').length!==1||[...params.keys()].some(key=>key!=='q'))
    throw new ExternalQueryError();
  const query=(params.get('q')||'').trim().replace(/\s+/gu,' ');
  if(query.length<2||query.length>90 ||
    /[\p{Cc}\p{Cf}]/u.test(query) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(query) ||
    /\+?[0-9][\d ()-]{7,}[0-9]/u.test(query) || sensitiveText.test(query))
    throw new ExternalQueryError();
  return query;
}
function verifiedWebUrl(value:unknown):string|null {
  if(typeof value!=='string'||value.length>2000)return null;
  try {
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||
      url.hostname==='localhost'||url.hostname.endsWith('.local'))return null;
    return url.href;
  } catch{return null;}
}
function textValue(value:unknown,max:number):string {
  return typeof value==='string'?
    value.replace(/<[^>]*>/g,' ').replace(/\s+/gu,' ').trim().slice(0,max):'';
}
async function readCappedJson(response:Response):Promise<unknown> {
  if(response.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')
    throw new ExternalProviderError('Unsupported search response');
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>180_000)throw new ExternalProviderError('Search response too large');
  if(!response.body)throw new ExternalProviderError('Empty search response');
  let bytes=0, raw='';
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  while(true) {
    const {done,value}=await reader.read();
    if(done)break;
    bytes+=value.byteLength;
    if(bytes>180_000){await reader.cancel();throw new ExternalProviderError('Search response too large');}
    raw+=decoder.decode(value,{stream:true});
  }
  try{return JSON.parse(raw+decoder.decode()) as unknown;}
  catch{throw new ExternalProviderError('Malformed search response');}
}
export async function fetchEkitiWebResults(
  query:string,
  key:string,
  fetchImpl:typeof fetch=fetch,
):Promise<ExternalWebResultSet> {
  if(!key.trim())throw new ExternalProviderError('Web search unavailable');
  const url=new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q',/\bekiti\b/i.test(query)?query:'Ekiti State Nigeria '+query);
  url.searchParams.set('count','8');
  url.searchParams.set('country','NG');
  url.searchParams.set('search_lang','en');
  url.searchParams.set('safesearch','strict');
  let response:Response;
  try{
    response=await fetchImpl(url.toString(),{
      method:'GET',
      headers:{Accept:'application/json','X-Subscription-Token':key},
      redirect:'error',signal:AbortSignal.timeout(7000),
    });
  }catch{throw new ExternalProviderError('Search provider unavailable');}
  if(!response.ok)throw new ExternalProviderError('Search provider unavailable');
  const raw=await readCappedJson(response);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    throw new ExternalProviderError('Unexpected search response');
  const results=(raw as {web?:{results?:unknown}}).web?.results;
  if(!Array.isArray(results))throw new ExternalProviderError('Unexpected search response');
  const seen=new Set<string>();
  const safe:ExternalWebResult[]=[];
  for(const result of results.slice(0,16)){
    if(!result||typeof result!=='object')continue;
    const entry=result as Record<string,unknown>;
    const verified=verifiedWebUrl(entry.url);
    if(!verified)continue;
    const canonical=new URL(verified);
    const title=textValue(entry.title,160);
    if(!title||seen.has(verified))continue;
    seen.add(verified);
    safe.push({
      title,description:textValue(entry.description,360),
      url:verified,domain:canonical.hostname,
    });
    if(safe.length===8)break;
  }
  return {
    query,scope:'ekiti-public-web',provider:'Brave Search',
    verifiedByEkitiCivic:false,results:safe,
  };
}
