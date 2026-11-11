import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createAdminGateway } from '../src/server/admin-gateway.ts';
import worker from '../src/server/worker.ts';

const now = 1794300000;
const subject = '12345678-1234-4123-8123-123456789012';
const caseId = '32145678-1234-4123-8123-123456789012';
const otherCaseId = '42145678-1234-4123-8123-123456789012';
const publicId = '52145678-1234-4123-8123-123456789012';
const firstEventId = '62145678-1234-4123-8123-123456789012';
const secondEventId = '72145678-1234-4123-8123-123456789012';
const issuer = 'https://admin-issuer.example.test/auth/v1';
const origin = 'https://admin.example.test';
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
let keys; let jwk;
async function signedJwt(claimOverrides = {}) {
  if (!keys) {
    keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' },
      true, ['sign','verify']);
    jwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
    jwk.alg = 'ES256'; jwk.use = 'sig';
  }
  const header = enc({ alg: 'ES256', kid: 'ephemeral-1', typ: 'JWT' });
  const body = enc({
    iss: issuer, aud: 'authenticated', sub: subject, role: 'authenticated',
    aal: 'aal2', exp: now + 600, iat: now - 30, nbf: now - 30, ...claimOverrides,
  });
  const input = header + '.' + body;
  const sig = await webcrypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' },
    keys.privateKey, new TextEncoder().encode(input));
  return input + '.' + Buffer.from(sig).toString('base64url');
}
const record = (id, lgaId) => ({
  id, publicReference: publicId, kind: 'Issue', lgaId,
  currentState: 'under_review', revision: 1,
  receivedAt: '2026-11-09T10:00:00Z', updatedAt: '2026-11-10T08:00:00Z',
  // Intentionally private property: gateway MUST NOT echo this even for valid staff.
  description: 'Private citizen allegations must not leak here',
  trackingSecret: 'private-token-must-not-leak',
});
function makeRepo(role = 'case_manager', allowedLgaIds = ['ado-ekiti']) {
  const cases = new Map([
    [caseId, record(caseId, 'ado-ekiti')],
    [otherCaseId, record(otherCaseId, 'ikere')],
  ]);
  const audit = [];
  const notes = new Map();
  const events = new Map([[caseId, [{
    id: firstEventId, kind: 'under_review', actorKind: 'moderator',
    createdAt: '2026-11-10T08:00:00Z', detail: 'Platform moderation only',
    trackingSecret: 'never-serialize-this-property',
  }]]]);
  const repo = {
    cases, audit, notes, events, overrideList: null, failAudit: false,
    membership: {
      userId: subject, role, active: true, expiresAt: null,
      allowedLgaIds, verifiedOfficeId: role === 'government_officer' ? 'office-1' : null,
    },
    async getMembership() { return this.membership; },
    actorReads: [],
    async listCases({ actorId, allowedLgas, lgaId, limit }) {
      this.actorReads.push({ method: 'listCases', actorId });
      if (this.overrideList) return this.overrideList;
      return [...cases.values()].filter(item =>
        (allowedLgas === null || allowedLgas.includes(item.lgaId)) &&
        (lgaId === null || item.lgaId === lgaId)).slice(0,limit);
    },
    async findCase(id, actorId) {
      this.actorReads.push({ method: 'findCase', actorId });
      return cases.get(id) ?? null;
    },
    async listEvents(id, limit, actorId) {
      this.actorReads.push({ method: 'listEvents', actorId });
      return (events.get(id) || []).slice(0,limit);
    },
    async recordRead(data) {
      if (this.failAudit) throw new Error('Private database unavailable');
      audit.push({ type: 'read', ...data });
    },
    async createInternalNote(input) {
      const item = cases.get(input.caseId);
      if (!item) return { result:'not_found' };
      const old = notes.get(input.requestId);
      if (old) {
        if (old.caseId !== input.caseId || old.actorId !== input.actorId ||
          old.text !== input.text || old.expectedRevision !== input.expectedRevision)
          return { result: 'conflict' };
        return { result: 'replayed', eventId: old.eventId, revision: old.revision };
      }
      if (item.revision !== input.expectedRevision) return { result: 'conflict' };
      const revision = ++item.revision;
      notes.set(input.requestId, { ...input, eventId: secondEventId, revision });
      events.set(item.id, [...(events.get(item.id) || []), {
        id: secondEventId, kind: 'internal_note', actorKind: 'moderator',
        createdAt: '2026-11-10T10:00:00Z', detail: input.text,
      }]);
      audit.push({ type: 'write', actorId: input.actorId, caseId: item.id,
        operation: 'internal_note', revision });
      return { result: 'created', eventId: secondEventId, revision };
    },
  };
  return repo;
}
async function setup(role = 'case_manager', areas = ['ado-ekiti']) {
  const token = await signedJwt();
  const repository = makeRepo(role, areas);
  const limiter = { calls: [], allow: true, async check(input) {
    this.calls.push(input);
    return this.allow;
  }};
  const opts = {
    enabled: true, origin, nowSeconds: () => now, repository,
    jwt: {
      issuer, audience:'authenticated',
      getPublicKey: async kid => kid === 'ephemeral-1' ? jwk : null,
    },
    limit: limiter,
  };
  const gateway = createAdminGateway(opts);
  const request = (path, method = 'GET', body, headers = {}) => {
    const h = { Authorization: 'Bearer ' + token, ...headers };
    if (method === 'POST') {
      h.Origin = origin;
      h['Content-Type'] = 'application/json';
    }
    const args = { method, headers: h };
    if (body !== undefined) args.body = JSON.stringify(body);
    return gateway(new Request(origin + path, args));
  };
  return { gateway, request, opts, repository, limiter, token };
}
const validNote = {
  text: 'Need platform moderator review before any onward referral',
  expectedRevision: 1,
  requestId: '82345678-1234-4234-8234-123456789012',
};
test('feature gate fails closed if disabled or dependencies absent', async () => {
  const req = new Request(origin + '/admin/api/me');
  assert.equal((await createAdminGateway({ enabled: false })(req)).status,404);
  assert.equal((await createAdminGateway({ enabled: true })(req)).status,404);
  assert.equal((await worker.fetch(new Request('https://public.example.test/admin/api/cases'), {})).status,404);
});

