/* Browser-only Supabase Auth + RPC. No service-role key, passwords or Worker writes.
 * The publishable key and project URL are safe public config, never use secret keys.
 * No account requests are made unless explicitly configured and the user acts.
 */
export interface PublicAuthConfig { url: string; key: string }
export interface CitizenIdentity { id: string; email: string }
export interface CitizenSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  identity: CitizenIdentity;
}
export const SESSION_KEY = 'ekiti-civic-email-session-tab-v1';

export function configuredAuth(): PublicAuthConfig | null {
  const env = (import.meta as ImportMeta & { env?: Record<string,string|undefined> }).env;
  const url = env?.VITE_SUPABASE_URL || '';
  const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname) ||
        parsed.username || parsed.password || parsed.pathname !== '/') return null;
    if (!key || key.length < 15 || key.startsWith('sb_secret_') || /\s/.test(key)) return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}
function emailOk(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function sessionOk(value: unknown): value is CitizenSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CitizenSession>;
  return typeof v.access_token === 'string' && v.access_token.length > 24 &&
    typeof v.refresh_token === 'string' && v.refresh_token.length > 15 &&
    typeof v.expires_at === 'number' && Number.isFinite(v.expires_at) &&
    typeof v.identity?.id === 'string' && /^[a-f0-9-]{36}$/i.test(v.identity.id) &&
    typeof v.identity?.email === 'string' && emailOk(v.identity.email);
}
export function readTabSession(): CitizenSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return sessionOk(parsed) ? parsed : null;
  } catch { return null; }
}
export function saveTabSession(session: CitizenSession | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* Guest browsing remains available. */ }
}
async function authFetch(config: PublicAuthConfig, path: string,
  body: Record<string,unknown> | null, bearer?: string, method = 'POST',
  fetcher: typeof fetch = fetch): Promise<unknown> {
  const headers: Record<string,string> = { apikey: config.key, 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = 'Bearer ' + bearer;
  const response = await fetcher(config.url + path, {
    method, headers, cache: 'no-store', signal: AbortSignal.timeout(12000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('Too many attempts. Try again later.');
    if (response.status === 401 || response.status === 403) throw new Error('Your session is not authorized. Please sign in again.');
    if (response.status === 400 || response.status === 422)
      throw new Error('That code or request was not accepted. Check it and try again.');
    throw new Error('Sign-in service is temporarily unavailable.');
  }
  return response.status === 204 || response.headers.get('content-length') === '0'
    ? null : response.json();
}
export async function requestEmailCode(config: PublicAuthConfig,email: string,
  fetcher: typeof fetch = fetch) {
  if (!emailOk(email.trim())) throw new Error('Enter a valid email address.');
  await authFetch(config,'/auth/v1/otp',{ email: email.trim(), create_user: true },undefined,'POST',fetcher);
}
function toSession(data: unknown): CitizenSession {
  if (!data || typeof data !== 'object') throw new Error('No usable session was returned.');
  const result = data as Record<string,unknown>;
  const user = result.user as Record<string,unknown> | undefined;
  const token = result.access_token;
  const refresh = result.refresh_token;
  const seconds = result.expires_in;
  const candidate: CitizenSession = {
    access_token: typeof token === 'string' ? token : '',
    refresh_token: typeof refresh === 'string' ? refresh : '',
    expires_at: Math.floor(Date.now()/1000) + (typeof seconds === 'number' ? seconds : 3600),
    identity: {
      id: typeof user?.id === 'string' ? user.id : '',
      email: typeof user?.email === 'string' ? user.email : '',
    },
  };
  if (!sessionOk(candidate)) throw new Error('No usable session was returned.');
  return candidate;
}
export async function verifyEmailCode(config: PublicAuthConfig,email: string,code: string,
  fetcher: typeof fetch = fetch): Promise<CitizenSession> {
  if (!emailOk(email.trim()) || !/^[0-9]{6,8}$/.test(code.trim()))
    throw new Error('Enter the email and its six-digit code.');
  return toSession(await authFetch(config,'/auth/v1/verify',
    { email: email.trim(),token: code.trim(),type:'email' },undefined,'POST',fetcher));
}
export async function refreshSession(config: PublicAuthConfig,session: CitizenSession,
  fetcher: typeof fetch = fetch): Promise<CitizenSession> {
  const value = await authFetch(config,'/auth/v1/token?grant_type=refresh_token',
    {refresh_token:session.refresh_token},undefined,'POST',fetcher);
  return toSession(value);
}
export async function authenticateSession(config: PublicAuthConfig,session: CitizenSession,
  fetcher: typeof fetch = fetch): Promise<CitizenSession> {
  const value = session.expires_at - Math.floor(Date.now()/1000) < 60
    ? await refreshSession(config,session,fetcher) : session;
  const user = await authFetch(config,'/auth/v1/user',null,value.access_token,'GET',fetcher) as Record<string,unknown>;
  if (user?.id !== value.identity.id || user?.email !== value.identity.email)
    throw new Error('Session verification failed.');
  return value;
}
export async function signOutSession(config: PublicAuthConfig,session: CitizenSession,
  fetcher: typeof fetch = fetch) {
  try { await authFetch(config,'/auth/v1/logout',null,session.access_token,'POST',fetcher); }
  catch { /* Local logout must still clear session. Token expires server-side. */ }
}
export async function authorizedRpc<T>(config: PublicAuthConfig,session: CitizenSession,
  procedure: 'civic_submit_review' | 'civic_request_claim' | 'civic_my_reviews' | 'civic_my_claims',
  body: Record<string,unknown>, fetcher: typeof fetch = fetch): Promise<T> {
  const value = await authenticateSession(config,session,fetcher);
  const result = await authFetch(config,'/rest/v1/rpc/' + procedure,
    body,value.access_token,'POST',fetcher);
  return result as T;
}
