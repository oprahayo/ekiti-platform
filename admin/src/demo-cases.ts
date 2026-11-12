import type { AdminCase, EventKind } from './case-model.ts';

/**
 * Entirely fictional demonstration records. Do NOT import citizen reports or
 * expose real identities, contact details, narrative text or exact coordinates.
 */
function example(
  id: string, title: string, summary: string, kind: AdminCase['kind'],
  category: string, lga: string, priority: AdminCase['priority'],
  at: string, changes: Array<[EventKind, string, string]>,
): AdminCase {
  return {
    id: 'DEMO-' + id,
    title, summary, kind, category, lga, priority, receivedAt: at,
    assignee: changes.some(([event]) => event === 'assigned') ? 'Demo moderator' : null,
    events: [
      { id: 'demo-event-1', kind: 'received', at, actor: 'Demo intake', detail: 'Fictional submission added to sample workspace' },
      ...changes.map(([kind, when, detail], index) => ({
        id: 'demo-event-' + (index + 2), kind, at: when, actor: 'Demo moderator', detail,
      })),
    ],
  };
}

export function makeDemoCases(): AdminCase[] {
  return [
    example('1001', 'Street lighting around a market',
      'Illustrative concern about a poorly lit public area near a fictional market entrance.',
      'Complaint', 'Public infrastructure', 'Ado Ekiti', 'high',
      '2026-11-09T09:15:00Z', []),
    example('1002', 'Community clean-up commendation',
      'Fictional resident thanks volunteers for maintaining a shared pedestrian area.',
      'Commendation', 'Environment', 'Ikere', 'normal',
      '2026-11-09T07:40:00Z', [
        ['assigned', '2026-11-09T11:00:00Z', 'Assigned within platform'],
      ]),
    example('1003', 'Drainage maintenance question',
      'Illustrative request for clearer information about a blocked drainage channel.',
      'Issue', 'Public infrastructure', 'Oye', 'normal',
      '2026-11-08T16:05:00Z', [
        ['assigned', '2026-11-09T08:10:00Z', 'Assigned within platform'],
        ['awaiting_response', '2026-11-09T13:05:00Z', 'Awaiting an internal clarification before the next platform update'],
      ]),
    example('1004', 'Public water point maintenance',
      'Fictional case awaiting internal supervisory review. No agency has received it.',
      'Complaint', 'Water & sanitation', 'Irepodun/Ifelodun', 'high',
      '2026-11-08T10:00:00Z', [
        ['escalated', '2026-11-09T08:00:00Z', 'Escalated internally for supervisory review'],
      ]),
    example('1005', 'Road signage suggestion',
      'Illustrative suggestion for clearer directional signage in a town centre.',
      'Issue', 'Roads & transport', 'Ekiti West', 'normal',
      '2026-11-07T14:20:00Z', [
        ['assigned', '2026-11-07T15:00:00Z', 'Assigned within platform'],
        ['resolved', '2026-11-08T10:00:00Z', 'Closed as a platform demonstration; no government action claimed'],
      ]),
    example('1006', 'Footpath accessibility concern',
      'Fictional report about a pedestrian walkway. No exact location is stored.',
      'Complaint', 'Accessibility', 'Gbonyin', 'normal',
      '2026-11-09T18:45:00Z', []),
  ];
}
