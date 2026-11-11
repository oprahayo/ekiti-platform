/**
 * Standalone verification primitive for a FUTURE invite-only admin Worker.
 * Not imported by the public Worker and not wired to any deployment.
 * Staff privileges are NEVER accepted from JWT custom claims or the browser.
 */
export interface VerifiedAdminIdentity {
  subject: string;
  expiresAt: number;
  assurance: 'aal2';
}
export interface AdminJwtConfig {
  issuer: string;
  audience: string;
  /**
   * Must resolve through a pinned, HTTPS trusted issuer JWKS source.
   * No caller-supplied URL or client-supplied JWK is permitted.
   */
  getPublicKey: (kid: string) => Promise<JsonWebKey | null>;
  nowSeconds?: number;
}
export class AdminAuthError extends Error {
  constructor() { super('Unauthorized'); this.name = 'AdminAuthError'; }
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function binary(value: string): Uint8Array<ArrayBuffer> {
  if (!value || value.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(value))
    throw new AdminAuthError();
  const normal = value.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const data = atob(normal + '='.repeat((4 - normal.length % 4) % 4));
    const bytes = new Uint8Array(new ArrayBuffer(data.length));
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
    return bytes;
  } catch { throw new AdminAuthError(); }
}
function jsonPart(part: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(binary(part)));
    if (!record(value)) throw new AdminAuthError();
    return value;
  } catch { throw new AdminAuthError(); }
}
function authAlgorithm(alg: string): RsaHashedImportParams | EcKeyImportParams {
  if (alg === 'RS256') return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  if (alg === 'ES256') return { name: 'ECDSA', namedCurve: 'P-256' };
  throw new AdminAuthError();
}
function verifyAlgorithm(alg: string): AlgorithmIdentifier | EcdsaParams {
  return alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5';
}
export async function verifyAdminJwt(token: string, config: AdminJwtConfig): Promise<VerifiedAdminIdentity> {
  if (!token || token.length > 8192 || !config.issuer.startsWith('https://') ||
    !config.audience || typeof config.getPublicKey !== 'function') throw new AdminAuthError();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) throw new AdminAuthError();
  const header = jsonPart(parts[0]!);
  const claims = jsonPart(parts[1]!);
  const { alg, kid, typ } = header;
  if (typeof alg !== 'string' || (alg !== 'ES256' && alg !== 'RS256') ||
    typeof kid !== 'string' || !/^[\w-]{1,128}$/.test(kid) ||
    (typ !== undefined && typ !== 'JWT')) throw new AdminAuthError();

  // getPublicKey MUST be a server-owned trusted JWKS resolver; no JWK from request.
  let jwk: JsonWebKey | null;
  try { jwk = await config.getPublicKey(kid); } catch { throw new AdminAuthError(); }
  if (!jwk || 'd' in jwk || (jwk.alg && jwk.alg !== alg) ||
    (jwk.use && jwk.use !== 'sig') ||
    (jwk.key_ops && !jwk.key_ops.includes('verify')) ||
    (alg === 'ES256' && (jwk.kty !== 'EC' || jwk.crv !== 'P-256')) ||
    (alg === 'RS256' && jwk.kty !== 'RSA')) throw new AdminAuthError();

  let valid = false;
  try {
    const publicKey = await crypto.subtle.importKey('jwk', jwk, authAlgorithm(alg), false, ['verify']);
    valid = await crypto.subtle.verify(verifyAlgorithm(alg), publicKey,
      binary(parts[2]!), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  } catch { throw new AdminAuthError(); }
  if (!valid) throw new AdminAuthError();

  const now = config.nowSeconds ?? Math.floor(Date.now() / 1000);
  const exp = claims.exp, iat = claims.iat, nbf = claims.nbf;
  if (typeof claims.iss !== 'string' || claims.iss !== config.issuer ||
    !(claims.aud === config.audience || (Array.isArray(claims.aud) &&
      claims.aud.includes(config.audience))) ||
    claims.role !== 'authenticated' || claims.aal !== 'aal2' ||
    typeof claims.sub !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(claims.sub) ||
    typeof exp !== 'number' || !Number.isInteger(exp) ||
    typeof iat !== 'number' || !Number.isInteger(iat) ||
    exp <= now || iat > now + 30 || exp - iat > 3600 || exp <= iat ||
    (nbf !== undefined && (typeof nbf !== 'number' || !Number.isInteger(nbf) || nbf > now + 30)))
    throw new AdminAuthError();

  return Object.freeze({ subject: claims.sub, expiresAt: exp, assurance: 'aal2' });
}
