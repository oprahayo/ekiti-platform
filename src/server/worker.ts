import pg from 'pg';
import {parseExternalQuery,fetchEkitiWebResults,ExternalQueryError} from './external-web-search.ts';
import { parseUnifiedSearch, searchReviewedEkiti, type UnifiedSearchFilters } from './unified-search.ts';
import { handlePrivateReporting, type PrivateReportingEnv } from './private-report-routes.ts';
import {handlePrivateEvidence,type EvidenceEnvironment} from './private-evidence-routes.ts';
import { resolveIncidentLocation } from './location.ts';
import { answerQuestion } from './ask.ts';
import {
  PublicQueryError, parseDirectoryFilters, parseKnowledgeFilters, parsePublicPlaceId,
  searchKnowledge, searchPlaces, getPlace, type DirectoryFilters, type KnowledgeFilters,
} from './public-data.ts';
import { parsePublicReviews, publicReviews, type ReviewFilters } from './reviews.ts';
import {parseNearbySearch,searchVerifiedNearby,NearbyQueryError, type NearbySearch} from './nearby-places.ts';

interface Env extends PrivateReportingEnv, EvidenceEnvironment {
  HYPERDRIVE: { connectionString: string };
  LOCATION_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
  NEARBY_DIRECTORY_ENABLED?:string;
  NEARBY_DIRECTORY_REVIEWED?:string;
  EXTERNAL_WEB_SEARCH_ENABLED?:string;
  BRAVE_SEARCH_API_KEY?:string;
}

function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

async function readPoint(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  const point = JSON.parse(text + decoder.decode());
  if (
    !point ||
    point.confirmed !== true ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  )
    return null;
  return { latitude: point.latitude as number, longitude: point.longitude as number };
}


async function readNearbyBody(request:Request):Promise<string|null>{
  if(request.headers.get('Content-Type')?.split(';')[0]?.trim()!=='application/json')
    return null;
  const length=request.headers.get('Content-Length');
  if(length!==null&&(!/^\\d+$/.test(length)||Number(length)>650))return null;
  if(!request.body)return null;
  const reader=request.body.getReader();
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let raw='',bytes=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>650){await reader.cancel();return null;}
      raw+=decoder.decode(value,{stream:true});
    }
    return raw+decoder.decode();
  }catch{return null;}
}

