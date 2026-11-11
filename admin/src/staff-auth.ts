/**
 * Browser-only staff sign-in candidate. Tokens stay in memory; never store
 * them in URLs, cookies, localStorage, sessionStorage, or analytics.
 *
 * This client only decides which screen to show. The isolated Admin Worker
 * independently verifies JWT signatures, MFA, membership and LGA permissions.
 */
export interface StaffAuthConfig {
  authUrl: string;
  publishableKey: string;
  adminOrigin: string;
}
export type StaffRole = 'platform_admin' | 'case_manager' | 'moderator' |
  'directory_reviewer' | 'government_officer' | 'auditor';
export interface StaffIdentity {
  role: StaffRole;
  allowedLgaIds: readonly string[];
  verifiedOfficeId: string | null;
  expiresAt: number;
}
export interface PrivateCase {
  id: string;
  publicReference: string;
  kind: 'Complaint' | 'Issue' | 'Commendation';
  lgaId: string;
  currentState: 'intake_accepted' | 'under_review' | 'needs_information' | 'closed';
  revision: number;
  receivedAt: string;
  updatedAt: string;
}
export interface PrivateCaseEvent {
  id: string;
  kind: string;
  actorKind: 'system' | 'moderator';
  createdAt: string;
  detail: string;
}
export type StaffSignInStep =
  | { kind: 'mfa'; provisionalToken: string; factorId: string; challengeId: string }
  | { kind: 'verified'; token: string };

