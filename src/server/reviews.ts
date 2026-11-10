import type { Client } from 'pg';
import { parsePublicPlaceId, PublicQueryError } from './public-data.ts';

export interface ReviewFilters { placeId: string; limit: number }
export function parsePublicReviews(path: string, params: URLSearchParams): ReviewFilters {
  if (!path.endsWith('/reviews')) throw new PublicQueryError();
  const placeId = parsePublicPlaceId(path.slice(0,-'/reviews'.length));
  if ([...params.keys()].some(key => key !== 'limit') || params.getAll('limit').length > 1)
    throw new PublicQueryError();
  const raw = params.get('limit');
  if (raw && !/^(?:[1-9]|1[0-9]|20)$/.test(raw)) throw new PublicQueryError();
  return { placeId, limit: raw ? Number(raw) : 10 };
}
export async function publicReviews(db: Client, filters: ReviewFilters) {
  const summary = await db.query(
    'SELECT * FROM civic.public_rating_summary($1)',[filters.placeId]);
  if (!summary.rows[0]) return null;
  const items = await db.query(
    'SELECT * FROM civic.public_reviews($1,$2)',[filters.placeId,filters.limit]);
  return {
    ratingCount: Number(summary.rows[0].rating_count),
    averageRating: summary.rows[0].average_rating === null
      ? null : Number(summary.rows[0].average_rating),
    items: items.rows,
    moderatedOnly: true,
  };
}
