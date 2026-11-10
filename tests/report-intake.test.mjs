import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReportInput, ReportInputError } from '../src/reporting/intake-contract.ts';
import worker from '../src/server/worker.ts';

const policy = 'approved-example-policy-v1'; // Test-only fixture, not a published policy.
const example = {
  kind: 'Issue',
  description: 'The bridge near our market needs inspection after heavy rainfall.',
  lgaId: 'ado-ekiti',
  wardId: 'inec-rac-ekiti-12',
  place: 'Market junction',
  clientRequestId: '3ab0372b-5bf2-4006-9a89-a7a98bcf021d',
  consent: true,
  consentPolicyVersion: policy,
};

function expectCode(input, code, approved = policy) {
  assert.throws(() => parseReportInput(JSON.stringify(input), approved),
    (error) => error instanceof ReportInputError && error.code === code);
}

test('intake fails closed until a reviewed consent policy is explicitly available', () => {
  expectCode(example, 'policy_unavailable', undefined);
  expectCode(example, 'policy_unavailable', '');
  expectCode(example, 'policy_unavailable', '   ');
  expectCode({ ...example, consent: false }, 'consent_required');
  expectCode({ ...example, consentPolicyVersion: 'old' }, 'consent_required');
  expectCode({ ...example, consent: 'true' }, 'consent_required');
});

test('accepts a bounded anonymous draft with no coordinates or contact fields', () => {
  const report = parseReportInput(JSON.stringify(example), policy);
  assert.deepEqual(report, {
    kind: 'Issue',
    description: example.description,
    lgaId: 'ado-ekiti',
    wardId: 'inec-rac-ekiti-12',
    place: 'Market junction',
    clientRequestId: example.clientRequestId,
    consentPolicyVersion: policy,
  });
  assert.equal(Object.hasOwn(report, 'contact'), false);
  assert.equal(Object.hasOwn(report, 'latitude'), false);
});

test('rejects unexpected personal fields, GPS, invalid content, and oversized requests', () => {
  for (const field of [{ email: 'x@example.com' }, { latitude: 7.5 }, { longitude: 5.1 },
    { phone: '08000000000' }, { status: 'received' }, { receipt: 'fake' }]) {
    expectCode({ ...example, ...field }, 'invalid_request');
  }
  for (const change of [
    { kind: 'Emergency' }, { description: 'tiny' }, { description: 'x'.repeat(4001) },
    { description: 'Something happened.\u0000' }, { lgaId: '../sneaky' },
    { wardId: 'nonexistent' }, { place: 'x'.repeat(161) },
    { clientRequestId: 'not-a-uuid' }, { consent: 1 },
  ]) {
    const code = Object.hasOwn(change, 'consent') ? 'consent_required' : 'invalid_request';
    expectCode({ ...example, ...change }, code);
  }
  expectCode({ ...example, description: '🌿'.repeat(2500) }, 'payload_too_large');
  assert.throws(() => parseReportInput('{', policy), (err) => err.code === 'invalid_request');
  assert.throws(() => parseReportInput('null', policy), (err) => err.code === 'invalid_request');
});

test('validation errors never echo a citizen narrative', () => {
  const text = 'PRIVATE SAMPLE REPORT CONTENT';
  try { parseReportInput(JSON.stringify({ ...example, description: text, consent: false }), policy); }
  catch (err) {
    assert.ok(!String(err).includes(text));
    return;
  }
  assert.fail('Consent failure should throw');
});

test('public report intake remains unavailable in the deployed Worker', async () => {
  const body = JSON.stringify(example);
  const response = await worker.fetch(new Request('https://ekiti.example/api/reports', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  }), {});
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
