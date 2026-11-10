/**
 * Back-office moderation model for the standalone DEMO workspace only.
 * Approved here never means published, ownership verified, or a public API change.
 * Live decisions require an authenticated, auditable server-side moderation API.
 */
export type ModerationKind = 'listing' | 'review' | 'claim' | 'knowledge' | 'correction';
export type ModerationState = 'pending' | 'needs_evidence' | 'demo_approved' | 'demo_rejected';
export type ModerationAction = 'request_evidence' | 'approve' | 'reject' | 'reopen';
export interface ModerationEvent {
  action: ModerationAction | 'submitted';
  at: string;
  reason: string;
  actor: 'Demo moderator' | 'Demo intake';
}
export interface ModerationItem {
  id: string;
  kind: ModerationKind;
  title: string;
  detail: string;
  lga: string | null;
  sourceLabel: string;
  sourceReviewedInDemo: boolean;
  status: ModerationState;
  history: ModerationEvent[];
}
export const MODERATION_LABELS: Record<ModerationKind, string> = {
  listing: 'Listings',
  review: 'Reviews',
  claim: 'Ownership claims',
  knowledge: 'Civic knowledge',
  correction: 'Corrections',
};
export const MODERATION_STATES: Record<ModerationState, string> = {
  pending: 'Pending',
  needs_evidence: 'Needs evidence',
  demo_approved: 'Approved (demo only)',
  demo_rejected: 'Rejected (demo only)',
};
export class InvalidModerationDecision extends Error {
  constructor() { super('Invalid moderation decision'); }
}
export function moderationActions(item: ModerationItem): ModerationAction[] {
  if (item.status === 'demo_approved' || item.status === 'demo_rejected') return ['reopen'];
  // Email-code sign-in and an applicant statement do NOT establish legal ownership.
  // Until identity and ownership proof can be verified by a real authorized reviewer,
  // the claim cannot be marked "verified" or "approved".
  if (item.kind === 'claim') return ['request_evidence', 'reject'];
  return item.sourceReviewedInDemo
    ? ['request_evidence', 'approve', 'reject']
    : ['request_evidence', 'reject'];
}
export function moderateDemoItem(
  item: ModerationItem, action: ModerationAction, reason: string, at: string,
): ModerationItem {
  if (!moderationActions(item).includes(action)) throw new InvalidModerationDecision();
  const clean = reason.trim();
  if (clean.length < 8 || clean.length > 500 || /[\u0000-\u001f]/u.test(clean) ||
    !Number.isFinite(Date.parse(at))) throw new InvalidModerationDecision();
  const status: Record<ModerationAction, ModerationState> = {
    request_evidence: 'needs_evidence', approve: 'demo_approved',
    reject: 'demo_rejected', reopen: 'pending',
  };
  return {
    ...item,
    status: status[action],
    history: [...item.history, { action, reason: clean, actor: 'Demo moderator', at }],
  };
}

function fixture(
  id: string, kind: ModerationKind, title: string, detail: string,
  lga: string | null, sourceLabel: string, sourceReviewedInDemo = false,
): ModerationItem {
  return {
    id: 'DEMO-MOD-' + id, kind, title, detail, lga, sourceLabel,
    sourceReviewedInDemo, status: 'pending',
    history: [{ action: 'submitted', actor: 'Demo intake',
      reason: 'Fictional record created for moderation interface testing',
      at: '2026-11-10T08:00:00Z' }],
  };
}

export function makeModerationExamples(): ModerationItem[] {
  return [
    fixture('101', 'listing', 'Sample neighbourhood service listing',
      'Illustrative proposed listing, not a real verified company.', 'Ado-Ekiti',
      'Fictional example record', true),
    fixture('102', 'listing', 'Example community education centre',
      'Unreviewed demonstration directory listing; location and licence unconfirmed.',
      'Ikere', 'No verified source supplied'),
    fixture('103', 'review', 'Illustrative review of a listed service',
      'A fictional 4-star user statement; no identifiable author and no public publication.',
      'Ado-Ekiti', 'Demo published listing', true),
    fixture('104', 'claim', 'Sample ownership claim for an example business',
      'Email ownership is not business ownership. Proof and a safe verification process are required.',
      'Oye', 'Fictional self-declaration'),
    fixture('105', 'knowledge', 'Proposed source-backed transport update',
      'An example civic information item. Source rights, dates, and provenance require review.',
      null, 'Fictional source review pending'),
    fixture('106', 'correction', 'Request to correct a sample directory category',
      'Community-submitted correction must be checked against independent evidence.',
      'Efon', 'Demonstration editorial evidence', true),
  ];
}
