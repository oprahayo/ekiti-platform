import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/server/worker.ts';

const env = { LOCATION_LIMIT: { limit: async () => ({ success: true }) } };
const route = 'https://ekiti.example/api/resolve';
test('invalid requests are rejected before opening a database connection', async () => {
  for (const [init, status] of [
    [{ method: 'GET' }, 405],
    [{ method: 'POST', headers: { Origin: 'https://foreign.example' } }, 403],
    [{ method: 'POST', body: 'text' }, 415],
    ...[
      '{',
      'null',
      '{"latitude":0,"longitude":0}',
      '{"latitude":91,"longitude":0,"confirmed":true}',
      ' '.repeat(513),
    ].map((body) => [
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
      400,
    ]),
  ]) {
    const response = await worker.fetch(new Request(route, init), env);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});
test('rate limit failures stop requests before database access', async () => {
  const res = await worker.fetch(new Request('https://ekiti.example/api/areas'), {
    LOCATION_LIMIT: { limit: async () => ({ success: false }) },
  });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('Retry-After'), '60');
});
