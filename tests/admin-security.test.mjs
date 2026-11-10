import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { verifyAdminJwt, AdminAuthError } from '../src/server/admin-auth.ts';
import { authorizeAdmin } from '../src/server/admin-access.ts';
import worker from '../src/server/worker.ts';

const subject = '12345678-1234-4123-8123-123456789012';
const now = 1794300000;
const issuer = 'https://identity.example.test/auth/v1';
const audience = 'authenticated';
const enc = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
let keys;
let publicJwk;
async function fixture() {
  if (!keys) {
    keys = await webcrypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign','verify']);
    publicJwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
    publicJwk.kid = 'test-key';
    publicJwk.alg = 'ES256';
    publicJwk.use = 'sig';
  }
  return { getPublicKey: async kid => kid === 'test-key' ? publicJwk : null, issuer, audience, nowSeconds: now };
}
async function signedJwt(overrides = {}) {
  await fixture();
  const header = enc({ alg: 'ES256', kid: 'test-key', typ: 'JWT' });
  const payload = enc({
    iss: issuer, aud: audience, sub: subject, role: 'authenticated',
    aal: 'aal2', iat: now - 30, nbf: now - 30, exp: now + 1800, ...overrides,
  });
  const data = header + '.' + payload;
  const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(data));
  return data + '.' + Buffer.from(signature).toString('base64url');
}

test('admin verifier accepts only a correctly signed, scoped short-lived MFA token', async () => {
  const config = await fixture();
  assert.deepEqual(await verifyAdminJwt(await signedJwt(), config),
    { subject, expiresAt: now + 1800, assurance: 'aal2' });
  const legitimateToken = await signedJwt();
  const [part0, part1, part2] = legitimateToken.split('.');
  const tamperedToken = part0 + '.' + part1 + '.' + (part2[0] === 'A' ? 'B' : 'A') + part2.slice(1);
  await assert.rejects(() => verifyAdminJwt(tamperedToken, config), AdminAuthError);
  await assert.rejects(() => verifyAdminJwt(await signedJwt({ iss: 'https://evil.test' }), config), AdminAuthError);
  await assert.rejects(() => verifyAdminJwt(await signedJwt({ aud: 'anon' }), config), AdminAuthError);
  await assert.rejects(() => verifyAdminJwt(await signedJwt({ role: 'service_role' }), config), AdminAuthError);
  await assert.rejects(() => verifyAdminJwt(await signedJwt({ aal: 'aal1' }), config), AdminAuthError);
  await assert.rejects(() => verifyAdminJwt(await signedJwt({ exp: now - 1 }), config), AdminAuthError);
  await assert.rejects(() => verifyAdminJwt(await signedJwt({ exp: now + 7200 }), config), AdminAuthError);
  await assert.rejects(() => verifyAdminJwt('e30.e30.invalid', config), AdminAuthError);
});

test('authorization denies inactive users, forged memberships, wrong LGA and missing MFA', () => {
  const identity = { subject, expiresAt: now + 1800, assurance: 'aal2' };
  const membership = {
    userId: subject, role: 'case_manager', active: true,
    expiresAt: null, allowedLgaIds: ['ado-ekiti'], verifiedOfficeId: null,
  };
  const req = {
    identity, membership, capability: 'case.assign',
    target: { kind: 'case', lgaId: 'ado-ekiti' }, nowSeconds: now,
  };
  assert.equal(authorizeAdmin(req), true);
  assert.equal(authorizeAdmin({ ...req, membership: { ...membership, active: false } }), false);
  assert.equal(authorizeAdmin({ ...req, identity: null }), false);
  assert.equal(authorizeAdmin({ ...req, membership: { ...membership, userId: 'elsewhere' } }), false);
  assert.equal(authorizeAdmin({ ...req, target: { kind: 'case', lgaId: 'ikere' } }), false);
  assert.equal(authorizeAdmin({ ...req, identity: { ...identity, assurance: 'aal1' } }), false);
  assert.equal(authorizeAdmin({ ...req, membership: { ...membership, expiresAt: now - 1 } }), false);
});

test('government access requires verified office scope and independently recorded delivery', () => {
  const identity = { subject, expiresAt: now + 1800, assurance: 'aal2' };
  const membership = {
    userId: subject, role: 'government_officer', active: true,
    expiresAt: null, allowedLgaIds: [], verifiedOfficeId: 'office-verified-1',
  };
  const target = { kind: 'office', officeId: 'office-verified-1',
    verifiedOffice: true, referralPending: true, deliveryRecorded: false };
  const req = { identity, membership, capability: 'office.view', target, nowSeconds: now };
  assert.equal(authorizeAdmin(req), false);
  assert.equal(authorizeAdmin({ ...req, capability: 'office.accept' }), true);
  assert.equal(authorizeAdmin({ ...req, target: { ...target, deliveryRecorded: true } }), true);
  assert.equal(authorizeAdmin({ ...req, target: { ...target, officeId: 'other-office', deliveryRecorded: true } }), false);
  assert.equal(authorizeAdmin({ ...req, target: { ...target, verifiedOffice: false, deliveryRecorded: true } }), false);
  assert.equal(authorizeAdmin({ ...req, membership: { ...membership, role: 'platform_admin' } }), false);
});

test('unapproved public administrative routes remain inaccessible', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/admin/cases'), {});
  assert.equal(response.status, 404);
});
