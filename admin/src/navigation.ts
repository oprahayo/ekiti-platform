import type { Queue } from './case-model.ts';

export type AdminView = 'all' | Queue | 'moderation' | 'routing' | 'analytics';
export const CASE_VIEWS: readonly AdminView[] = [
  'all', 'inbox', 'assigned', 'awaiting', 'escalated', 'resolved',
];
export const NAV_VIEWS: readonly AdminView[] = [...CASE_VIEWS, 'moderation', 'routing', 'analytics'];

export function isCaseView(view: AdminView): view is 'all' | Queue {
  return CASE_VIEWS.includes(view);
}

/**
 * URL state stores only the section/queue; never personal data, narratives,
 * tracking tokens or an authenticated case identifier.
 */
export function readAdminView(search: string): AdminView {
  const value = new URLSearchParams(search).get('view');
  return NAV_VIEWS.find(view => view === value) ?? 'all';
}
export function adminViewUrl(view: AdminView, pathname: string): string {
  if (!NAV_VIEWS.includes(view)) throw new Error('Invalid admin view');
  return pathname + '?view=' + encodeURIComponent(view);
}