test('verified staff can read only allowlisted case fields and own role metadata', async () => {
  const { request, repository } = await setup();
  const me = await request('/admin/api/me');
  assert.equal(me.status,200);
  const payload = await me.json();
  assert.equal(payload.membership.role, 'case_manager');
  assert.deepEqual(payload.membership.allowedLgaIds, ['ado-ekiti']);
  assert.equal(JSON.stringify(payload).includes('token'),false);
  const list = await request('/admin/api/cases');
  assert.equal(list.status,200);
  const json = await list.json();
  assert.equal(json.items.length,1);
  assert.equal(json.items[0].id,caseId);
  assert.equal(json.items[0].description,undefined);
  assert.equal(JSON.stringify(json).includes('trackingSecret'),false);
  const detail = await request('/admin/api/cases/'+caseId);
  assert.equal(detail.status,200);
  assert.equal((await detail.json()).item.revision,1);
  const timeline = await request('/admin/api/cases/'+caseId+'/events');
  assert.equal(timeline.status,200);
  assert.equal((await timeline.json()).events[0].trackingSecret,undefined);
  assert.deepEqual(repository.audit.map(a => a.action),
    ['case_list','case_read','event_read']);
  assert.ok(repository.actorReads.every(item => item.actorId === subject),
    'Every repository read must be scoped by the server-verified actor ID');
});

test('wrong LGA is private 404 and out-of-scope lists never leak even with a buggy repository', async () => {
  const { request, repository } = await setup();
  assert.equal((await request('/admin/api/cases/'+otherCaseId)).status,404);
  assert.equal((await request('/admin/api/cases/'+otherCaseId+'/events')).status,404);
  assert.equal((await request('/admin/api/cases?lga=ikere')).status,403);
  repository.overrideList = [record(otherCaseId,'ikere')];
  const result = await request('/admin/api/cases');
  assert.equal(result.status,503);
  assert.equal(JSON.stringify(await result.json()).includes('ikere'),false);
});

test('case roles are scoped; government officers and auditors cannot access platform reports', async () => {
  for (const role of ['government_officer','directory_reviewer','auditor']) {
    const { request } = await setup(role);
    assert.equal((await request('/admin/api/cases')).status,403);
    assert.equal((await request('/admin/api/cases/'+caseId)).status,403);
  }
  const { request: admin } = await setup('platform_admin',[]);
  const list = await admin('/admin/api/cases?limit=2');
  assert.equal(list.status,200);
  assert.equal((await list.json()).items.length,2);
});

