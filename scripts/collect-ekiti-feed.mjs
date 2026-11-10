import { createHash } from 'node:crypto';
import { parseOfficialFeed } from '../src/server/ask.ts';
import { NEWS_CATEGORY_FEED, NEWS_FEED } from '../src/server/ask-knowledge.ts';

const MAX_BYTES = 160_000;
export const APPROVED_FEEDS = [NEWS_CATEGORY_FEED, NEWS_FEED];

/** One small, allowlisted feed at a time; no arbitrary URLs or article-body crawling. */
export async function collectCandidates(fetcher = fetch, now = new Date()) {
  let feed = '';
  let records: ReturnType<typeof parseOfficialFeed> = [];
  for (const url of APPROVED_FEEDS) {
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { Accept: 'application/rss+xml' },
        signal: AbortSignal.timeout(3500), redirect: 'error',
      });
      if (!response.ok || !response.body) continue;
      const reported = Number(response.headers.get('content-length') || 0);
      if (reported > MAX_BYTES) continue;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > MAX_BYTES) break;
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      if (bytes > MAX_BYTES) continue;
      const xml = new TextDecoder().decode(
        Uint8Array.from(chunks.flatMap(chunk => Array.from(chunk))));
      const parsed = parseOfficialFeed(xml, now);
      if (!parsed.length) continue;
      records = parsed;
      feed = url;
      break;
    } catch { /* Failed source is not proof of no news. */ }
  }
  const seen = new Set<string>();
  const candidates = records.filter(record => {
    if (seen.has(record.url)) return false;
    seen.add(record.url);
    return true;
  }).map(record => ({
    fingerprint: createHash('sha256').update(record.url).digest('hex'),
    sourceId: 'ekiti-state-official',
    sourceUrl: record.url,
    publisher: record.publisher,
    title: record.title,
    publishedOn: record.published,
    reviewState: 'pending',
    // Reviewer must write original summary, assess licensing and compare with other sources.
    summaryEn: null,
    framing: 'source_claim',
  }));
  return {
    feed, checkedAt: now.toISOString(),
    status: candidates.length ? 'candidates-pending-review' : 'source-unavailable-or-no-dated-posts',
    candidates,
  };
}
