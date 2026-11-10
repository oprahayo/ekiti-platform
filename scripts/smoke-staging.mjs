// Read-only checks with a public reference polygon's interior point.
import assert from 'node:assert/strict';

const origin = new URL(process.argv[2]);
assert.ok(
  origin.protocol === 'https:' ||
    (origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)),
  'Use an HTTPS staging origin or local Wrangler',
);
assert.equal(origin.href, origin.origin + '/', 'Supply only the origin');
async function request(path, options) {
  const response = await fetch(new URL(path, origin), {
    ...options,
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  assert.equal(response.status, 200, path + ' returned ' + response.status);
  return response;
}
assert.match(await (await request('/')).text(), /id="root"/);
assert.match(await (await request('/explore')).text(), /id="root"/);
const areas = await (await request('/api/areas')).json();
const lgas = areas.filter((a) => a.kind === 'lga');
const wards = areas.filter((a) => a.kind === 'ward');
const parents = new Set(lgas.map((a) => a.id));
assert.equal(parents.size, 16);
assert.equal(new Set(wards.map((a) => a.id)).size, 177);
assert.ok(wards.every((a) => parents.has(a.parentId)));
const response = await request('/api/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    confirmed: true,
    latitude: 7.677235411135371,
    longitude: 4.943747799903621,
  }),
});
assert.equal(response.headers.get('Cache-Control'), 'no-store');
const evidence = await response.json();
assert.equal(evidence.stateBoundaryStatus, 'inside');
assert.equal(evidence.lga.match?.id, 'efon');
assert.equal(evidence.ward.status, 'unmapped');
// Ask can resolve English and Yoruba facts without an AI API key or a DB write.
for (const [language, question] of [
  ['en', 'How many LGAs are in Ekiti?'],
  ['yo', 'Mélòó ni ìjọba ìbílẹ̀ Èkìtì?'],
]) {
  const answerResponse = await request('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, question }),
  });
  assert.equal(answerResponse.headers.get('Cache-Control'), 'no-store');
  const answer = await answerResponse.json();
  assert.equal(answer.topic, 'lga');
  assert.equal(answer.language, language);
  assert.ok(answer.sources.length > 0);
  assert.equal(answer.confidence, 'source-backed');
}
console.log(
  'Page, verified directory, Efon boundary lookup, unmapped ward and English/Yoruba Ask passed at ' + origin.origin,
);
