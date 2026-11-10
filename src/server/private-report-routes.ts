/**
 * Opt-in, independently rate-limited private reporting API.
 *
 * In production and staging this handler is **inert** unless a reviewed
 * operator explicitly configures all private bindings and a consent policy.
 * The existing public location reader is never used for private reports.
 */
import pg from 'pg';
import { parseReportInput, ReportInputError, MAX_REPORT_BYTES } from '../reporting/intake-contract.ts';
import { parseTrackRequest, ReceiptAccessError } from '../reporting/receipt-crypto.ts';
import { createPrivateReport, readPrivateTimeline, CaseStoreError, type Queryable } from '../reporting/private-case-store.ts';

export interface PrivateReportingEnv {
  REPORTING_ENABLED?: string;
  REPORTING_HYPERDRIVE?: { connectionString: string };
  REPORTING_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  REPORTING_POLICY_VERSION?: string;
  REPORTING_RETENTION_DAYS?: string;
}

export type ReportDatabaseFactory = (connectionString: string) => Promise<{
  db: Queryable;
  close: () => Promise<void>;
}>;

async function openPostgres(connectionString: string): ReturnType<ReportDatabaseFactory> {
  const client = new pg.Client({
    connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000,
    statement_timeout: 5000,
  });
  await client.connect();
  return {
    db: {
      async query<T>(statement: string, parameters?: unknown[]) {
        const result = await client.query(statement, parameters);
        return { rows: result.rows as T[], rowCount: result.rowCount };
      },
    },
    close: () => client.end(),
  };
}

const privateHeaders: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

function json(data: unknown, status: number, extra: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...privateHeaders, ...extra } });
}

async function readBody(request: Request, maxBytes: number): Promise<string | null> {
  const stated = request.headers.get('Content-Length');
  if (stated !== null && (!/^\d+$/u.test(stated) || Number(stated) > maxBytes)) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '', bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); return null; }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    return null;
  }
}

export async function handlePrivateReporting(
  request: Request, env: PrivateReportingEnv,
  openDatabase: ReportDatabaseFactory = openPostgres,
): Promise<Response> {
  // Fail closed without inspecting the request body, contacting a database,
  // or consuming any live case information.
  if (env.REPORTING_ENABLED !== 'true') return json({ error: 'Unknown route' }, 404);

  const url = new URL(request.url);
  const intake = url.pathname === '/api/reports';
  const tracking = url.pathname === '/api/tracking';
  if (!intake && !tracking || url.search || url.hash)
    return json({ error: 'Unknown route' }, 404);
  if (request.method !== 'POST')
    return json({ error: 'Unsupported method' }, 405, { Allow: 'POST' });
  const origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site')
    return json({ error: 'Cross-site request denied' }, 403);
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
    return json({ error: 'Expected JSON' }, 415);

  const policy = env.REPORTING_POLICY_VERSION;
  const retention = Number(env.REPORTING_RETENTION_DAYS);
  if (!env.REPORTING_HYPERDRIVE?.connectionString || !env.REPORTING_LIMIT || !policy?.trim() ||
      !Number.isInteger(retention) || retention < 1 || retention > 365)
    return json({ error: 'Secure intake unavailable' }, 503);
  try {
    // Rate limits are separate from public geo/knowledge traffic.
    const key = request.headers.get('CF-Connecting-IP') || 'local';
    if (!(await env.REPORTING_LIMIT.limit({ key })).success)
      return json({ error: 'Please try again later' }, 429, { 'Retry-After': '60' });
  } catch {
    return json({ error: 'Secure intake unavailable' }, 503);
  }

  const body = await readBody(request, intake ? MAX_REPORT_BYTES : 256);
  if (body === null) return json({ error: 'Invalid request size or encoding' }, 413);
  let validated: ReturnType<typeof parseReportInput> | null = null;
  let access: ReturnType<typeof parseTrackRequest> | null = null;
  try {
    if (intake) validated = parseReportInput(body, policy);
    else access = parseTrackRequest(body);
  } catch (error) {
    if (error instanceof ReportInputError)
      return json({ error: error.code }, error.code === 'payload_too_large' ? 413 : 400);
    // Do not reveal whether a public reference exists or a secret is valid.
    if (error instanceof ReceiptAccessError) return json({ error: 'Reference not found' }, 404);
    return json({ error: 'Invalid request' }, 400);
  }

  let connection: Awaited<ReturnType<ReportDatabaseFactory>> | undefined;
  try {
    connection = await openDatabase(env.REPORTING_HYPERDRIVE.connectionString);
    if (validated) {
      const receipt = await createPrivateReport(connection.db, validated, retention);
      // Only issue after COMMIT. No attachment, auto-routing or government
      // delivery takes place; this is a platform intake confirmation.
      return json(receipt, 201);
    }
    if (!access) return json({ error: 'Reference not found' }, 404);
    const timeline = await readPrivateTimeline(connection.db, access.reference, access.secret);
    return json(timeline, 200);
  } catch (error) {
    if (error instanceof CaseStoreError) {
      if (error.code === 'duplicate_request') return json({ error: 'Request already recorded; cannot reissue receipt secret' }, 409);
      if (error.code === 'invalid_location') return json({ error: 'Invalid LGA or ward' }, 400);
      if (error.code === 'not_found') return json({ error: 'Reference not found' }, 404);
    }
    // No stacktrace, narrative, token, SQL or contact information in responses.
    return json({ error: 'Secure intake unavailable' }, 503);
  } finally {
    if (connection) {
      try { await connection.close(); } catch { /* No private data in logs. */ }
    }
  }
}