async function readAsk(request: Request): Promise<{ question: string; language: 'en' | 'yo' } | null> {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 1500) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1500) { await reader.cancel(); return null; }
    text += decoder.decode(value, { stream: true });
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text + decoder.decode()); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== 'question' && key !== 'language')) return null;
  if (typeof value.question !== 'string' || value.question.trim().length < 2 || value.question.trim().length > 400 ||
      Array.from(value.question).some(character => character.charCodeAt(0) < 32)) return null;
  if (value.language !== 'en' && value.language !== 'yo') return null;
  return { question: value.question.trim(), language: value.language };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/reports' || url.pathname === '/api/tracking') {
      return handlePrivateReporting(request, env);
    }
    if (url.pathname === '/api/evidence/sessions' || url.pathname.startsWith('/api/evidence/sessions/')) {
      return handlePrivateEvidence(request,env);
    }
    const directory = url.pathname === '/api/areas';
    const ask = url.pathname === '/api/ask';
    const knowledge = url.pathname === '/api/knowledge';
    const unifiedSearch = url.pathname === '/api/search';
    const externalWeb = url.pathname === '/api/web-search';
    const places = url.pathname === '/api/places';
    const nearby = url.pathname === '/api/places/nearby';
    if(nearby&&(env.NEARBY_DIRECTORY_ENABLED!=='true'||env.NEARBY_DIRECTORY_REVIEWED!=='true'))
      return json({error:'Unknown route'},404);
    const reviews = url.pathname.startsWith('/api/places/') && url.pathname.endsWith('/reviews');
    const place = url.pathname.startsWith('/api/places/') && !reviews && !nearby;
    const isPublicData = knowledge || places || place || reviews || nearby || unifiedSearch || externalWeb;
    if ((!directory && !ask && !isPublicData && url.pathname !== '/api/resolve') ||
      ((!isPublicData || nearby) && url.search))
      return json({ error: 'Unknown route' }, 404);
    const method = (directory || (isPublicData&&!nearby)) ? 'GET' : 'POST';
    if (request.method !== method)
      return json({ error: 'Unsupported method' }, 405, { Allow: method });
    const origin = request.headers.get('Origin');
    if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
      (nearby && (origin !== url.origin ||
        (request.headers.get('Sec-Fetch-Site')!==null &&
         request.headers.get('Sec-Fetch-Site')!=='same-origin'))))
      return json({ error: 'Cross-site request denied' }, 403);
    try {
      const key = request.headers.get('CF-Connecting-IP') || 'local';
      if (!(await env.LOCATION_LIMIT.limit({ key })).success)
        return json({ error: 'Please try again in a minute' }, 429, { 'Retry-After': '60' });
      let point = null;
      let filters: KnowledgeFilters | DirectoryFilters | null = null;
      let unifiedFilters: UnifiedSearchFilters | null = null;
      let externalQuery: string | null = null;
      let placeId: string | null = null;
      let reviewFilters: ReviewFilters | null = null;
      let nearbyFilters:NearbySearch|null=null;
      if(nearby){
        const raw=await readNearbyBody(request);
        if(raw===null)return json({error:'Invalid nearby request'},400);
        try{nearbyFilters=parseNearbySearch(raw);}
        catch(error){
          if(error instanceof NearbyQueryError)return json({error:'Invalid nearby request'},400);
          return json({error:'Invalid nearby request'},400);
        }
      }
      if (isPublicData && !nearby) {
        try {
          if (externalWeb) externalQuery=parseExternalQuery(url.searchParams);
          else if (unifiedSearch) unifiedFilters = parseUnifiedSearch(url.searchParams);
          else if (knowledge) filters = parseKnowledgeFilters(url.searchParams);
          else if (places) filters = parseDirectoryFilters(url.searchParams);
          else if (reviews) reviewFilters = parsePublicReviews(url.pathname,url.searchParams);
          else {
            if (url.search) throw new PublicQueryError();
            placeId = parsePublicPlaceId(url.pathname);
          }
        } catch {
          return json({ error: 'Invalid search filters' }, 400);
        }
      }
      if (!directory && !isPublicData) {
        if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
          return json({ error: 'Expected JSON' }, 415);
        if (ask) {
          const data = await readAsk(request).catch(() => null);
          if (!data) return json({ error: 'Expected a short question and language en or yo' }, 400);
          return json(await answerQuestion(data.question, data.language));
        }
        point = await readPoint(request).catch(() => null);
        if (!point) return json({ error: 'Expected a confirmed, valid coordinate pair' }, 400);
      }
      if(nearby&&!nearbyFilters)return json({error:'Invalid nearby request'},400);
      if(externalWeb){
        if(!externalQuery)return json({error:'Invalid public web query'},400);
        if(env.EXTERNAL_WEB_SEARCH_ENABLED!=='true'||!env.BRAVE_SEARCH_API_KEY)
          return json({available:false,reason:'External discovery is not configured'},503,
            {'Referrer-Policy':'no-referrer'});
        try{
          return json(await fetchEkitiWebResults(externalQuery,env.BRAVE_SEARCH_API_KEY),200,
            {'Referrer-Policy':'no-referrer'});
        }catch{return json({available:false,reason:'Web discovery temporarily unavailable'},503,
          {'Referrer-Policy':'no-referrer'});}
      }
      const client = new pg.Client({
        connectionString: env.HYPERDRIVE.connectionString,
        connectionTimeoutMillis: 5000,
        query_timeout: 5000,
      });
      try {
        await client.connect();
        if (point)
          return json(await resolveIncidentLocation(client, point.latitude, point.longitude));
        if(nearby&&nearbyFilters){
          const location=await resolveIncidentLocation(client,nearbyFilters.latitude,nearbyFilters.longitude);
          const status=location.stateBoundaryStatus==='outside'?'outside_ekiti':
            location.stateBoundaryStatus!=='inside'||location.consistency==='conflict'||
            location.lga.status!=='matched'?'uncertain_coverage':null;
          if(status)return json({items:[],reviewedOnly:true,order:'distance',
            status,radiusKm:nearbyFilters.radiusKm},200,{'Referrer-Policy':'no-referrer'});
          const items=await searchVerifiedNearby(client,nearbyFilters);
          return json({items,reviewedOnly:true,order:'distance',
            status:'ready',radiusKm:nearbyFilters.radiusKm},200,
            {'Referrer-Policy':'no-referrer'});
        }
        if (unifiedSearch && unifiedFilters)
          return json(await searchReviewedEkiti(client, unifiedFilters));
        if (knowledge)
          return json({ items: await searchKnowledge(client, filters as KnowledgeFilters),
            reviewedOnly: true });
        if (places)
          return json({ items: await searchPlaces(client, filters as DirectoryFilters),
            reviewedOnly: true });
        if (reviews) {
          const record = await publicReviews(client,reviewFilters!);
          return record ? json(record) : json({ error: 'Published listing not found' },404);
        }
        if (place) {
          const record = await getPlace(client, placeId!);
          return record ? json({ item: record, reviewedOnly: true }) :
            json({ error: 'Published listing not found' }, 404);
        }
        return json((await client.query('SELECT * FROM geo.location_directory()')).rows);
      } finally {
        await client.end();
      }
    } catch {
      return json({ error: 'Service temporarily unavailable' }, 503);
    }
  },
};
