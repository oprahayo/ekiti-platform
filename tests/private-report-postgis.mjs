import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { parseReportInput } from '../src/reporting/intake-contract.ts';
import { createPrivateReport, readPrivateTimeline, CaseStoreError } from '../src/reporting/private-case-store.ts';

const url = new URL(process.env.DATABASE_URL || '');
const appUrl = new URL(url);
appUrl.username = 'report_ci'; appUrl.password = 'ci';
const policy = 'approved-ci-only-v1';

test('real disposable Postgres has a narrowly granted private gateway and cryptographic receipts', async (t) => {
  const admin = new pg.Client({connectionString:process.env.DATABASE_URL});
  const app = new pg.Client({connectionString:appUrl.toString()});
  await admin.connect(); await app.connect();
  try {
    await t.test('dedicated app can invoke functions but cannot read sensitive tables directly', async () => {
      await assert.rejects(app.query('SELECT * FROM civic_private.reports LIMIT 1'),/permission denied/i);
      await assert.rejects(app.query('SELECT * FROM civic_private.case_events LIMIT 1'),/permission denied/i);
      await assert.rejects(app.query('SELECT * FROM geo.areas LIMIT 1'),/permission denied/i);
      await assert.rejects(app.query('SELECT civic_private.purge_expired_private_reports()'),/permission denied/i);
    });
    const clientRequestId = crypto.randomUUID();
    const input = parseReportInput(JSON.stringify({
      kind:'Issue',
      description:'The village bridge has developed serious cracks and may collapse after rain.',
      lgaId:'ado-ekiti', wardId:null, place:'Public market junction',
      clientRequestId,consent:true,consentPolicyVersion:policy,
    }),policy);
    let receipt;
    await t.test('transaction commits a real case and its intake event, then issues a secret', async () => {
      receipt = await createPrivateReport(app,input,30);
      assert.match(receipt.secret,/^[a-f0-9]{64}$/);
      assert.equal(receipt.governmentAcknowledged,false);
      assert.equal(receipt.publicationStatus,'private_pending_moderation');
      const count = await admin.query(
        'SELECT count(*)::int AS count FROM civic_private.case_events e JOIN civic_private.reports r ON r.id=e.report_id WHERE r.public_reference=$1',
        [receipt.reference],
      );
      assert.equal(count.rows[0].count,1);
    });
    await t.test('tracking requires correct reference and secret, never returns narratives', async () => {
      const timeline=await readPrivateTimeline(app,receipt.reference,receipt.secret);
      assert.equal(timeline.publicMapStatus,'not_published');
      assert.deepEqual(timeline.events.map(e=>e.kind),['intake_accepted']);
      assert.equal(JSON.stringify(timeline).includes(input.description),false);
      await assert.rejects(readPrivateTimeline(app,receipt.reference,'0'.repeat(64)),
        error=>error instanceof CaseStoreError && error.code==='not_found');
    });
    await t.test('duplicate request cannot mint a second access token', async () => {
      await assert.rejects(createPrivateReport(app,input,30),
        error=>error instanceof CaseStoreError && error.code==='duplicate_request');
    });
    await t.test('invalid ward is rejected inside private gateway without storing a case', async () => {
      const invalid={...input,clientRequestId:crypto.randomUUID(),wardId:'inec-rac-ekiti-999'};
      await assert.rejects(createPrivateReport(app,invalid,30),
        error=>error instanceof CaseStoreError && error.code==='invalid_location');
      const count=await admin.query('SELECT count(*)::int AS count FROM civic_private.reports WHERE request_id=$1',[invalid.clientRequestId]);
      assert.equal(count.rows[0].count,0);
    });
    await t.test('maintenance can purge expired records through separate role function', async () => {
      // Only in an ephemeral CI database; adjust dates without violating
      // the constraint delete_at > received_at.
      await admin.query(
        "UPDATE civic_private.reports SET received_at=now()-interval '3 days', delete_at=now()-interval '1 day' WHERE public_reference=$1",
        [receipt.reference],
      );
      const removed=await admin.query('SELECT civic_private.purge_expired_private_reports() AS count');
      assert.ok(removed.rows[0].count>=1);
      await assert.rejects(readPrivateTimeline(app,receipt.reference,receipt.secret),
        error=>error instanceof CaseStoreError && error.code==='not_found');
    });
    await t.test('public reader group has no private-case grants', async () => {
      const priv=await admin.query(`
        SELECT has_schema_privilege('ekiti_location_reader','civic_private','USAGE') AS schema,
          has_table_privilege('ekiti_location_reader','civic_private.reports','SELECT') AS records`);
      assert.equal(priv.rows[0].schema,false);
      assert.equal(priv.rows[0].records,false);
    });
  } finally {
    await app.end(); await admin.end();
  }
});
