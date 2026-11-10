import type { AdminCase } from './case-model.ts';

/**
 * Routing advice is not delivery. Do not infer responsibility from a place
 * name or create fictitious government offices and contact details.
 */
export type RoutingScope = 'state_or_lga_review' | 'lga_review' | 'manual_review';
export interface RoutingAssessment {
  caseId: string;
  category: string;
  lga: string;
  areaEvidence: 'demo_label_only';
  wardEvidence: 'unmapped';
  scope: RoutingScope;
  proposedOffice: null;
  governmentDelivery: 'not_attempted';
  humanApprovalRequired: true;
  reason: string;
}

export function assessDemoRoute(item: AdminCase): RoutingAssessment {
  const category = item.category;
  let scope: RoutingScope = 'manual_review';
  let reason = 'Responsibility cannot be inferred confidently; staff must confirm a real office and mandate.';
  if (category === 'Environment' || category === 'Water & sanitation') {
    scope = 'lga_review';
    reason = 'Consider an LGA-level triage review; legal responsibility and receiving office remain unverified.';
  } else if (category === 'Public infrastructure' || category === 'Roads & transport') {
    scope = 'state_or_lga_review';
    reason = 'Infrastructure responsibilities may span state and LGA authorities; an authorized person must verify.';
  }
  return {
    caseId: item.id, category, lga: item.lga, areaEvidence: 'demo_label_only',
    wardEvidence: 'unmapped', scope, proposedOffice: null,
    governmentDelivery: 'not_attempted', humanApprovalRequired: true, reason,
  };
}