test('anonymous, invalid MFA, revoked staff, wrong host and cross-origin requests are blocked', async () => {
  const { gateway, opts, request, repository, token } = await setup();
  assert.equal((await gateway(new Request(origin + '/admin/api/me'))).status,401);
  assert.equal((await gateway(new Request('https://attacker.example.test/admin/api/me', {
    headers: { Authorization: 'Bearer ' + token },
  }))).status,404);
  const badToken = await signedJwt({ aal:'aal1' });
  assert.equal((await gateway(new Request(origin + '/admin/api/me', {
    headers: { Authorization: 'Bearer ' + badToken },
  }))).status,401);
  assert.equal((await request('/admin/api/me', 'GET', undefined, { Cookie: 'sid=abc' })).status,403);
  assert.equal((await request('/admin/api/me', 'GET', undefined, { Origin:'https://evil.example.test' })).status,403);
  repository.membership.active = false;
  assert.equal((await request('/admin/api/me')).status,403);
  repository.membership.active = true;
  const other = createAdminGateway({ ...opts, origin: 'http://admin.example.test' });
  assert.equal((await other(new Request(origin+'/admin/api/me'))).status,404);
});

test('staff rate limiting, strict queries, method checks and audit failure are safe', async () => {
  const { request, limiter, repository } = await setup();
  assert.equal((await request('/admin/api/cases?limit=30')).status,400);
  assert.equal((await request('/admin/api/cases?lga=ado-ekiti&lga=ikere')).status,400);
  assert.equal((await request('/admin/api/cases?secret=abc')).status,400);
  assert.equal((await request('/admin/api/cases','POST',{})).status,405);
  limiter.allow = false;
  const throttled = await request('/admin/api/cases');
  assert.equal(throttled.status,429);
  assert.equal(throttled.headers.get('Retry-After'),'60');
  limiter.allow = true;
  repository.failAudit = true;
  assert.equal((await request('/admin/api/cases')).status,503);
});

test('internal notes append once with audit; stale revision and duplicate key conflicts are enforced', async () => {
  const { request, repository } = await setup('case_manager');
  const path = '/admin/api/cases/'+caseId+'/notes';
  const first = await request(path,'POST',validNote);
  assert.equal(first.status,201);
  assert.deepEqual(await first.json(), { eventId: secondEventId, revision: 2,
    replayed: false, scope:'platform_internal' });
  assert.equal(repository.notes.size,1);
  assert.equal(repository.audit.filter(x => x.type === 'write').length,1);
  const retry = await request(path,'POST',validNote);
  assert.equal(retry.status,200);
  assert.equal((await retry.json()).replayed,true);
  assert.equal(repository.audit.filter(x => x.type === 'write').length,1);
  const stale = await request(path,'POST',{ ...validNote,
    requestId:'92345678-1234-4234-8234-123456789012' });
  assert.equal(stale.status,409);
  const reused = await request(path,'POST',{ ...validNote, text:'Different note with same request identifier' });
  assert.equal(reused.status,409);
  const timeline = await request('/admin/api/cases/'+caseId+'/events');
  assert.equal((await timeline.json()).events.length,2);
});

