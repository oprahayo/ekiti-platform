/**
 * Admin milestone A: in-memory operational model.
 * This module never talks to a production case database.
 * Government/agency delivery or viewing cannot be asserted by these actions.
 */
export type Queue = 'inbox' | 'assigned' | 'awaiting' | 'escalated' | 'resolved';
export type Priority = 'normal' | 'high';
export type ReportKind = 'Complaint' | 'Commendation' | 'Issue';
export type EventKind =
  | 'received' | 'assigned' | 'awaiting_response'
  | 'escalated' | 'resolved' | 'reopened' | 'internal_note';
export type Action = 'assign' | 'await' | 'escalate' | 'resolve' | 'reopen' | 'note';

export interface CaseEvent {
  id: string;
  kind: EventKind;
  at: string;
  actor: string;
  detail: string;
}
export interface AdminCase {
  id: string;
  title: string;
  summary: string;
  kind: ReportKind;
  category: string;
  lga: string;
  priority: Priority;
  receivedAt: string;
  assignee: string | null;
  events: CaseEvent[];
}

export const QUEUES: Queue[] = ['inbox', 'assigned', 'awaiting', 'escalated', 'resolved'];
export const QUEUE_LABELS: Record<Queue, string> = {
  inbox: 'Inbox',
  assigned: 'Assigned',
  awaiting: 'Awaiting',
  escalated: 'Escalations',
  resolved: 'Resolved',
};

const stateByKind: Partial<Record<EventKind, Queue>> = {
  received: 'inbox',
  assigned: 'assigned',
  awaiting_response: 'awaiting',
  escalated: 'escalated',
  resolved: 'resolved',
  reopened: 'assigned',
};

export function caseQueue(item: AdminCase): Queue {
  if (!item.events.length || item.events[0]?.kind !== 'received')
    throw new Error('Case requires an intake event');
  let state: Queue = 'inbox';
  for (const event of item.events) {
    const transition = stateByKind[event.kind];
    if (transition) state = transition;
  }
  return state;
}

export function queueCounts(items: readonly AdminCase[]): Record<Queue, number> {
  const counts: Record<Queue, number> = { inbox: 0, assigned: 0, awaiting: 0, escalated: 0, resolved: 0 };
  for (const item of items) counts[caseQueue(item)]++;
  return counts;
}

export function filterCases(items: readonly AdminCase[], queue: Queue | 'all', query: string): AdminCase[] {
  const term = query.trim().toLocaleLowerCase();
  return items.filter(item => (queue === 'all' || caseQueue(item) === queue) &&
    (!term || [item.id, item.title, item.category, item.lga, item.kind, item.summary]
      .some(value => value.toLocaleLowerCase().includes(term))))
    .sort((a, b) => b.events[b.events.length - 1]!.at.localeCompare(a.events[a.events.length - 1]!.at));
}

/** Every action here concerns only the independent PLATFORM, not a government agency. */
export function availableActions(queue: Queue): Action[] {
  const actions: Record<Queue, Action[]> = {
    inbox: ['assign', 'escalate', 'note'],
    assigned: ['await', 'escalate', 'resolve', 'note'],
    awaiting: ['assign', 'escalate', 'resolve', 'note'],
    escalated: ['assign', 'await', 'resolve', 'note'],
    resolved: ['reopen', 'note'],
  };
  return actions[queue];
}

const kindByAction: Record<Action, EventKind> = {
  assign: 'assigned',
  await: 'awaiting_response',
  escalate: 'escalated',
  resolve: 'resolved',
  reopen: 'reopened',
  note: 'internal_note',
};

export class InvalidCaseAction extends Error {
  constructor() { super('Invalid case action'); }
}

export function applyDemoAction(
  item: AdminCase, action: Action, note: string, at: string,
  actor = 'Demo moderator',
): AdminCase {
  if (!availableActions(caseQueue(item)).includes(action))
    throw new InvalidCaseAction();
  const detail = note.trim();
  if (action !== 'assign' && (detail.length < 8 || detail.length > 500 ||
    /[\u0000-\u001f]/u.test(detail)))
    throw new InvalidCaseAction();
  if (!Number.isFinite(Date.parse(at)) || !actor.trim())
    throw new InvalidCaseAction();
  const event: CaseEvent = {
    id: `demo-event-${item.events.length + 1}`,
    kind: kindByAction[action],
    at,
    actor,
    detail: action === 'assign' ? 'Assigned to the demo moderator' : detail,
  };
  return {
    ...item,
    assignee: action === 'assign' || action === 'reopen' ? actor : item.assignee,
    events: [...item.events, event],
  };
}

/**
 * Authenticated agency proof is NOT available in this milestone.
 * Keep it unavailable rather than inventing receipt / view timestamps.
 */
export function agencyEvidence(): { delivered: false; viewed: false; label: string } {
  return { delivered: false, viewed: false, label: 'Not verified' };
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos',
    }).format(date);
}
