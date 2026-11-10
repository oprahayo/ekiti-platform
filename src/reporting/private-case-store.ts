/**
 * A restricted PostgreSQL adapter prepared for a SEPARATE, approved writer.
 * No live Cloudflare binding or grants exist for this module.
 *
 * Full report narratives remain private. All public projections, media and
 * delivery to official desks need independent moderation/authorization.
 */
import type { ValidatedReport } from './intake-contract.ts';
import { newReceiptSecret, secretDigestHex } from './receipt-crypto.ts';

export type CaseEventKind = 'intake_accepted' | 'under_review' | 'needs_information' | 'closed';
export interface SqlResult<T> { rows: T[]; rowCount: number | null; }
export interface Queryable {
  query<T = Record<string, unknown>>(statement: string, parameters?: unknown[]): Promise<SqlResult<T>>;
}

export interface PrivateReceipt {
  reference: string;
  secret: string;
  receivedAt: string;
  platformStatus: 'received_by_platform';
  governmentAcknowledged: false;
  publicationStatus: 'private_pending_moderation';
}

export interface PrivateTimeline {
  reference: string;
  platformStatus: 'private_platform_record';
  governmentAcknowledged: false;
  publicMapStatus: 'not_published';
  events: Array<{ kind: CaseEventKind; at: string }>;
}

export class CaseStoreError extends Error {
  readonly code: 'unavailable' | 'duplicate_request' | 'invalid_location' | 'not_found';
  constructor(code: 'unavailable' | 'duplicate_request' | 'invalid_location' | 'not_found') {
    super(code); this.code = code; this.name = 'CaseStoreError';
  }
}

const allowedEventKinds: readonly CaseEventKind[] = [
  'intake_accepted', 'under_review', 'needs_information', 'closed',
];

/**
 * Execute only on the dedicated private-report writer, and only after an
 * explicit operator-approved retention window. The only externally issued
 * reference is returned AFTER the transaction successfully COMMITs.
 */
export async function createPrivateReport(
  db: Queryable, input: ValidatedReport, retentionDays: number,
): Promise<PrivateReceipt> {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365)
    throw new CaseStoreError('unavailable');

  const { secret, digestHex } = await newReceiptSecret();
  // A stable digest supports duplicate-request rejection without storing
  // another copy of the narrative in an event or telemetry.
  const fingerprint = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify([
      input.kind, input.description, input.lgaId, input.wardId, input.place, input.consentPolicyVersion,
    ])));
  const fingerprintHex = Array.from(new Uint8Array(fingerprint), b => b.toString(16).padStart(2, '0')).join('');
  let active = false;
  try {
    await db.query('BEGIN');
    active = true;
    // The geography directory is a read-only reference for this writer.
    const lga = await db.query<{ id: string }>(
      "SELECT id FROM geo.areas WHERE id = $1 AND area_kind = 'lga' AND verification_state = 'verified'",
      [input.lgaId],
    );
    if (lga.rows.length !== 1) throw new CaseStoreError('invalid_location');
    if (input.wardId) {
      const ward = await db.query<{ id: string }>(
        "SELECT id FROM geo.areas WHERE id = $1 AND area_kind = 'ward' AND parent_id = $2",
        [input.wardId, input.lgaId],
      );
      if (ward.rows.length !== 1) throw new CaseStoreError('invalid_location');
    }
    const result = await db.query<{ id: string; public_reference: string; received_at: string }>(
      `INSERT INTO civic_private.reports (
         request_id, request_fingerprint, tracking_secret_digest,
         kind, description, lga_id, ward_id, place, consent_policy_version, delete_at
       ) VALUES (
         $1::uuid, decode($2,'hex'), decode($3,'hex'), $4, $5, $6, $7, $8, $9,
         now() + ($10::int * interval '1 day')
       ) RETURNING id, public_reference, received_at`,
      [input.clientRequestId, fingerprintHex, digestHex, input.kind, input.description,
        input.lgaId, input.wardId, input.place, input.consentPolicyVersion, retentionDays],
    );
    if (result.rows.length !== 1) throw new CaseStoreError('unavailable');
    await db.query(
      "INSERT INTO civic_private.case_events (report_id,kind,actor_kind) VALUES ($1,'intake_accepted','system')",
      [result.rows[0].id],
    );
    await db.query('COMMIT');
    active = false;
    return {
      reference: result.rows[0].public_reference,
      secret,
      receivedAt: String(result.rows[0].received_at),
      platformStatus: 'received_by_platform',
      governmentAcknowledged: false,
      publicationStatus: 'private_pending_moderation',
    };
  } catch (error) {
    if (active) {
      try { await db.query('ROLLBACK'); } catch { /* Fail closed. */ }
    }
    if (error instanceof CaseStoreError) throw error;
    const code = (error as { code?: string } | null)?.code;
    // A request ID already processed cannot be replayed to recover a secret.
    if (code === '23505') throw new CaseStoreError('duplicate_request');
    throw new CaseStoreError('unavailable');
  }
}

/**
 * A reference alone is insufficient. Private tracking uses the 256-bit secret
 * in a POST body, never a query string, cookie, or URL segment.
 * Return only audited platform event kinds, never narrative/contact/location.
 */
export async function readPrivateTimeline(
  db: Queryable, reference: string, secret: string,
): Promise<PrivateTimeline> {
  const digest = await secretDigestHex(secret);
  const report = await db.query<{ id: string }>(
    `SELECT id FROM civic_private.reports WHERE public_reference=$1::uuid
       AND tracking_secret_digest=decode($2,'hex') AND delete_at>now()`,
    [reference, digest],
  );
  if (report.rows.length !== 1) throw new CaseStoreError('not_found');
  const events = await db.query<{ kind: string; at: string }>(
    `SELECT kind, created_at AS at FROM civic_private.case_events
       WHERE report_id=$1 AND kind IN ('intake_accepted','under_review','needs_information','closed')
       ORDER BY id ASC LIMIT 60`,
    [report.rows[0].id],
  );
  return {
    reference, platformStatus: 'private_platform_record',
    governmentAcknowledged: false,
    publicMapStatus: 'not_published',
    events: events.rows.filter(event =>
      allowedEventKinds.includes(event.kind as CaseEventKind)).map(event => ({
      kind: event.kind as CaseEventKind, at: String(event.at),
    })),
  };
}
