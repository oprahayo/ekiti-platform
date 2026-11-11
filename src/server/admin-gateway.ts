import { verifyAdminJwt, AdminAuthError, type AdminJwtConfig, type VerifiedAdminIdentity } from './admin-auth.ts';
import { authorizeAdmin, type StaffMembership } from './admin-access.ts';

/**
 * Isolated, opt-in back-office API candidate. It is deliberately NOT imported
 * by the public Worker, and cannot serve live data without a separate private
 * repository, managed JWKS, approved governance and an explicit enable switch.
 *
 * No report narratives, contact data, GPS or tracking secrets cross this API.
 */
export type PrivateCaseKind = 'Complaint' | 'Commendation' | 'Issue';
export type PrivateCaseState = 'intake_accepted' | 'under_review' | 'needs_information' | 'closed';
export interface AdminCaseRecord {
  id: string;
  publicReference: string;
  kind: PrivateCaseKind;
  lgaId: string;
  currentState: PrivateCaseState;
  revision: number;
  receivedAt: string;
  updatedAt: string;
}
export interface AdminCaseEvent {
  id: string;
  kind: PrivateCaseState | 'internal_note';
  actorKind: 'system' | 'moderator';
  createdAt: string;
  detail: string;
}
export type IntakeReviewKind='safeguarding_review'|'possible_duplicate'|'assignment_review';
export interface AdminIntakeRecord extends AdminCaseRecord {
  evidenceAccess:'blocked_pending_safeguarding';
}
export type IntakeReviewResult =
  | {result:'queued'|'replayed';proposalId:string}
  | {result:'conflict'|'not_available'};
export interface IntakeReviewCommand {
  actorId:string;caseId:string;kind:IntakeReviewKind;
  targetLgaId:string|null;expectedRevision:number;
}
export type InternalNoteResult =
  | { result: 'created' | 'replayed'; eventId: string; revision: number }
  | { result: 'conflict' | 'not_found' };
export interface InternalNoteCommand {
  caseId: string;
  actorId: string;
  text: string;
  requestId: string;
  expectedRevision: number;
}

/**
 * Production implementations MUST enforce the LGA scope at database query time.
 * A second, independent scope check is applied to every result in this gateway.
 * Every private database read receives the server-verified actorId: the repository
 * MUST independently look up that principal and enforce LGA grants in SQL.
 * Never assume caller-provided allowedLgas is sufficient for access control.
 * createInternalNote must atomically check revision, persist ONE internal event,
 * and record the actor's audit entry in the SAME transaction. Replays must return
 * the original result; conflicting reuse of an idempotency key must be rejected.
 */
