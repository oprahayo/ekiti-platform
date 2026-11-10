import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReportInput } from '../src/reporting/intake-contract.ts';
import { newReceiptSecret, parseTrackRequest, secretDigestHex, ReceiptAccessError } from '../src/reporting/receipt-crypto.ts';
import { createPrivateReport, readPrivateTimeline, CaseStoreError } from '../src/reporting/private-case-store.ts';
import { handlePrivateReporting } from '../src/server/private-report-routes.ts';
import worker from '../src/server/worker.ts';

const policy = 'test-approved-privacy-v1';
const valid = {
  kind: 'Issue',
  description: 'A bridge beside the market has collapsed after the latest rainstorm.',
  lgaId: 'ado-ekiti',
  wardId: null,
  place: 'Near the market',
  clientRequestId: '52c8fc4a-b69f-48f9-a359-0a79d881e084',
  consent: true,
  consentPolicyVersion: policy,
};
const reference = 'ed3b7b7c-1f31-4a15-a768-39703dfccbac';
const caseId = 'c221762c-d52a-4cc1-b69f-1d39cba10914';

class FakePrivateDb {
  statements = [];
  arguments = [];
  log = [];
  stored = null;
  staged = null;
  committed = false;
  fail = null;
  invalidLga = false;
  invalidWard = false;
  duplicate = false;
  async query(statement, parameters = []) {
    this.statements.push(statement);
    this.arguments.push(parameters);
    if (this.fail && statement.includes(this.fail)) {
      const error = new Error('Fake database failure with private internal detail');
      error.code = this.duplicate ? '23505' : 'UNAVAILABLE';
      throw error;
    }
    if (statement === 'BEGIN') { this.staged = null; this.committed = false; return { rows: [], rowCount: null }; }
    if (statement === 'COMMIT') {
      this.stored = this.staged;
      this.committed = true;
      return { rows: [], rowCount: null };
    }
    if (statement === 'ROLLBACK') { this.staged = null; this.committed = false; return { rows: [], rowCount: null }; }
    if (statement.includes('FROM geo.areas')) {
      if (statement.includes("area_kind = 'lga'") && this.invalidLga)
        return { rows: [], rowCount: 0 };
      if (statement.includes("area_kind = 'ward'") && this.invalidWard)
        return { rows: [], rowCount: 0 };
      return { rows: [{ id: parameters[0] }], rowCount: 1 };
    }
    if (statement.includes('INSERT INTO civic_private.reports')) {
      this.staged = { reference, digestHex: parameters[2], narrative: parameters[4] };
      return { rows: [{ id: caseId, public_reference: reference, received_at: '2026-11-10T00:00:00.000Z' }], rowCount: 1 };
    }
    if (statement.includes('INSERT INTO civic_private.case_events')) {
      assert.equal(parameters[0],caseId);
      this.log.push({ kind:'intake_accepted', at:'2026-11-10T00:00:00.000Z' });
      return { rows: [], rowCount: 1 };
    }
    if (statement.includes('FROM civic_private.reports WHERE')) {
      const authorized = this.stored &&
        parameters[0] === this.stored.reference &&
        parameters[1] === this.stored.digestHex;
      return { rows: authorized ? [{ id: caseId }] : [], rowCount: authorized ? 1 : 0 };
    }
    if (statement.includes('FROM civic_private.case_events')) {
      assert.equal(parameters[0],caseId);
      return { rows: [...this.log], rowCount:this.log.length };
    }
    throw new Error('Unexpected SQL statement: ' + statement);
  }
}

function env(overrides = {}) {
  return {
    REPORTING_ENABLED:'true',
    REPORTING_HYPERDRIVE:{connectionString:'postgres://private-only-in-tests'},
    REPORTING_POLICY_VERSION:policy,
    REPORTING_RETENTION_DAYS:'30',
    REPORTING_LIMIT:{limit: async () => ({ success:true })},
    ...overrides,
  };
}
function request(path, body = valid, overrides = {}) {
  return new Request('https://ekiti.example'+path,{
    method:'POST',
    headers:{'Content-Type':'application/json',...overrides},
    body:JSON.stringify(body),
  });
}
function mockOpen(db) {
  let count = 0, closed = 0;
  return {
    open: async (connectionString) => {
      count++;
      assert.equal(connectionString, 'postgres://private-only-in-tests');
      return {db, close:async () => {closed++}};
    },
    get: () => ({ count, closed }),
  };
}

