/**
 * Milestone 02 intake contract (not exposed by any Worker route).
 *
 * Validates a proposed anonymous report before a future, separately reviewed
 * persistence service. A policy identifier MUST be explicitly approved and
 * supplied by the caller; with no policy there is no valid submission.
 */
export const MAX_REPORT_BYTES = 6144;
export const MAX_DESCRIPTION_CHARS = 4000;

export type ReportKind = 'Complaint' | 'Commendation' | 'Issue';

export interface ValidatedReport {
  kind: ReportKind;
  description: string;
  lgaId: string;
  wardId: string | null;
  place: string;
  clientRequestId: string;
  consentPolicyVersion: string;
}

export class ReportInputError extends Error {
  readonly code: 'policy_unavailable' | 'invalid_request' | 'payload_too_large' | 'consent_required';
  constructor(code: 'policy_unavailable' | 'invalid_request' | 'payload_too_large' | 'consent_required') {
    super(code); // Do not include user-authored narrative in errors or logs.
    this.code = code;
    this.name = 'ReportInputError';
  }
}

const allowedKeys = new Set([
  'kind', 'description', 'lgaId', 'wardId', 'place',
  'clientRequestId', 'consent', 'consentPolicyVersion',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseReportInput(raw: string, approvedConsentPolicyVersion?: string): ValidatedReport {
  // Refuse all submissions until a separate, public-facing privacy/retention
  // policy has been approved. This is NOT enabled by the current Worker.
  if (!approvedConsentPolicyVersion?.trim()) throw new ReportInputError('policy_unavailable');
  if (new TextEncoder().encode(raw).byteLength > MAX_REPORT_BYTES)
    throw new ReportInputError('payload_too_large');

  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new ReportInputError('invalid_request'); }
  if (!isRecord(input) || Object.keys(input).some((key) => !allowedKeys.has(key)))
    throw new ReportInputError('invalid_request');

  if (input.consent !== true || input.consentPolicyVersion !== approvedConsentPolicyVersion)
    throw new ReportInputError('consent_required');

  if (input.kind !== 'Complaint' && input.kind !== 'Commendation' && input.kind !== 'Issue')
    throw new ReportInputError('invalid_request');
  if (typeof input.description !== 'string') throw new ReportInputError('invalid_request');
  const description = input.description.trim();
  // Limit excessive data and prevent non-content, empty submissions.
  if (description.length < 20 || description.length > MAX_DESCRIPTION_CHARS
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(description))
    throw new ReportInputError('invalid_request');

  if (typeof input.lgaId !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/u.test(input.lgaId))
    throw new ReportInputError('invalid_request');
  if (input.wardId !== null && input.wardId !== undefined &&
      (typeof input.wardId !== 'string' || !/^inec-rac-ekiti-(?:[1-9][0-9]{0,2})$/u.test(input.wardId)))
    throw new ReportInputError('invalid_request');
  const wardId = typeof input.wardId === 'string' ? input.wardId : null;

  if (input.place !== undefined && (typeof input.place !== 'string' ||
      input.place.length > 160 || /[\u0000-\u001f]/u.test(input.place)))
    throw new ReportInputError('invalid_request');
  const place = typeof input.place === 'string' ? input.place.trim() : '';

  if (typeof input.clientRequestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(input.clientRequestId))
    throw new ReportInputError('invalid_request');

  return {
    kind: input.kind,
    description,
    lgaId: input.lgaId,
    wardId,
    place,
    clientRequestId: input.clientRequestId.toLowerCase(),
    consentPolicyVersion: approvedConsentPolicyVersion,
  };
}