test('notes reject cross-site requests, overlarge payloads, unexpected fields and unsupported roles', async () => {
  const { gateway, request, token } = await setup();
  const path = '/admin/api/cases/'+caseId+'/notes';
  assert.equal((await gateway(new Request(origin+path,{
    method:'POST', headers: { Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body:JSON.stringify(validNote),
  }))).status,403);
  assert.equal((await request(path,'POST',{ ...validNote, latitude:7.6 })).status,400);
  assert.equal((await request(path,'POST',{ ...validNote, text:'short' })).status,400);
  assert.equal((await request(path,'POST',{ ...validNote, text:'a'.repeat(1600) })).status,400);
  assert.equal((await request(path,'POST',{ ...validNote, requestId:'bad' })).status,400);
  const { request: reader } = await setup('directory_reviewer');
  assert.equal((await reader(path,'POST',validNote)).status,403);
  const { request: wrongLga } = await setup('case_manager',['ikere']);
  assert.equal((await wrongLga(path,'POST',validNote)).status,404);
});

test('Sprint 13 intake defaults unavailable without an independently enabled repository',async()=>{
  const {request}=await setup();
  assert.equal((await request('/admin/api/intake')).status,404);
  assert.equal((await request('/admin/api/intake/'+caseId+'/proposals','POST',{
    kind:'safeguarding_review',targetLgaId:null,expectedRevision:1,
  })).status,404);
  assert.equal((await worker.fetch(
    new Request('https://public.example.test/admin/api/intake'),{})).status,404);
});

test('Sprint 13 scoped queue filters, metadata minimization, and audit fail closed',async()=>{
  const {request,repository}=await setup('case_manager',['ado-ekiti']);
  let last=null;
  repository.listIntake=async input=>{
    last=input;
    return [{
      ...record(caseId,'ado-ekiti'),
      evidenceAccess:'blocked_pending_safeguarding',
      privateEvidenceUrl:'https://private.example.test/should-not-leak',
    }];
  };
  const page=await request('/admin/api/intake?limit=10&lga=ado-ekiti&kind=Issue&state=under_review');
  assert.equal(page.status,200);
  const json=await page.json();
  assert.equal(json.items.length,1);
  assert.deepEqual(Object.keys(json.items[0]).sort(),[
    'id','publicReference','kind','lgaId','currentState','revision',
    'receivedAt','updatedAt','evidenceAccess',
  ].sort());
  assert.equal(json.items[0].evidenceAccess,'blocked_pending_safeguarding');
  assert.equal(JSON.stringify(json).includes('privateEvidenceUrl'),false);
  assert.equal(JSON.stringify(json).includes('description'),false);
  assert.deepEqual(last,{actorId:subject,lgaId:'ado-ekiti',kind:'Issue',
    state:'under_review',limit:10});
  assert.equal(repository.audit.at(-1).action,'case_list');
  for(const invalid of ['/admin/api/intake?lga=ikere',
    '/admin/api/intake?kind=Emergency','/admin/api/intake?state=delivered',
    '/admin/api/intake?limit=99','/admin/api/intake?secret=foo',
    '/admin/api/intake?lga=ado-ekiti&lga=ado-ekiti']){
    const response=await request(invalid);
    assert.equal(response.status,invalid.includes('lga=ikere')?403:400,invalid);
  }
  repository.listIntake=async()=>[{
    ...record(otherCaseId,'ikere'),evidenceAccess:'blocked_pending_safeguarding',
  }];
  assert.equal((await request('/admin/api/intake')).status,503,
    'Breach by repository cannot leak cross-LGA case');
  repository.listIntake=async()=>[{
    ...record(caseId,'ado-ekiti'),evidenceAccess:'raw_media_available',
  }];
  assert.equal((await request('/admin/api/intake')).status,503,
    'Unapproved evidence access state is blocked');
  repository.failAudit=true;
  repository.listIntake=async()=>[{
    ...record(caseId,'ado-ekiti'),evidenceAccess:'blocked_pending_safeguarding',
  }];
  assert.equal((await request('/admin/api/intake')).status,503,
    'List audit must succeed before returning data');
});

test('Sprint 13 proposals require verified MFA, current scope, strict body and do not claim case updates',async()=>{
  const {request,repository}=await setup();
  const proposed=[];
  repository.proposeIntakeReview=async input=>{
    proposed.push(input);
    return {result:'queued',proposalId:'92345678-1234-4234-8234-123456789012'};
  };
  const path='/admin/api/intake/'+caseId+'/proposals';
  const body={kind:'safeguarding_review',targetLgaId:null,expectedRevision:1};
  const ok=await request(path,'POST',body);
  assert.equal(ok.status,201);
  assert.deepEqual(await ok.json(),{
    proposalId:'92345678-1234-4234-8234-123456789012',
    reviewOnly:true,officeNotified:false,caseChanged:false,result:'queued',
  });
  assert.deepEqual(proposed[0],{
    actorId:subject,caseId,kind:'safeguarding_review',
    targetLgaId:null,expectedRevision:1,
  });
  for(const bad of [
    {...body,officeId:'ministry'},
    {...body,evidence:'https://example.test/photo'},
    {...body,expectedRevision:0},
    {...body,kind:'send_to_government'},
    {...body,kind:'assignment_review',targetLgaId:null},
    {...body,targetLgaId:'ikere'},
  ])assert.equal((await request(path,'POST',bad)).status,400);
  assert.equal((await request(path,'GET')).status,405);
  assert.equal((await request('/admin/api/intake/'+otherCaseId+'/proposals','POST',body)).status,404);
  assert.equal((await request(path,'POST',{
    ...body,kind:'assignment_review',targetLgaId:'ikere',
  })).status,403);
  assert.equal((await request(path,'POST',{
    ...body,kind:'assignment_review',targetLgaId:'ado-ekiti',
  })).status,201);
  assert.equal((await request(path,'POST',{...body,expectedRevision:2})).status,409);
  repository.proposeIntakeReview=async()=>({result:'not_available'});
  assert.equal((await request(path,'POST',body)).status,404);
  const {request:mod,repository:modRepo}=await setup('moderator');
  modRepo.proposeIntakeReview=async()=>({result:'queued',proposalId:'92345678-1234-4234-8234-123456789012'});
  assert.equal((await mod(path,'POST',{
    ...body,kind:'assignment_review',targetLgaId:'ado-ekiti',
  })).status,403);
  assert.equal((await mod(path,'POST',body)).status,201);
  const {request:auditor,auditor:ignored}=await (async()=>{
    const info=await setup('auditor');return {request:info.request};
  })();
  void ignored;
  assert.equal((await auditor(path,'POST',body)).status,403);
});