test('secure receipts use fresh 256-bit entropy and one-way digests', async () => {
  const first = await newReceiptSecret(), second = await newReceiptSecret();
  assert.match(first.secret, /^[0-9a-f]{64}$/);
  assert.match(first.digestHex,/^[0-9a-f]{64}$/);
  assert.notEqual(first.secret,second.secret);
  assert.notEqual(first.secret,first.digestHex);
  assert.equal(first.digestHex, await secretDigestHex(first.secret));
  assert.throws(() => parseTrackRequest(JSON.stringify({reference, secret:'short'})), ReceiptAccessError);
  assert.throws(() => parseTrackRequest(JSON.stringify({reference, secret:first.secret,email:'hidden'})),ReceiptAccessError);
  assert.deepEqual(parseTrackRequest(JSON.stringify({reference:reference.toUpperCase(),secret:first.secret})),
    {reference,secret:first.secret});
});

test('only a committed private database transaction can yield a receipt', async () => {
  const db = new FakePrivateDb();
  const receipt = await createPrivateReport(db, parseReportInput(JSON.stringify(valid),policy),30);
  assert.equal(db.committed,true);
  assert.equal(db.statements.at(0),'BEGIN');
  assert.equal(db.statements.at(-1),'COMMIT');
  assert.equal(receipt.reference,reference);
  assert.equal(receipt.governmentAcknowledged,false);
  assert.equal(receipt.publicationStatus,'private_pending_moderation');
  assert.match(receipt.secret,/^[a-f0-9]{64}$/);
  assert.equal(db.stored.digestHex,await secretDigestHex(receipt.secret));
  assert.ok(db.arguments.every(params=>!params.includes(receipt.secret)), 'raw receipt secret never bound to SQL');
  assert.ok(db.stored.narrative.includes('bridge'));
});

test('failure, invalid geography or duplicate request rolls back and cannot produce a receipt', async () => {
  for(const mode of ['invalidLga','invalidWard','databaseFailure','duplicate','commitFailure']) {
    const db = new FakePrivateDb();
    const input = {...valid,wardId:'inec-rac-ekiti-12'};
    if(mode==='invalidLga') db.invalidLga = true;
    if(mode==='invalidWard') db.invalidWard = true;
    if(mode==='databaseFailure'||mode==='duplicate') db.fail='INSERT INTO civic_private.reports';
    if(mode==='duplicate') db.duplicate=true;
    if(mode==='commitFailure') db.fail='COMMIT';
    await assert.rejects(
      createPrivateReport(db,parseReportInput(JSON.stringify(input),policy),30),
      error => error instanceof CaseStoreError &&
        error.code === (mode==='duplicate'?'duplicate_request':mode.includes('invalid')?'invalid_location':'unavailable'),
    );
    assert.equal(db.committed,false,mode);
    assert.equal(db.statements.at(-1),'ROLLBACK',mode);
  }
  await assert.rejects(
    createPrivateReport(new FakePrivateDb(),parseReportInput(JSON.stringify(valid),policy),0),
    error=>error.code==='unavailable',
  );
});

test('private timeline requires both reference and secret, and never exposes raw narrative', async () => {
  const db = new FakePrivateDb();
  const input = parseReportInput(JSON.stringify(valid),policy);
  const receipt = await createPrivateReport(db,input,30);
  const timeline = await readPrivateTimeline(db,reference,receipt.secret);
  assert.equal(timeline.governmentAcknowledged,false);
  assert.equal(timeline.publicMapStatus,'not_published');
  assert.deepEqual(timeline.events.map(item=>item.kind),['intake_accepted']);
  const serialized=JSON.stringify(timeline);
  assert.equal(serialized.includes(input.description),false);
  assert.equal(serialized.includes(input.place),false);
  assert.equal(serialized.includes(receipt.secret),false);
  await assert.rejects(readPrivateTimeline(db,reference,'0'.repeat(64)),
    error=>error instanceof CaseStoreError && error.code==='not_found');
});