export interface PrivateAdminRepository {
  getMembership(subject: string): Promise<StaffMembership | null>;
  listCases(input: { actorId: string; allowedLgas: readonly string[] | null; lgaId: string | null; limit: number }): Promise<readonly AdminCaseRecord[]>;
  findCase(id: string, actorId: string): Promise<AdminCaseRecord | null>;
  listEvents(caseId: string, limit: number, actorId: string): Promise<readonly AdminCaseEvent[]>;
  createInternalNote(command: InternalNoteCommand): Promise<InternalNoteResult>;
  // Separate, operator-disabled Sprint 13 RPCs. Old private repositories may
  // not implement them; absence always fails closed rather than falling back
  // to unscoped local filtering of case records.
  listIntake?(input:{
    actorId:string;lgaId:string|null;kind:PrivateCaseKind|null;
    state:PrivateCaseState|null;limit:number
  }):Promise<readonly AdminIntakeRecord[]>;
  proposeIntakeReview?(input:IntakeReviewCommand):Promise<IntakeReviewResult>;
  recordRead(input: { actorId: string; action: 'case_list' | 'case_read' | 'event_read'; caseId: string | null; lgaId: string | null }): Promise<void>;
}
export interface AdminRateLimit {
  check(input: { actorId: string; operation: 'read' | 'write' }): Promise<boolean>;
}
export interface AdminGatewayOptions {
  enabled: boolean;
  origin?: string;
  jwt?: AdminJwtConfig;
  repository?: PrivateAdminRepository;
  limit?: AdminRateLimit;
  nowSeconds?: () => number;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const lgaSlug = /^[a-z0-9][a-z0-9-]{1,63}$/;
const allRoles = new Set(['platform_admin','case_manager','moderator','directory_reviewer','government_officer','auditor']);
const caseStates = new Set(['intake_accepted','under_review','needs_information','closed']);
const caseKinds = new Set(['Complaint','Commendation','Issue']);
const reviewKinds=new Set<IntakeReviewKind>([
  'safeguarding_review','possible_duplicate','assignment_review',
]);

function respond(data: unknown, status: number, extras: Record<string,string> = {}): Response {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store, private',
    'Vary': 'Authorization',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    ...extras,
  } });
}
function invalid(): Response { return respond({ error: 'Invalid request' }, 400); }
function serviceUnavailable(): Response { return respond({ error: 'Administrative service unavailable' }, 503); }
function notFound(): Response { return respond({ error: 'Not found' }, 404); }
function forbidden(): Response { return respond({ error: 'Access denied' }, 403); }
function unauthorized(): Response {
  return respond({ error: 'Authentication required' }, 401, { 'WWW-Authenticate': 'Bearer' });
}
function noContentType(request: Request): boolean {
  return request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json';
}
function isMembership(value: unknown, subject: string): value is StaffMembership {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Record<string,unknown>;
  return m.userId === subject && typeof m.active === 'boolean' &&
    typeof m.role === 'string' && allRoles.has(m.role) &&
    (m.expiresAt === null || (typeof m.expiresAt === 'number' && Number.isSafeInteger(m.expiresAt))) &&
    Array.isArray(m.allowedLgaIds) && m.allowedLgaIds.length <= 16 &&
    m.allowedLgaIds.every((id: unknown) => typeof id === 'string' && lgaSlug.test(id)) &&
    (m.verifiedOfficeId === null || (typeof m.verifiedOfficeId === 'string' && m.verifiedOfficeId.length <= 120));
}
function validCase(record: AdminCaseRecord): boolean {
  return !!record && uuid.test(record.id) && uuid.test(record.publicReference) &&
    caseKinds.has(record.kind) && lgaSlug.test(record.lgaId) &&
    caseStates.has(record.currentState) && Number.isSafeInteger(record.revision) &&
    record.revision >= 1 && !Number.isNaN(Date.parse(record.receivedAt)) &&
    !Number.isNaN(Date.parse(record.updatedAt));
}
function parseReview(input:string|null):
  Omit<IntakeReviewCommand,'actorId'|'caseId'>|null {
  if(input===null)return null;
  let v:unknown;
  try{v=JSON.parse(input);}catch{return null;}
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const r=v as Record<string,unknown>;
  if(Object.keys(r).sort().join(',')!=='expectedRevision,kind,targetLgaId'||
     !reviewKinds.has(r.kind as IntakeReviewKind)||
     !Number.isSafeInteger(r.expectedRevision)||Number(r.expectedRevision)<1||
     (r.kind==='assignment_review'
       ?typeof r.targetLgaId!=='string'||!lgaSlug.test(r.targetLgaId)
       :r.targetLgaId!==null))
     return null;
  return {kind:r.kind as IntakeReviewKind,
    expectedRevision:r.expectedRevision as number,
    targetLgaId:r.targetLgaId as string|null};
}
function projectCase(r: AdminCaseRecord) {
  // Never return unknown repository fields, descriptions or tracking secrets.
  return {
    id: r.id, publicReference: r.publicReference, kind: r.kind, lgaId: r.lgaId,
    currentState: r.currentState, revision: r.revision,
    receivedAt: r.receivedAt, updatedAt: r.updatedAt,
  };
}
function caseScope(identity: VerifiedAdminIdentity, membership: StaffMembership, record: AdminCaseRecord, now: number) {
  return authorizeAdmin({
    identity, membership, capability: 'case.read',
    target: { kind: 'case', lgaId: record.lgaId }, nowSeconds: now,
  });
}
async function readBounded(request: Request): Promise<string | null> {
  const headerLength = request.headers.get('Content-Length');
  if (headerLength !== null && (!/^\d+$/.test(headerLength) || Number(headerLength) > 1536)) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let count = 0; const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > 1536) { await reader.cancel(); return null; }
      parts.push(value);
    }
    const combined = new Uint8Array(count); let start = 0;
    for (const part of parts) { combined.set(part, start); start += part.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(combined);
  } catch { return null; }
}
function parseNote(input: string | null): Omit<InternalNoteCommand,'caseId' | 'actorId'> | null {
  if (input === null) return null;
  let obj: unknown;
  try { obj = JSON.parse(input); } catch { return null; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as Record<string,unknown>;
  if (Object.keys(o).sort().join(',') !== 'expectedRevision,requestId,text' ||
    typeof o.requestId !== 'string' || !requestUuid.test(o.requestId) ||
    typeof o.expectedRevision !== 'number' || !Number.isSafeInteger(o.expectedRevision) ||
    o.expectedRevision < 1 || typeof o.text !== 'string') return null;
  const text = o.text.trim();
  if (text.length < 8 || text.length > 500 || /[\u0000-\u001f\u007f]/u.test(text)) return null;
  return { requestId: o.requestId.toLowerCase(), expectedRevision: o.expectedRevision, text };
}

export function createAdminGateway(options: AdminGatewayOptions): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    // The gate requires every dependency. Public Worker does not import this.
    if (!options.enabled || !options.origin || !options.jwt || !options.repository || !options.limit)
      return notFound();
    let configuredOrigin: URL, url: URL;
    try {
      configuredOrigin = new URL(options.origin);
      url = new URL(request.url);
    } catch { return notFound(); }
    if (configuredOrigin.protocol !== 'https:' || configuredOrigin.origin !== options.origin ||
      url.origin !== configuredOrigin.origin || request.url.includes('#'))
      return notFound();
    const route = url.pathname;
    const casePath = /^\/admin\/api\/cases\/([a-f0-9-]{36})(?:\/(events|notes))?$/i.exec(route);
    const intakePath=/^\/admin\/api\/intake\/([a-f0-9-]{36})\/proposals$/i.exec(route);
    const intakeList=route==='/admin/api/intake';
    const casesList = route === '/admin/api/cases';
    const me = route === '/admin/api/me';
    if (!casePath && !casesList && !me && !intakeList && !intakePath) return notFound();
    const isWrite = (!!casePath && casePath[2] === 'notes')||!!intakePath;
    const method = isWrite ? 'POST' : 'GET';
    if (request.method !== method)
      return respond({ error: 'Method not allowed' }, 405, { Allow: method });
    if (request.headers.get('Cookie') || request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
      (request.headers.has('Origin') && request.headers.get('Origin') !== options.origin) ||
      (isWrite && request.headers.get('Origin') !== options.origin))
      return forbidden();
    if ((!casesList && !intakeList && url.search) ||
      (intakeList && ([...url.searchParams.keys()].some(
        k=>!['limit','lga','kind','state'].includes(k)) ||
        ['limit','lga','kind','state'].some(k=>url.searchParams.getAll(k).length>1))) ||
      (casesList && [...url.searchParams.keys()].some(k => k !== 'limit' && k !== 'lga')) ||
      (casesList && (url.searchParams.getAll('limit').length > 1 || url.searchParams.getAll('lga').length > 1)))
      return invalid();
    const tokenHeader = request.headers.get('Authorization');
    if (!tokenHeader || !/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(tokenHeader))
      return unauthorized();
    try {
      const jwt = options.jwt;
      const repo = options.repository;
      const now = options.nowSeconds?.() ?? Math.floor(Date.now() / 1000);
      const identity = await verifyAdminJwt(tokenHeader.slice(7), { ...jwt, nowSeconds: now });
      const membershipRaw = await repo.getMembership(identity.subject);
      if (!isMembership(membershipRaw, identity.subject)) return forbidden();
      const membership = membershipRaw;
      if (!membership.active || (membership.expiresAt !== null && membership.expiresAt <= now))
        return forbidden();
      if (!(await options.limit.check({ actorId: identity.subject, operation: isWrite ? 'write' : 'read' })))
        return respond({ error: 'Rate limited' }, 429, { 'Retry-After': '60' });
      if (me) {
        return respond({ identity: { assurance: identity.assurance, expiresAt: identity.expiresAt },
          membership: { role: membership.role, allowedLgaIds: membership.allowedLgaIds,
            verifiedOfficeId: membership.verifiedOfficeId } }, 200);
      }
      const capability = isWrite ? 'case.note' : 'case.read';
      const canReadAnyCase = authorizeAdmin({
        identity, membership, capability,
        target: { kind: 'case', lgaId: membership.allowedLgaIds[0] ?? 'ado-ekiti' },
        nowSeconds: now,
      }) || membership.role === 'platform_admin' && authorizeAdmin({
        identity, membership, capability, target: { kind: 'case', lgaId: 'ado-ekiti' }, nowSeconds: now,
      });
      if (!canReadAnyCase) return forbidden();
      if(intakeList){
        if(!repo.listIntake)return notFound();
        const query=url.searchParams;
        const limitText=query.get('limit');
        if(limitText!==null&&!/^(?:[1-9]|1[0-9]|2[0-5])$/.test(limitText))return invalid();
        const limit=limitText===null?20:Number(limitText);
        const lgaId=query.get('lga'),kind=query.get('kind'),state=query.get('state');
        if((lgaId!==null&&!lgaSlug.test(lgaId))||
          (kind!==null&&!caseKinds.has(kind))||
          (state!==null&&!caseStates.has(state)))return invalid();
        if(lgaId!==null&&membership.role!=='platform_admin'&&
          !membership.allowedLgaIds.includes(lgaId))return forbidden();
        const found=await repo.listIntake({
          actorId:identity.subject,lgaId,
          kind:kind as PrivateCaseKind|null,
          state:state as PrivateCaseState|null,limit,
        });
        if(!Array.isArray(found)||found.length>limit||
          found.some(r=>!validCase(r)||r.evidenceAccess!=='blocked_pending_safeguarding'||
            (lgaId!==null&&r.lgaId!==lgaId)||
            (kind!==null&&r.kind!==kind)||
            (state!==null&&r.currentState!==state)||
            !caseScope(identity,membership,r,now)))
          return serviceUnavailable();
        // Reuse the audited list operation; SQL rechecks the actor independently.
        await repo.recordRead({actorId:identity.subject,action:'case_list',caseId:null,lgaId});
        return respond({items:found.map(r=>({
          ...projectCase(r),evidenceAccess:'blocked_pending_safeguarding',
        })),pageLimit:limit,paginationAvailable:false,
        scope:'independent_platform_only'},200);
      }
      if(intakePath){
        if(!repo.proposeIntakeReview)return notFound();
        const caseId=intakePath[1]?.toLowerCase();
        if(!caseId||!uuid.test(caseId))return notFound();
        if(noContentType(request))return respond({error:'Expected JSON'},415);
        const payload=parseReview(await readBounded(request));
        if(!payload)return invalid();
        if(payload.kind==='assignment_review'&&
          !['platform_admin','case_manager'].includes(membership.role))return forbidden();
        if(payload.targetLgaId!==null&&
          membership.role!=='platform_admin'&&
          !membership.allowedLgaIds.includes(payload.targetLgaId))return forbidden();
        const record=await repo.findCase(caseId,identity.subject);
        if(!record||!validCase(record)||!caseScope(identity,membership,record,now))return notFound();
        if(record.revision!==payload.expectedRevision)
          return respond({error:'Case changed; reload before proposing'},409);
        const result=await repo.proposeIntakeReview({
          actorId:identity.subject,caseId:record.id,...payload,
        });
        if(result.result==='not_available')return notFound();
        if(result.result==='conflict')
          return respond({error:'Proposal conflict; reload before retrying'},409);
        if((result.result!=='queued'&&result.result!=='replayed')||
          !uuid.test(result.proposalId))return serviceUnavailable();
        return respond({proposalId:result.proposalId,
          reviewOnly:true,officeNotified:false,caseChanged:false,
          result:result.result},result.result==='queued'?201:200);
      }
      if (casesList) {
        const query = url.searchParams;
        const limitText = query.get('limit');
        if (limitText !== null && !/^(?:[1-9]|1[0-9]|2[0-5])$/.test(limitText)) return invalid();
        const limit = limitText === null ? 20 : Number(limitText);
        const lgaId = query.get('lga');
        if (lgaId !== null && !lgaSlug.test(lgaId)) return invalid();
        const permitted = membership.role === 'platform_admin' ? null : membership.allowedLgaIds;
        if (lgaId !== null && permitted !== null && !permitted.includes(lgaId)) return forbidden();
        const found = await repo.listCases({ actorId: identity.subject, allowedLgas: permitted, lgaId, limit });
        if (!Array.isArray(found) || found.length > limit || found.some(r => !validCase(r) ||
          (lgaId !== null && r.lgaId !== lgaId) || !caseScope(identity, membership, r, now)))
          return serviceUnavailable(); // Never leak any out-of-scope repository row.
        await repo.recordRead({ actorId: identity.subject, action: 'case_list', caseId: null, lgaId });
        return respond({ items: found.map(projectCase), pageLimit: limit, paginationAvailable: false }, 200);
      }
      const id = casePath?.[1];
      if (!id || !uuid.test(id)) return notFound();
      const record = await repo.findCase(id.toLowerCase(), identity.subject);
      if (!record || !validCase(record) || !caseScope(identity, membership, record, now)) return notFound();
      if (isWrite) {
        if (!authorizeAdmin({ identity, membership, capability: 'case.note',
          target: { kind: 'case', lgaId: record.lgaId }, nowSeconds: now }))
          return forbidden();
        if (noContentType(request)) return respond({ error: 'Expected JSON' }, 415);
        const payload = parseNote(await readBounded(request));
        if (!payload) return invalid();
        // One bounded, ACID operation owned by the private database repository.
        const result = await repo.createInternalNote({
          caseId: record.id, actorId: identity.subject, ...payload,
        });
        if (result.result === 'not_found') return notFound();
        if (result.result === 'conflict') return respond({ error: 'Case changed; reload before retrying' }, 409);
        if (result.result !== 'created' && result.result !== 'replayed') return serviceUnavailable();
        if (!uuid.test(result.eventId) || !Number.isSafeInteger(result.revision) || result.revision < 1)
          return serviceUnavailable();
        return respond({ eventId: result.eventId, revision: result.revision,
          replayed: result.result === 'replayed', scope: 'platform_internal' }, result.result === 'created' ? 201 : 200);
      }
      if (casePath?.[2] === 'events') {
        const events = await repo.listEvents(record.id, 50, identity.subject);
        if (!Array.isArray(events) || events.length > 50 || events.some(e =>
          !e || !uuid.test(e.id) ||
          !['intake_accepted','under_review','needs_information','closed','internal_note'].includes(e.kind) ||
          !['system','moderator'].includes(e.actorKind) ||
          Number.isNaN(Date.parse(e.createdAt)) ||
          typeof e.detail !== 'string' || e.detail.length > 500)) return serviceUnavailable();
        await repo.recordRead({ actorId: identity.subject, action: 'event_read', caseId: record.id, lgaId: record.lgaId });
        return respond({ caseId: record.id, events: events.map(e => ({
          id: e.id, kind: e.kind, actorKind: e.actorKind, createdAt: e.createdAt, detail: e.detail,
        })) }, 200);
      }
      await repo.recordRead({ actorId: identity.subject, action: 'case_read', caseId: record.id, lgaId: record.lgaId });
      return respond({ item: projectCase(record) }, 200);
    } catch (error) {
      if (error instanceof AdminAuthError) return unauthorized();
      // No staff, case, token, text or database content in errors or logs.
      return serviceUnavailable();
    }
  };
}