export class StaffRequestError extends Error {
  constructor(readonly status: number = 0) {
    super('Staff access could not be completed');
    this.name = 'StaffRequestError';
  }
}
const id = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const slug = /^[a-z0-9][a-z0-9-]{1,63}$/;
const roles = new Set(['platform_admin','case_manager','moderator','directory_reviewer','government_officer','auditor']);
const kinds = new Set(['Complaint','Issue','Commendation']);
const states = new Set(['intake_accepted','under_review','needs_information','closed']);
function obj(value: unknown): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StaffRequestError();
  return value as Record<string,unknown>;
}
function string(value: unknown, max = 500): string {
  if (typeof value !== 'string' || value.length > max) throw new StaffRequestError();
  return value;
}
function tokenValue(value: unknown): string {
  const token = string(value,8192);
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new StaffRequestError();
  return token;
}
function assurance(token: string): string {
  try {
    const payload = token.split('.')[1]!;
    const raw = atob(payload.replace(/-/g,'+').replace(/_/g,'/') +
      '='.repeat((4 - payload.length % 4) % 4));
    return String(obj(JSON.parse(raw)).aal || '');
  } catch { throw new StaffRequestError(); }
}
function configIsValid(config: StaffAuthConfig): boolean {
  try {
    const auth = new URL(config.authUrl), admin = new URL(config.adminOrigin);
    return auth.protocol === 'https:' && auth.pathname === '/auth/v1' &&
      !auth.search && !auth.hash && !auth.username && !auth.password &&
      auth.port === '' && admin.protocol === 'https:' &&
      admin.origin === config.adminOrigin && !admin.username &&
      !admin.password && admin.port === '' &&
      config.publishableKey.length >= 20 && config.publishableKey.length <= 2500;
  } catch { return false; }
}
async function responseJson(response: Response): Promise<Record<string,unknown>> {
  if (!response.ok) throw new StaffRequestError(response.status);
  if (response.redirected || response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
    throw new StaffRequestError();
  try { return obj(await response.json()); }
  catch { throw new StaffRequestError(); }
}
function caseRecord(input: unknown): PrivateCase {
  const r = obj(input);
  const row: PrivateCase = {
    id:string(r.id,36), publicReference:string(r.publicReference,36),
    kind:string(r.kind,20) as PrivateCase['kind'],
    lgaId:string(r.lgaId,64), currentState:string(r.currentState,30) as PrivateCase['currentState'],
    revision:Number(r.revision), receivedAt:string(r.receivedAt,50),
    updatedAt:string(r.updatedAt,50),
  };
  if (!id.test(row.id) || !id.test(row.publicReference) || !kinds.has(row.kind) ||
    !slug.test(row.lgaId) || !states.has(row.currentState) ||
    !Number.isSafeInteger(row.revision) || row.revision < 1 ||
    Number.isNaN(Date.parse(row.receivedAt)) || Number.isNaN(Date.parse(row.updatedAt)))
    throw new StaffRequestError();
  return row;
}
function caseEvent(input: unknown): PrivateCaseEvent {
  const r = obj(input);
  const event = {
    id:string(r.id,36), kind:string(r.kind,40),
    actorKind:string(r.actorKind,20) as PrivateCaseEvent['actorKind'],
    createdAt:string(r.createdAt,50), detail:string(r.detail,500),
  };
  if (!id.test(event.id) ||
    !['intake_accepted','under_review','needs_information','closed','internal_note'].includes(event.kind) ||
    !['system','moderator'].includes(event.actorKind) ||
    Number.isNaN(Date.parse(event.createdAt))) throw new StaffRequestError();
  return event;
}

export function createStaffAuthClient(config: StaffAuthConfig, fetcher: typeof fetch = fetch) {
  if (!configIsValid(config)) throw new StaffRequestError();
  const auth = config.authUrl;
  const baseHeaders = { 'apikey': config.publishableKey, 'Content-Type': 'application/json' };
  const common = { cache:'no-store' as RequestCache, credentials:'omit' as RequestCredentials,
    redirect:'error' as RequestRedirect, referrerPolicy:'no-referrer' as ReferrerPolicy };
  const authPost = async (path: string, body: unknown, bearer?: string) =>
    responseJson(await fetcher(auth + path, {
      ...common, method:'POST',
      headers:{...baseHeaders, ...(bearer ? {Authorization:'Bearer ' + tokenValue(bearer)} : {})},
      body:JSON.stringify(body),
    }));
  const apiGet = async (path: string, bearer: string) =>
    responseJson(await fetcher(config.adminOrigin + '/admin/api/' + path, {
      ...common, method:'GET', headers:{ Authorization:'Bearer ' + tokenValue(bearer) },
    }));
  return {
    async signIn(email: string, password: string): Promise<StaffSignInStep> {
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !password || password.length > 4096) throw new StaffRequestError();
      const session = await authPost('/token?grant_type=password',{email,password});
      const provisionalToken = tokenValue(session.access_token);
      if (assurance(provisionalToken) === 'aal2') return {kind:'verified',token:provisionalToken};
      if (assurance(provisionalToken) !== 'aal1') throw new StaffRequestError();
      const user = await responseJson(await fetcher(auth + '/user',{
        ...common,method:'GET',
        headers:{apikey:config.publishableKey,Authorization:'Bearer ' + provisionalToken},
      }));
      const factors = user.factors;
      if (!Array.isArray(factors)) throw new StaffRequestError();
      const verifiedFactors = factors.filter(item => {
        if (!item || typeof item !== 'object') return false;
        const factor = item as Record<string,unknown>;
        return factor.factor_type === 'totp' && factor.status === 'verified' &&
          typeof factor.id === 'string' && id.test(factor.id);
      });
      if (verifiedFactors.length !== 1) throw new StaffRequestError(403);
      const factorId = string((verifiedFactors[0] as Record<string,unknown>).id,36);
      const challenge = await authPost('/factors/' + factorId + '/challenge',{},provisionalToken);
      const challengeId = string(challenge.id,36);
      if (!id.test(challengeId)) throw new StaffRequestError();
      return {kind:'mfa',provisionalToken,factorId,challengeId};
    },
    async verifyMfa(input: Extract<StaffSignInStep,{kind:'mfa'}>, code: string): Promise<string> {
      if (!id.test(input.factorId) || !id.test(input.challengeId) || !/^\d{6}$/.test(code))
        throw new StaffRequestError();
      const verified = await authPost('/factors/' + input.factorId + '/verify',
        {challenge_id:input.challengeId,code},input.provisionalToken);
      const token = tokenValue(verified.access_token);
      if (assurance(token) !== 'aal2') throw new StaffRequestError(401);
      return token;
    },
    async me(token: string): Promise<StaffIdentity> {
      const response = await apiGet('me',token);
      const identity = obj(response.identity), membership = obj(response.membership);
      const role = string(membership.role,40);
      if (identity.assurance !== 'aal2' || !roles.has(role) ||
        !Array.isArray(membership.allowedLgaIds) ||
        membership.allowedLgaIds.length > 16 ||
        !membership.allowedLgaIds.every(lga => typeof lga === 'string' && slug.test(lga)) ||
        !(membership.verifiedOfficeId === null ||
          (typeof membership.verifiedOfficeId === 'string' && membership.verifiedOfficeId.length <= 120)) ||
        !Number.isSafeInteger(identity.expiresAt) || (identity.expiresAt as number) <= Date.now()/1000)
        throw new StaffRequestError();
      return {
        role:role as StaffRole, allowedLgaIds:membership.allowedLgaIds as string[],
        verifiedOfficeId:membership.verifiedOfficeId as string|null,
        expiresAt:identity.expiresAt as number,
      };
    },
    async listCases(token: string): Promise<readonly PrivateCase[]> {
      const payload = await apiGet('cases?limit=20',token);
      if (!Array.isArray(payload.items) || payload.items.length > 20) throw new StaffRequestError();
      return payload.items.map(caseRecord);
    },
    async events(token: string, caseId: string): Promise<readonly PrivateCaseEvent[]> {
      if (!id.test(caseId)) throw new StaffRequestError();
      const payload = await apiGet('cases/' + caseId + '/events',token);
      if (payload.caseId !== caseId || !Array.isArray(payload.events) || payload.events.length > 50)
        throw new StaffRequestError();
      return payload.events.map(caseEvent);
    },
    async signOut(token: string): Promise<void> {
      try { await authPost('/logout',{},token); } catch { /* Local memory is cleared regardless. */ }
    },
  };
}