test('Worker remains offline for real intake even with a valid body on current staging configuration', async () => {
  let opened=0, limited=0;
  const config=env({REPORTING_ENABLED:undefined,REPORTING_LIMIT:{limit:async()=>{limited++;return {success:true}}}});
  const res=await handlePrivateReporting(request('/api/reports'),config,async()=>{
    opened++;throw new Error('Must not connect');
  });
  assert.equal(res.status,404);
  assert.equal(res.headers.get('Cache-Control')?.includes('no-store'),true);
  assert.equal(opened,0);
  assert.equal(limited,0);
  const workerRes=await worker.fetch(request('/api/reports'),{});
  assert.equal(workerRes.status,404);
});

test('enabled handler requires a dedicated backend, retention and rate limiter', async () => {
  for(const overrides of [
    {REPORTING_HYPERDRIVE:undefined},
    {REPORTING_LIMIT:undefined},
    {REPORTING_POLICY_VERSION:undefined},
    {REPORTING_RETENTION_DAYS:'0'},
    {REPORTING_RETENTION_DAYS:'366'},
  ]) {
    const res=await handlePrivateReporting(request('/api/reports'),env(overrides),async()=>{throw new Error('Must not connect')});
    assert.equal(res.status,503,JSON.stringify(overrides));
  }
  const limit=await handlePrivateReporting(request('/api/reports'),
    env({REPORTING_LIMIT:{limit:async()=>({success:false})}}),async()=>{throw new Error('Must not connect')});
  assert.equal(limit.status,429);
  assert.equal(limit.headers.get('Retry-After'),'60');
});

test('reject cross-origin calls, GET requests, query-string tokens, invalid media and unsupported content', async () => {
  const config=env(), fail=async()=>{throw new Error('Should not open DB')};
  const foreign=await handlePrivateReporting(request('/api/reports',valid,{Origin:'https://evil.example'}),config,fail);
  assert.equal(foreign.status,403);
  const crossSite=await handlePrivateReporting(request('/api/reports',valid,{'Sec-Fetch-Site':'cross-site'}),config,fail);
  assert.equal(crossSite.status,403);
  const wrongMethod=await handlePrivateReporting(new Request('https://ekiti.example/api/reports'),config,fail);
  assert.equal(wrongMethod.status,405);
  const queryToken=await handlePrivateReporting(request('/api/tracking?secret=leak'),config,fail);
  assert.equal(queryToken.status,404);
  const media=await handlePrivateReporting(request('/api/reports',{...valid,email:'private@example.test'}),config,fail);
  assert.equal(media.status,400);
  const huge=await handlePrivateReporting(request('/api/reports',{...valid,description:'x'.repeat(9000)}),config,fail);
  assert.equal(huge.status,413);
});

test('enabled intake and tracking responses have a strong privacy boundary', async () => {
  const db=new FakePrivateDb(), factory=mockOpen(db);
  const accepted=await handlePrivateReporting(request('/api/reports'),env(),factory.open);
  assert.equal(accepted.status,201);
  const receipt=await accepted.json();
  assert.match(receipt.secret,/^[a-f0-9]{64}$/);
  assert.equal(receipt.governmentAcknowledged,false);
  assert.equal(accepted.headers.get('Referrer-Policy'),'no-referrer');
  assert.ok(accepted.headers.get('Cache-Control').includes('no-store'));
  const tracked=await handlePrivateReporting(request('/api/tracking',{reference:receipt.reference,secret:receipt.secret}),env(),factory.open);
  assert.equal(tracked.status,200);
  const timeline=await tracked.json();
  assert.equal(timeline.publicMapStatus,'not_published');
  assert.equal(timeline.events[0].kind,'intake_accepted');
  assert.equal(JSON.stringify(timeline).includes(valid.description),false);
  assert.equal(JSON.stringify(timeline).includes(receipt.secret),false);
  assert.deepEqual(factory.get(),{count:2,closed:2});
  const missing=await handlePrivateReporting(request('/api/tracking',{reference:receipt.reference,secret:'f'.repeat(64)}),env(),factory.open);
  assert.equal(missing.status,404);
  assert.equal(JSON.stringify(await missing.json()).includes(valid.description),false);
});

test('database write and commit errors fail closed without leaking evidence or a token', async () => {
  const db=new FakePrivateDb(); db.fail='COMMIT';
  const response=await handlePrivateReporting(request('/api/reports'),env(),mockOpen(db).open);
  assert.equal(response.status,503);
  const body=JSON.stringify(await response.json());
  assert.equal(body.includes(valid.description),false);
  assert.equal(body.includes('Fake database failure'),false);
  assert.equal(body.includes('secret'),false);
});
