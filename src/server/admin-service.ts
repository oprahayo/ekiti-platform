import pg from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';
import { createAdminGateway, type AdminGatewayOptions } from './admin-gateway.ts';
import {
  createPrivatePostgresRepository, type RestrictedQueryClient,
} from './admin-postgres.ts';

/**
 * Optional SECOND Worker entrypoint. Deliberately not referenced by the public
 * Worker, staging configuration, or deployment workflow.
 *
 * No administration runs unless all explicit settings, separate database
 * binding, and BOTH independent rate-limiting bindings are present.
 */
export interface AdminServiceEnv {
  ADMIN_API_ENABLED?: string;
  ADMIN_ORIGIN?: string;
  ADMIN_ISSUER?: string;
  ADMIN_AUDIENCE?: string;
  ADMIN_PRIVATE_HYPERDRIVE?: { connectionString: string };
  ADMIN_PREAUTH_LIMIT?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  ADMIN_STAFF_LIMIT?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
export interface AdminDatabaseSession {
  client: RestrictedQueryClient;
  close(): Promise<void>;
}
export interface AdminServiceDependencies {
  fetchJwks?: typeof fetch;
  openDatabase?: (connectionString: string) => Promise<AdminDatabaseSession>;
}

function json(data: unknown, status: number): Response {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  } });
}
function config(env: AdminServiceEnv): {
  origin: string; issuer: string; audience: string; jwksUrl: string; connectionString: string;
} | null {
  if (env.ADMIN_API_ENABLED !== 'yes' || !env.ADMIN_ORIGIN ||
    !env.ADMIN_ISSUER || env.ADMIN_AUDIENCE !== 'authenticated' ||
    !env.ADMIN_PRIVATE_HYPERDRIVE?.connectionString ||
    !env.ADMIN_PREAUTH_LIMIT || !env.ADMIN_STAFF_LIMIT) return null;
  try {
    const origin = new URL(env.ADMIN_ORIGIN);
    const issuer = new URL(env.ADMIN_ISSUER);
    // Support only pinned Supabase Auth issuer. No attacker-injected key URL,
    // localhost issuer, redirects, userinfo, queries or fragments.
    if (origin.protocol !== 'https:' || origin.origin !== env.ADMIN_ORIGIN ||
      origin.username || origin.password ||
      issuer.protocol !== 'https:' || issuer.pathname !== '/auth/v1' ||
      issuer.username || issuer.password || issuer.search || issuer.hash ||
      !/^[a-z0-9.-]+$/i.test(issuer.hostname) ||
      issuer.port !== '' || origin.port !== '')
      return null;
    return { origin: env.ADMIN_ORIGIN, issuer: env.ADMIN_ISSUER,
      audience: env.ADMIN_AUDIENCE,
      jwksUrl: issuer.origin + '/auth/v1/.well-known/jwks.json',
      connectionString: env.ADMIN_PRIVATE_HYPERDRIVE.connectionString };
  } catch { return null; }
}
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok || response.redirected || response.status !== 200 ||
    response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
    throw new Error('Trusted issuer JWKS is unavailable');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Trusted issuer returned an empty key set');
  const pieces: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > 16384) {
        await reader.cancel();
        throw new Error('Trusted issuer key set too large');
      }
      pieces.push(value);
    }
    const bytes = new Uint8Array(count);
    let offset = 0;
    for (const part of pieces) { bytes.set(part,offset); offset += part.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally { reader.releaseLock(); }
}
async function readTrustedKey(
  jwksUrl: string, kid: string, fetcher: typeof fetch,
): Promise<JsonWebKey | null> {
  // JWKS must be fetched from the configured issuer only. Never inspect a
  // client-provided jku, x5u, embedded JWK, or Bearer token's suggested URL.
  const response = await fetcher(jwksUrl, {
    method: 'GET', redirect: 'error', cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(3000),
  });
  const value = await boundedJson(response);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = (value as {keys?:unknown}).keys;
  if (!Array.isArray(keys) || keys.length > 12) return null;
  const matching = keys.filter(x => x && typeof x === 'object' &&
    (x as JsonWebKey).kid === kid);
  if (matching.length !== 1) return null;
  const key = matching[0] as JsonWebKey;
  return key.kty === 'RSA' || key.kty === 'EC' ? key : null;
}
async function openDefaultDatabase(connectionString: string): Promise<AdminDatabaseSession> {
  const client = new pg.Client({
    connectionString, connectionTimeoutMillis: 4000,
    query_timeout: 4000, statement_timeout: 4000,
  });
  await client.connect();
  return {
    client: {
      async query<R extends QueryResultRow = QueryResultRow>(
        sql: string, values?: readonly unknown[],
      ): Promise<QueryResult<R>> {
        return client.query<R>(sql, values ? [...values] : []);
      },
    },
    close: () => client.end(),
  };
}

export function createAdminService(
  env: AdminServiceEnv, deps: AdminServiceDependencies = {},
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const ready = config(env);
    if (!ready) return json({error:'Not found'},404);
    const url = new URL(request.url);
    // The private service MUST be bound to a separate host, even in tests.
    if (url.origin !== ready.origin || !url.pathname.startsWith('/admin/api/'))
      return json({error:'Not found'},404);
    try {
      const source = request.headers.get('CF-Connecting-IP') || 'unavailable';
      const preflight = await env.ADMIN_PREAUTH_LIMIT!.limit({ key:'admin:pre:' + source });
      if (!preflight.success) return json({error:'Rate limited'},429);
    } catch { return json({error:'Administrative service unavailable'},503); }

    // Authentication failures do not create a database connection.
    // The database adapter lazy-opens on the first membership query.
    let session: AdminDatabaseSession | null = null;
    const database: RestrictedQueryClient = {
      async query<R extends QueryResultRow = QueryResultRow>(
        sql: string, values?: readonly unknown[],
      ): Promise<QueryResult<R>> {
        if (!session) {
          session = await (deps.openDatabase ?? openDefaultDatabase)(ready.connectionString);
        }
        return session.client.query<R>(sql,values);
      },
    };
    const options: AdminGatewayOptions = {
      enabled:true, origin:ready.origin,
      jwt: {
        issuer:ready.issuer, audience:ready.audience,
        getPublicKey: async kid =>
          readTrustedKey(ready.jwksUrl,kid,deps.fetchJwks ?? fetch),
      },
      repository:createPrivatePostgresRepository(database),
      limit: {
        check:async ({actorId,operation}) =>
          (await env.ADMIN_STAFF_LIMIT!.limit({
            key:'admin:' + operation + ':' + actorId,
          })).success,
      },
    };
    try {
      return await createAdminGateway(options)(request);
    } finally {
      if (session) await (session as AdminDatabaseSession).close();
    }
  };
}

export default {
  fetch(request: Request, env: AdminServiceEnv): Promise<Response> {
    return createAdminService(env)(request);
  },
};
