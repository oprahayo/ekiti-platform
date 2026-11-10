import pg from 'pg';
import { resolveIncidentLocation } from './location.ts';
import { answerQuestion } from './ask.ts';

interface Env {
  HYPERDRIVE: { connectionString: string };
  LOCATION_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

async function readPoint(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  const point = JSON.parse(text + decoder.decode());
  if (
    !point ||
    point.confirmed !== true ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  )
    return null;
  return { latitude: point.latitude as number, longitude: point.longitude as number };
}


async function readAsk(request: Request): Promise<{ question: string; language: 'en' | 'yo' } | null> {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 1500) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1500) { await reader.cancel(); return null; }
    text += decoder.decode(value, { stream: true });
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text + decoder.decode()); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== 'question' && key !== 'language')) return null;
  if (typeof value.question !== 'string' || value.question.trim().length < 2 || value.question.trim().length > 400 ||
      Array.from(value.question).some(character => character.charCodeAt(0) < 32)) return null;
  if (value.language !== 'en' && value.language !== 'yo') return null;
  return { question: value.question.trim(), language: value.language };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const directory = url.pathname === '/api/areas';
    const ask = url.pathname === '/api/ask';
    if ((!directory && !ask && url.pathname !== '/api/resolve') || url.search)
      return json({ error: 'Unknown route' }, 404);
    const method = directory ? 'GET' : 'POST';
    if (request.method !== method)
      return json({ error: 'Unsupported method' }, 405, { Allow: method });
    const origin = request.headers.get('Origin');
    if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site')
      return json({ error: 'Cross-site request denied' }, 403);
    try {
      const key = request.headers.get('CF-Connecting-IP') || 'local';
      if (!(await env.LOCATION_LIMIT.limit({ key })).success)
        return json({ error: 'Please try again in a minute' }, 429, { 'Retry-After': '60' });
      let point = null;
      if (!directory) {
        if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
          return json({ error: 'Expected JSON' }, 415);
        if (ask) {
          const data = await readAsk(request).catch(() => null);
          if (!data) return json({ error: 'Expected a short question and language en or yo' }, 400);
          return json(await answerQuestion(data.question, data.language));
        }
        point = await readPoint(request).catch(() => null);
        if (!point) return json({ error: 'Expected a confirmed, valid coordinate pair' }, 400);
      }
      const client = new pg.Client({
        connectionString: env.HYPERDRIVE.connectionString,
        connectionTimeoutMillis: 5000,
        query_timeout: 5000,
      });
      try {
        await client.connect();
        if (point)
          return json(await resolveIncidentLocation(client, point.latitude, point.longitude));
        return json((await client.query('SELECT * FROM geo.location_directory()')).rows);
      } finally {
        await client.end();
      }
    } catch {
      return json({ error: 'Service temporarily unavailable' }, 503);
    }
  },
};
