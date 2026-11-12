import { REPORT_DRAFT_KEY } from './report-journey-state.ts';
import { DRAFT_STORAGE_KEY, OLD_DRAFT_STORAGE_KEY } from './report-conversation.ts';

export type SafeguardConcern = 'vulnerable_person' | 'retaliation';
export const LOCAL_DRAFT_REOPEN_MS = 24 * 60 * 60 * 1000;

/** Browser-only, advisory flags. Never automatically infer a person's identity or vulnerability. */
export function restrictPreviewEvidence(concerns: readonly SafeguardConcern[]): boolean {
  return concerns.includes('vulnerable_person') || concerns.includes('retaliation');
}

/** Expired drafts are removed when this reporting UI is opened again, not by a server job. */
export function hasExpiredLocalDraft(raw: string | null, now = Date.now()): boolean {
  if (!raw || raw.length > 6200) return false;
  try {
    const candidate: unknown = JSON.parse(raw);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const item = candidate as Record<string, unknown>;
    if (!['report', 'feedback'].includes(String(item.purpose)) ||
        typeof item.savedAt !== 'string') return false;
    const time = Date.parse(item.savedAt);
    return Number.isFinite(time) && time <= now && now - time > LOCAL_DRAFT_REOPEN_MS;
  } catch {
    return false;
  }
}

export interface StorageEraser { removeItem(key: string): void; }
export interface LocalEraseResult { ok: boolean; failedStores: readonly string[]; }
/** Explicit local deletion only. Not a server erasure request or browser forensic wipe. */
export function eraseLocalReportDrafts(
  session: StorageEraser, local: StorageEraser,
): LocalEraseResult {
  const failedStores:string[] = [];
  try { session.removeItem(REPORT_DRAFT_KEY); }
  catch { failedStores.push('session'); }
  try {
    // Legacy text-draft route auto-stored these older copies in localStorage.
    local.removeItem(DRAFT_STORAGE_KEY);
    local.removeItem(OLD_DRAFT_STORAGE_KEY);
  } catch { failedStores.push('local'); }
  return { ok:failedStores.length===0, failedStores };
}

/**
 * Proposed, unconnected safety gate for a *future* public redacted projection.
 * There is no public case projection in the current citizen reporting route.
 * Caller must get human-reviewed values from a trusted, authorized server.
 */
export interface ReviewedPublication {
  reviewerAuthorized:boolean;
  humanDecision:'unreviewed'|'hold_private'|'reject'|'approve_redacted';
  redactionVerified:boolean;
  vulnerablePerson:boolean;
  retaliationConcern:boolean;
  operatorPolicyApproved:boolean;
}
export function mayPublishApprovedSummary(record:ReviewedPublication):boolean {
  return record.reviewerAuthorized && record.humanDecision==='approve_redacted' &&
    record.redactionVerified && record.operatorPolicyApproved &&
    !record.vulnerablePerson && !record.retaliationConcern;
}
