import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/server/worker.ts';
import { topicFor } from '../src/server/ask-knowledge.ts';
import { parseOfficialFeed, answerQuestion, latestOfficialNews } from '../src/server/ask.ts';

const sample = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Gov. announces &amp; explains Ekiti programme</title>
<link>https://www.ekitistate.gov.ng/archives/12345</link><pubDate>Tue, 03 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Malicious outside source</title>
<link>https://attacker.example/story</link><pubDate>Wed, 04 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Future item must be ignored</title>
<link>https://www.ekitistate.gov.ng/archives/future</link><pubDate>Fri, 01 Jan 2038 10:00:00 GMT</pubDate></item>
</channel></rss>`;
const now = new Date('2026-11-10T10:00:00Z');
const fetcher = async () => new Response(sample, { status: 200, headers: { 'Content-Type': 'application/rss+xml' } });

test('English and Yoruba questions resolve to known topics without inventing answers', () => {
  assert.equal(topicFor('How many LGAs are in Ekiti?'), 'lga');
  assert.equal(topicFor('Mélòó ni ìjọba ìbílẹ̀ Èkìtì?'), 'lga');
  assert.equal(topicFor('Kí ló ń ṣẹlẹ̀ ní Èkìtì lónìí?'), 'news');
  assert.equal(topicFor('What is happening today?'), 'news');
  assert.equal(topicFor('Where can I go to club in Ekiti?'), 'tourism');
  assert.equal(topicFor('2026 Citizens budget in Yoruba'), 'budget');
  assert.equal(topicFor('What is the Works ministry number?'), 'ministries');
  assert.equal(topicFor('Who will win the election?'), 'unknown');
});

test('Yoruba answer provides Yoruba text and sources', async () => {
  const answer = await answerQuestion('Mélòó ni ìjọba ìbílẹ̀ Èkìtì?', 'yo', fetcher, now);
  assert.equal(answer.language, 'yo');
  assert.equal(answer.topic, 'lga');
  assert.match(answer.answer, /mẹ́rìndínlógún/);
  assert.equal(answer.sources.length, 1);
  assert.match(answer.sources[0].url, /^https:\/\/www\.ekitistate\.gov\.ng\//);
});

test('Official RSS parser blocks untrusted hosts, future dates and non-RSS HTML', () => {
  const stories = parseOfficialFeed(sample, now);
  assert.equal(stories.length, 1);
  assert.match(stories[0].title, /& explains/);
  assert.equal(stories[0].published, '2026-11-03');
  assert.deepEqual(parseOfficialFeed('<html><item>fake</item></html>', now), []);
});

test('Official RSS feed provides the latest dated and cited update with honest freshness note', async () => {
  const stories = await latestOfficialNews(fetcher, now);
  assert.equal(stories.length, 1);
  const answer = await answerQuestion('What is happening in Ekiti today?', 'en', fetcher, now);
  assert.match(answer.answer, /could not verify a government update published today/i);
  assert.match(answer.answer, /03 Nov|2026-11-03/);
  assert.equal(answer.confidence, 'source-backed');
  assert.equal(answer.sources.length, 1);
});

test('Unknown questions do not become plausible hallucinated facts', async () => {
  const answer = await answerQuestion('Can you guarantee a job tomorrow?', 'en', fetcher, now);
  assert.equal(answer.confidence, 'not-verified');
  assert.equal(answer.sources.length, 0);
  assert.match(answer.answer, /cannot verify/);
});

test('Official feed outage falls back to dated releases, never a fabricated today update', async () => {
  const offline = async () => { throw new Error('network down'); };
  const answer = await answerQuestion('What is happening today?', 'en', offline, now);
  assert.equal(answer.confidence, 'limited');
  assert.equal(answer.sources[0].published, '2026-11-03');
  assert.match(answer.limitation, /could not be checked/);
});

test('Ask API is same-origin, rate-limited, input-bounded and avoids database access', async () => {
  const env = { LOCATION_LIMIT: { limit: async () => ({ success: true }) } };
  const url = 'https://ekiti.example/api/ask';
  const good = JSON.stringify({ question: 'How many LGAs are in Ekiti?', language: 'en' });
  const response = await worker.fetch(new Request(url, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: good,
  }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const answer = await response.json();
  assert.equal(answer.topic, 'lga');
  assert.match(answer.answer, /16 local government areas/);

  const attempts = [
    [{ method: 'GET' }, 405],
    [{ method: 'POST', body: good }, 415],
    [{ method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: good }, 403],
    ...[
      '{', '{}', JSON.stringify({ question: 'hey', language: 'fr' }),
      JSON.stringify({ question: 'hi', language: 'en', admin: true }),
      JSON.stringify({ question: 'X'.repeat(500), language: 'en' }),
      JSON.stringify({ question: 'X'.repeat(1700), language: 'en' }),
    ].map(body => [{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, 400]),
  ];
  for (const [init, expected] of attempts) {
    const result = await worker.fetch(new Request(url, init), env);
    assert.equal(result.status, expected);
  }
  const limited = await worker.fetch(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: good }), {
    LOCATION_LIMIT: { limit: async () => ({ success: false }) },
  });
  assert.equal(limited.status, 429);
});
