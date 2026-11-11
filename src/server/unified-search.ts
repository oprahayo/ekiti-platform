import type { Client } from 'pg';
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

export async function searchReviewedEkiti(db: Client, input: UnifiedSearchFilters) {
  const directory: DirectoryFilters = {query: input.query, category: null, lga: null, limit: input.limit};
  const knowledge: KnowledgeFilters = {query: input.query, limit: input.limit};
  // The two original SQL functions read only approved sources, published places,
  // approved knowledge and verified LGAs. Do not add a fallback to raw records.
  const places = await searchPlaces(db, directory);
  const articles = await searchKnowledge(db, knowledge);
  return {
    query: input.query,
    reviewedOnly: true as const,
    places,
    knowledge: articles,
  };
}
