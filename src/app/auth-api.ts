/* Browser-only Supabase Auth + RPC. No service-role key, passwords or Worker writes.
 * The publishable key and project URL are safe public config, never use secret keys.
 * No account requests are made unless explicitly configured and the user acts.
 */
export interface PublicAuthConfig { url: string; key: string }
export interface CitizenIdentity { id: string; email: string; phone?: string }
export function phoneOk(value:string):boolean {
  // E.164 only. Never guess country codes or send ambiguous domestic numbers.
  return /^\+[1-9][0-9]{7,14}$/.test(value);
}
export function phoneOtpEnabled():boolean {
  const env=(import.meta as ImportMeta & { env?:Record<string,string|undefined> }).env;
  return Boolean(configuredAuth()&&env?.VITE_CITIZEN_SMS_OTP_ENABLED==='true');
}
export function privateHistoryEnabled():boolean {
  const env=(import.meta as ImportMeta & { env?:Record<string,string|undefined> }).env;
  return Boolean(configuredAuth()&&env?.VITE_CITIZEN_REPORT_LINKING_ENABLED==='true');
}
export function caseLinkEnabled():boolean{
  const env=(import.meta as ImportMeta & { env?:Record<string,string|undefined> }).env;
  return Boolean(privateHistoryEnabled()&&env?.VITE_CITIZEN_CASE_LINKS_ENABLED==='true');
}
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
    if (!key || key.length < 15 || /\s/.test(key)) return null;
    // Only Supabase publishable/legacy anon credentials are safe to bundle.
    // Never bundle a service_role JWT even if an operator mislabels the env var.
    let safeKey = key.startsWith('sb_publishable_');
    if (!safeKey && key.split('.').length === 3) {
      try {
        const part = key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
        const payload = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4,'='))) as { role?: unknown };
        safeKey = payload.role === 'anon';
      } catch { safeKey = false; }
    }
    if (!safeKey) return null;
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
    typeof v.identity?.email === 'string' &&
    (emailOk(v.identity.email) ||
     (v.identity.email === '' && typeof v.identity.phone === 'string' && phoneOk(v.identity.phone)));
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
      ...(typeof user?.phone === 'string' && phoneOk(user.phone)?{phone:user.phone}:{}),
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
export async function requestSmsCode(config:PublicAuthConfig,phone:string,
  fetcher:typeof fetch=fetch):Promise<void>{
  if(!phoneOtpEnabled())throw new Error('Phone verification has not been enabled.');
  if(!phoneOk(phone))throw new Error('Enter a phone number with country code, such as +234…');
  await authFetch(config,'/auth/v1/otp',{phone,create_user:true,channel:'sms'},undefined,'POST',fetcher);
}
export async function verifySmsCode(config:PublicAuthConfig,phone:string,code:string,
  fetcher:typeof fetch=fetch):Promise<CitizenSession>{
  if(!phoneOtpEnabled())throw new Error('Phone verification has not been enabled.');
  if(!phoneOk(phone)||!/^[0-9]{6,8}$/.test(code.trim()))
    throw new Error('Enter the phone number and a valid one-time code.');
  const result=toSession(await authFetch(config,'/auth/v1/verify',
    {phone,token:code.trim(),type:'sms'},undefined,'POST',fetcher));
  if(result.identity.phone!==phone)throw new Error('Phone verification did not match.');
  return result;
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
  if (user?.id !== value.identity.id ||
      (value.identity.email && user?.email !== value.identity.email) ||
      (!value.identity.email && user?.phone !== value.identity.phone))
    throw new Error('Session verification failed.');
  return value;
}
export async function signOutSession(config: PublicAuthConfig,session: CitizenSession,
  fetcher: typeof fetch = fetch) {
  try { await authFetch(config,'/auth/v1/logout',null,session.access_token,'POST',fetcher); }
  catch { /* Local logout must still clear session. Token expires server-side. */ }
}
export async function authorizedRpc<T>(config: PublicAuthConfig,session: CitizenSession,
  procedure: 'civic_submit_review' | 'civic_request_claim' | 'civic_my_reviews' | 'civic_my_claims' |
    'civic_link_private_report' | 'civic_my_private_reports' | 'civic_unlink_private_report' |
    'civic_request_case_link' | 'civic_redeem_case_link',
  body: Record<string,unknown>, fetcher: typeof fetch = fetch): Promise<T> {
  const value = await authenticateSession(config,session,fetcher);
  saveTabSession(value);
  const result = await authFetch(config,'/rest/v1/rpc/' + procedure,
    body,value.access_token,'POST',fetcher);
  return result as T;
}
