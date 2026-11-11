import type { QueryResult, QueryResultRow } from 'pg';
import type {
  PrivateAdminRepository, AdminCaseRecord, AdminCaseEvent,
  InternalNoteCommand, InternalNoteResult,
  AdminIntakeRecord,IntakeReviewCommand,IntakeReviewResult,
} from './admin-gateway.ts';
import type { StaffMembership, AdminRole } from './admin-access.ts';

/**
 * A real Postgres-backed adapter for the opt-in admin gateway.
 *
 * Pass a SEPARATE, least-privileged server-only pg.Pool whose DB role holds
 * ONLY ekiti_admin_rpc (USAGE and EXECUTE on six reviewed functions).
 * No citizen Worker, public Hyperdrive binding, URL query or Vite variable
 * may contain or access this connection string.
 *
 * Functions independently check active membership and geography in SQL.
 * This adapter never accesses private tables directly or builds dynamic SQL.
 */
export interface RestrictedQueryClient {
  query<R extends QueryResultRow = QueryResultRow>(
    sql: string, values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid administrative result');
  return value;
}
function stamp(value: unknown): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.valueOf())) throw new Error('Invalid time');
    return value.toISOString();
  }
  if (typeof value === 'string' && Number.isFinite(Date.parse(value)))
    return new Date(value).toISOString();
  throw new Error('Invalid administrative result');
}
function integer(value: unknown): number {
  const n = typeof value === 'number' ? value :
    typeof value === 'string' && /^\d{1,16}$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('Invalid revision');
  return n;
}
function data(row: QueryResultRow): AdminCaseRecord {
  return {
    id: text(row.id), publicReference: text(row.public_reference),
    kind: text(row.kind) as AdminCaseRecord['kind'],
    lgaId: text(row.lga_id),
    currentState: text(row.current_state) as AdminCaseRecord['currentState'],
    revision: integer(row.revision),
    receivedAt: stamp(row.received_at), updatedAt: stamp(row.updated_at),
  };
}
function event(row: QueryResultRow): AdminCaseEvent {
  return {
    id: text(row.id), kind: text(row.kind) as AdminCaseEvent['kind'],
    actorKind: text(row.actor_kind) as AdminCaseEvent['actorKind'],
    createdAt: stamp(row.created_at), detail: text(row.detail),
  };
}
function note(result: unknown): InternalNoteResult {
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new Error('Invalid note result');
  const r = result as Record<string, unknown>;
  if (r.result === 'conflict' || r.result === 'not_found') return { result: r.result };
  if (r.result !== 'created' && r.result !== 'replayed') throw new Error('Invalid note result');
  return { result: r.result, eventId: text(r.eventId), revision: integer(r.revision) };
}

export function createPrivatePostgresRepository(db: RestrictedQueryClient): PrivateAdminRepository {
  return {
    async getMembership(subject: string): Promise<StaffMembership | null> {
      const r = await db.query(
        'SELECT * FROM civic_private.admin_rpc_membership($1::uuid)', [subject],
      );
      if (r.rowCount === 0) return null;
      if (r.rowCount !== 1) throw new Error('Unexpected staff result');
      const row = r.rows[0]!;
      return {
        userId: text(row.user_id), role: text(row.role) as AdminRole,
        active: row.active === true,
        allowedLgaIds: Array.isArray(row.allowed_lga_ids) ?
          row.allowed_lga_ids.map(text) : [],
        verifiedOfficeId: row.verified_office_id == null ?
          null : text(row.verified_office_id),
        expiresAt: row.expires_at == null ? null :
          Math.floor(Date.parse(stamp(row.expires_at))/1000),
      };
    },
    async listCases({ actorId, allowedLgas, lgaId, limit }): Promise<readonly AdminCaseRecord[]> {
      // allowedLgas is intentionally NOT passed to SQL. SQL fetches staff grants
      // independently by the authenticated actorId.
      void allowedLgas;
      const r = await db.query(
        'SELECT * FROM civic_private.admin_rpc_cases($1::uuid,$2::text,$3::integer)',
        [actorId, lgaId, limit],
      );
      return r.rows.map(data);
    },
    async findCase(id: string, actorId: string): Promise<AdminCaseRecord | null> {
      const r = await db.query(
        'SELECT * FROM civic_private.admin_rpc_case($1::uuid,$2::uuid)',[actorId,id],
      );
      if (r.rowCount === 0) return null;
      if (r.rowCount !== 1) throw new Error('Unexpected case result');
      return data(r.rows[0]!);
    },
    async listEvents(caseId: string, limit: number, actorId: string): Promise<readonly AdminCaseEvent[]> {
      const r = await db.query(
        'SELECT * FROM civic_private.admin_rpc_events($1::uuid,$2::uuid,$3::integer)',
        [actorId,caseId,limit],
      );
      return r.rows.map(event);
    },
    async createInternalNote(input: InternalNoteCommand): Promise<InternalNoteResult> {
      const r = await db.query(
        'SELECT civic_private.admin_rpc_note($1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::text) AS result',
        [input.actorId,input.caseId,input.requestId,input.expectedRevision,input.text],
      );
      if (r.rowCount !== 1) throw new Error('Unexpected note result');
      return note(r.rows[0]!.result);
    },
    async listIntake({actorId,lgaId,kind,state,limit}):Promise<readonly AdminIntakeRecord[]>{
      const r=await db.query(
        'SELECT * FROM civic_private.admin_rpc_intake_cases($1::uuid,$2::text,$3::text,$4::text,$5::integer)',
        [actorId,lgaId,kind,state,limit],
      );
      return r.rows.map(row=>{
        if(row.evidence_access!=='blocked_pending_safeguarding')
          throw new Error('Invalid intake security state');
        return {...data(row),evidenceAccess:'blocked_pending_safeguarding' as const};
      });
    },
    async proposeIntakeReview(input:IntakeReviewCommand):Promise<IntakeReviewResult>{
      const r=await db.query(
        'SELECT civic_private.admin_rpc_intake_propose($1::uuid,$2::uuid,$3::text,$4::text,$5::bigint) AS result',
        [input.actorId,input.caseId,input.kind,input.targetLgaId,input.expectedRevision],
      );
      if(r.rowCount!==1||!r.rows[0]||!r.rows[0].result||
        typeof r.rows[0].result!=='object')
        throw new Error('Invalid review proposal response');
      const v=r.rows[0].result as Record<string,unknown>;
      if(v.result==='conflict'||v.result==='not_available')
        return {result:v.result};
      if((v.result==='queued'||v.result==='replayed')&&typeof v.proposalId==='string')
        return {result:v.result,proposalId:v.proposalId};
      throw new Error('Invalid review proposal response');
    },
    async recordRead({ actorId, action, caseId, lgaId }): Promise<void> {
      await db.query(
        'SELECT civic_private.admin_rpc_audit_read($1::uuid,$2::text,$3::uuid,$4::text)',
        [actorId,action,caseId,lgaId],
      );
    },
  };
}
