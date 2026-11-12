import type { Client } from 'pg';
import {inferEkitiLocality,normaliseEkitiText} from '../geo/reviewed-localities.ts';
import {
  searchKnowledge, searchPlaces, type DirectoryFilters, type KnowledgeFilters,
} from './public-data.ts';

/**
 * One public search across existing source-reviewed Ekiti records.
 * This never reads private incident, staff, claim or moderation tables.
 * The underlying SQL functions enforce publication/review gates.
 */
export interface UnifiedSearchFilters {
  query: string;
  limit: number;
}

export class UnifiedSearchError extends Error {
  constructor() { super('Invalid public search'); this.name = 'UnifiedSearchError'; }
}

export function parseUnifiedSearch(params: URLSearchParams): UnifiedSearchFilters {
  if ([...params.keys()].some(key => key !== 'q' && key !== 'limit') ||
      params.getAll('q').length !== 1 ||
      params.getAll('limit').length > 1) throw new UnifiedSearchError();
  const query = (params.get('q') || '').trim().replace(/\s+/gu, ' ');
  if (query.length < 2 || query.length > 100 ||
      /[\p{Cc}\p{Cf}]/u.test(query)) throw new UnifiedSearchError();
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 10 : Number(rawLimit);
  if (rawLimit !== null && !/^[1-9][0-9]?$/u.test(rawLimit)) throw new UnifiedSearchError();
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new UnifiedSearchError();
  return {query, limit};
}

export interface PublicSearchPlan {
  directory: DirectoryFilters;
  knowledge: KnowledgeFilters;
  localityHint: {
    name: string;
    lgaId: string;
    lgaName: string;
    source: string;
    confidence: 'reviewed-place-name';
  } | null;
  scope: 'specific-place' | 'lga' | 'none' | 'ambiguous';
}

const intentWords = /^(find|search|show|me|for|where|is|are|some|any|near|around|in|at|within|of|the|a|an|please|looking|services?|businesses?)$/u;
const hotelWords = /^(hotel|hotels|resort|resorts|motel|motels|guesthouse|guesthouses|accommodation|lodging)$/u;
const healthWords = /^(hospital|hospitals|clinic|clinics|pharmacy|pharmacies|healthcare)$/u;
const schoolWords = /^(school|schools|university|universities|college|colleges)$/u;
const officeWords = /^(ministry|ministries|office|offices|mda|mdas)$/u;

/**
 * Typed queries retain a source-backed locality *hint*, not a distance or
 * coordinate claim. The existing SQL reader still verifies every result.
 */
export function planPublicSearch(input:UnifiedSearchFilters):PublicSearchPlan {
  const normalized=normaliseEkitiText(input.query);
  const inference=inferEkitiLocality(input.query);
  const place=inference.status==='candidate'?inference.place:null;
  const tokens=normalized.split(' ').filter(Boolean);
  const category:DirectoryFilters['category']=tokens.some(t=>hotelWords.test(t))?'Hotels'
    :tokens.some(t=>healthWords.test(t))?'Health'
    :tokens.some(t=>schoolWords.test(t))?'Schools'
    :tokens.some(t=>officeWords.test(t))?'Offices':null;
  let residual=' '+normalized+' ';
  let matchedAlias:string|null=null;
  if(place) {
    // Only remove aliases actually present in the query. Longer names win.
    const names=[...place.aliases].sort((a,b)=>b.length-a.length);
    for(const alias of names) {
      const name=normaliseEkitiText(alias);
      const where=residual.indexOf(' '+name+' ');
      if(where!==-1){
        matchedAlias=alias;
        residual=residual.slice(0,where)+' '+residual.slice(where+name.length+2);break;
      }
    }
  }
  const terms=residual.trim().split(/\s+/u).filter(t=>
    t&&!intentWords.test(t) &&
    !hotelWords.test(t)&&!healthWords.test(t)&&!schoolWords.test(t)&&!officeWords.test(t));
  let directoryQuery:string|null=terms.join(' ').slice(0,100)||null;
  // For coarse categories, locality name is the useful verified address
  // text; a full natural sentence would not match the existing safe SQL API.
  if(category && place && !directoryQuery) {
    directoryQuery=matchedAlias||place.name;
  }
  // Generic place-only queries can use its address, not the full sentence.
  if(!category && place && !directoryQuery)
    directoryQuery=matchedAlias||place.name;
  if(!directoryQuery && !category) directoryQuery=input.query;
  return {
    directory:{
      category,lga:place?.lgaId??null,query:directoryQuery,
      limit:input.limit,
    },
    knowledge:{query:input.query,limit:input.limit},
    localityHint:place?{
      name:place.name,lgaId:place.lgaId,lgaName:place.lgaName,
      source:place.source,confidence:'reviewed-place-name',
    }:null,
    scope:place?(place.kind==='lga'?'lga':'specific-place'):
      inference.status==='ambiguous'?'ambiguous':'none',
  };
}

/**
 * On a public-reader outage retain only the deterministic, reviewed
 * geographic NAME hint. Never claim that empty SQL results were checked.
 * Sourced examples and external web references remain separate in the UI.
 */
export function unavailableReviewedEkiti(input:UnifiedSearchFilters) {
  const plan=planPublicSearch(input);
  return {
    query:input.query,reviewedOnly:true as const,reviewedAvailable:false as const,
    places:[],knowledge:[],
    localityHint:plan.localityHint,
    locationScope:plan.scope,
  };
}

export async function searchReviewedEkiti(db:Client,input:UnifiedSearchFilters) {
  const plan=planPublicSearch(input);
  // Existing source-reviewed SQL functions protect public rows. Never search
  // private cases, raw listing queue, draft narratives or staff tables here.
  const places=await searchPlaces(db,plan.directory);
  const knowledge=await searchKnowledge(db,plan.knowledge);
  return {
    query:input.query,reviewedOnly:true as const,reviewedAvailable:true as const,
    places,knowledge,
    localityHint:plan.localityHint,
    locationScope:plan.scope,
  };
}
