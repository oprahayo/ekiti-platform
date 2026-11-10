import type { Client } from 'pg';

/** These SELECTs use only SECURITY DEFINER functions with reviewed-state gates. */
export type Category = 'Health' | 'Schools' | 'Offices' | 'Hotels' | 'Other';
export interface DirectoryFilters {
  category: Category | null;
  lga: string | null;
  query: string | null;
  limit: number;
}
export interface KnowledgeFilters { query: string; limit: number; }
export class PublicQueryError extends Error {
  constructor() { super('Invalid search filters'); this.name = 'PublicQueryError'; }
}
function onlyKeys(params: URLSearchParams, allowed: string[]) {
  return [...params.keys()].every(key => allowed.includes(key)) &&
    [...params.keys()].every(key => params.getAll(key).length === 1);
}
function cap(raw: string | null, fallback = 10) {
  if (!raw) return fallback;
  if (!/^[1-9][0-9]{0,1}$/.test(raw)) throw new PublicQueryError();
  if (Number(raw) > 20) throw new PublicQueryError();
  return Number(raw);
}
export function parseKnowledgeFilters(params: URLSearchParams): KnowledgeFilters {
  if (!onlyKeys(params,['q','limit'])) throw new PublicQueryError();
  const query = params.get('q')?.trim() || '';
  if (query.length < 2 || query.length > 160 ||
      [...query].some(char => char.codePointAt(0)! < 32)) throw new PublicQueryError();
  return { query, limit: cap(params.get('limit')) };
}
export function parseDirectoryFilters(params: URLSearchParams): DirectoryFilters {
  if (!onlyKeys(params,['category','lga','q','limit'])) throw new PublicQueryError();
  const category = params.get('category') || null;
  if (category && !['Health','Schools','Offices','Hotels','Other'].includes(category))
    throw new PublicQueryError();
  const lga = params.get('lga') || null;
  if (lga && !/^[a-z0-9][a-z0-9-]{1,63}$/.test(lga))
    throw new PublicQueryError();
  const query = params.get('q')?.trim() || null;
  if (query && (query.length > 100 || [...query].some(char => char.codePointAt(0)! < 32)))
    throw new PublicQueryError();
  return { category: category as Category | null, lga, query, limit: cap(params.get('limit'),20) };
}
export function parsePublicPlaceId(path: string): string {
  const id = path.split('/')[3];
  if (!/^\/api\/places\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path))
    throw new PublicQueryError();
  return id!;
}
export async function searchKnowledge(db: Client, filters: KnowledgeFilters) {
  const result = await db.query('SELECT * FROM civic.public_knowledge($1,$2)', [filters.query,filters.limit]);
  return result.rows;
}
export async function searchPlaces(db: Client, filters: DirectoryFilters) {
  const result = await db.query('SELECT * FROM civic.public_places($1,$2,$3,$4)', [
    filters.category,filters.lga,filters.query,filters.limit,
  ]);
  return result.rows;
}
export async function getPlace(db: Client, id: string) {
  const result = await db.query('SELECT * FROM civic.public_place($1)',[id]);
  return result.rows[0] || null;
}
