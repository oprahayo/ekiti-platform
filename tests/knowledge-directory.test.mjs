import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseKnowledgeFilters, parseDirectoryFilters, parsePublicPlaceId, PublicQueryError,
} from '../src/server/public-data.ts';
import { collectCandidates } from '../scripts/collect-ekiti-feed.mjs';
import worker from '../src/server/worker.ts';

test('public search validates query sizes, filters, repeated keys and category names', () => {
  assert.deepEqual(parseKnowledgeFilters(new URLSearchParams('q=Ekiti+budget&limit=7')),
    { query: 'Ekiti budget', limit: 7 });
  assert.deepEqual(parseDirectoryFilters(new URLSearchParams('category=Hotels&lga=ido-osi')),
    { category: 'Hotels', lga: 'ido-osi', query: null, limit: 20 });
  assert.equal(parsePublicPlaceId('/api/places/abcdefab-1234-4fab-9abc-abcdefabcdef'),
    'abcdefab-1234-4fab-9abc-abcdefabcdef');
  for (const bad of ['q=a','q=ok&q=extra','q='+ 'a'.repeat(200),'q=x%00y','q=ok&admin=true'])
    assert.throws(() => parseKnowledgeFilters(new URLSearchParams(bad)), PublicQueryError);
  for (const bad of ['category=Everything','lga=..','lga=efa%2F..','q=' + 'a'.repeat(101),'limit=999','category=Hotels&category=Health'])
    assert.throws(() => parseDirectoryFilters(new URLSearchParams(bad)), PublicQueryError);
  assert.throws(() => parsePublicPlaceId('/api/places/not-a-uuid'), PublicQueryError);
});

test('official feed collector creates pending headline candidates and never injects article bodies', async () => {
  const response = `<rss version="2.0"><channel><item>
  <title>Ekiti &amp; development update</title>
  <link>https://www.ekitistate.gov.ng/archives/34567</link>
  <pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate></item>
  <item><title>Malicious page</title><link>https://evil.example/anything</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const seen = [];
  const result = await collectCandidates(async url => {
    seen.push(url);
    return new Response(response, { headers: { 'Content-Type': 'application/rss+xml' } });
  }, new Date('2026-11-10T10:00:00Z'));
  assert.equal(seen.length, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].reviewState,'pending');
  assert.equal(result.candidates[0].sourceId,'ekiti-state-official');
  assert.equal(result.candidates[0].summaryEn,null);
  assert.match(result.candidates[0].fingerprint,/^[a-f0-9]{64}$/);
  assert.ok(result.candidates[0].title.includes('& development'));
});

test('collector fails closed for excessive, redirected or missing feeds', async () => {
  const now = new Date('2026-11-10T10:00:00Z');
  const huge = await collectCandidates(async () => new Response('x'.repeat(170_000)),now);
  assert.equal(huge.candidates.length,0);
  const offline = await collectCandidates(async () => { throw new Error('offline'); },now);
  assert.equal(offline.candidates.length,0);
  assert.equal(offline.status,'source-unavailable-or-no-dated-posts');
});

test('knowledge and directory GET routes reject misuse before connecting to a database', async () => {
  const env = { LOCATION_LIMIT: { limit: async () => ({ success: true }) } };
  for (const [url, expected] of [
    ['https://ekiti.example/api/knowledge',400],
    ['https://ekiti.example/api/knowledge?q=x',400],
    ['https://ekiti.example/api/places?category=NotValid',400],
    ['https://ekiti.example/api/places?q=x&limit=50',400],
    ['https://ekiti.example/api/places/non-uuid',400],
  ]) {
    const response = await worker.fetch(new Request(url),env);
    assert.equal(response.status,expected,url);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
  const denied = await worker.fetch(new Request('https://ekiti.example/api/places?category=Hotels',{
    headers:{Origin:'https://evil.example'},
  }),env);
  assert.equal(denied.status,403);
  const missingDb = await worker.fetch(new Request('https://ekiti.example/api/places?category=Hotels'),env);
  assert.equal(missingDb.status,503);
});
