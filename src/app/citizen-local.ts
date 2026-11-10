/** Local-only preferences: never treated as account data or public reviews. */
export const SAVED_KEY = 'ekiti-civic-saved-reviewed-v1';
export const DRAFT_REVIEWS_KEY = 'ekiti-civic-review-drafts-v1';
export const PLACE_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export interface ReviewDraft {
  stars: number;
  text: string;
  updatedAt: string;
}
function store(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; }
  catch { return null; }
}
export function readSavedPlaces(): string[] {
  try {
    const ids: unknown = JSON.parse(store()?.getItem(SAVED_KEY) || '[]');
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string =>
      typeof id === 'string' && PLACE_ID.test(id)))].slice(0, 60) : [];
  } catch { return []; }
}
export function writeSavedPlaces(ids: string[]): boolean {
  try {
    const storage = store();
    if (!storage) return false;
    storage.setItem(SAVED_KEY, JSON.stringify(ids.filter(id => PLACE_ID.test(id)).slice(0, 60)));
    return true;
  } catch { return false; }
}
export function readReviewDrafts(): Record<string, ReviewDraft> {
  try {
    const data: unknown = JSON.parse(store()?.getItem(DRAFT_REVIEWS_KEY) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const entries = Object.entries(data as Record<string, unknown>)
      .filter(([id, entry]) => {
        if (!PLACE_ID.test(id) || !entry || typeof entry !== 'object') return false;
        const value = entry as Partial<ReviewDraft>;
        return Number.isInteger(value.stars) && (value.stars || 0) >= 1 && (value.stars || 0) <= 5 &&
          typeof value.text === 'string' && value.text.length <= 1000 &&
          typeof value.updatedAt === 'string';
      }).slice(0, 40);
    return Object.fromEntries(entries) as Record<string, ReviewDraft>;
  } catch { return {}; }
}
export function saveReviewDraft(id: string, stars: number, text: string): boolean {
  if (!PLACE_ID.test(id) || !Number.isInteger(stars) || stars < 1 || stars > 5 || text.length > 1000)
    return false;
  try {
    const storage = store();
    if (!storage) return false;
    const entries = readReviewDrafts();
    entries[id] = { stars, text, updatedAt: new Date().toISOString() };
    storage.setItem(DRAFT_REVIEWS_KEY, JSON.stringify(entries));
    return true;
  } catch { return false; }
}
export function deleteReviewDraft(id: string): boolean {
  try {
    const storage = store();
    if (!storage) return false;
    const entries = readReviewDrafts();
    delete entries[id];
    storage.setItem(DRAFT_REVIEWS_KEY, JSON.stringify(entries));
    return true;
  } catch { return false; }
}
