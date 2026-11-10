import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createPrivatePostgresRepository } from '../src/server/admin-postgres.ts';

const actor='12345678-1234-4123-8123-123456789012';
const approver='22345678-1234-4234-8234-123456789012';
const caseA='32345678-1234-4234-8234-123456789012';
const caseB='42345678-1234-4234-8234-123456789012';
const requestA='52345678-1234-4234-8234-123456789012';
const requestB='62345678-1234-4234-8234-123456789012';
const noNotes='77345678-1234-4234-8234-123456789012';
const noteRequest='72345678-1234-4234-8234-123456789012';
const noteRequestTwo='82345678-1234-4234-8234-123456789012';
function connection() {
  assert.match(process.env.DATABASE_URL || '', /\/ekiti_test(?:$|\?)/,
    'Refusing to connect outside disposable CI database');
  return new pg.Client({connectionString:process.env.DATABASE_URL});
}
async function populate(client) {
  await client.query(`INSERT INTO civic_private.staff_memberships(
    user_id,role,active,allowed_lga_ids,approved_by,approved_at)
    VALUES ($1,'case_manager',true,ARRAY['ado-ekiti']::text[],$2,now())`,
  [actor,approver]);
  await client.query(`INSERT INTO civic_private.reports (
    id, public_reference, request_id,request_fingerprint,tracking_secret_digest,
    kind, description,lga_id,consent_policy_version,delete_at
  ) VALUES
  ($1,'97345678-1234-4234-8234-123456789012',$3,decode(repeat('11',32),'hex'),
   decode(repeat('22',32),'hex'),'Issue','Fictional broken drainage sample, not a citizen','ado-ekiti','ci-v1',now()+interval '30 days'),
  ($2,'a7345678-1234-4234-8234-123456789012',$4,decode(repeat('33',32),'hex'),
   decode(repeat('44',32),'hex'),'Complaint','Another fictional complaint for isolation only','ikere','ci-v1',now()+interval '30 days')`,
    [caseA,caseB,requestA,requestB]);
  await client.query(`INSERT INTO civic_private.case_events(report_id,kind,actor_kind,explanation)
    VALUES ($1,'under_review','moderator','Internal triage only')`,[caseA]);
}

test('CI admin SQL functions enforce independent LGA membership and no raw table rights', async () => {
  const client=connection();
  await client.connect();
  await client.query('BEGIN');
  try {
    await populate(client);
    await client.query('SET LOCAL ROLE ekiti_admin_rpc');
    const repo=createPrivatePostgresRepository(client);
    const grants=await client.query(`SELECT
      has_table_privilege(current_user,'civic_private.reports','SELECT') AS raw_reports,
      has_table_privilege(current_user,'civic_private.staff_memberships','SELECT') AS raw_staff,
      has_table_privilege(current_user,'civic_private.admin_access_audit','INSERT') AS raw_audit,
      has_function_privilege(current_user,'civic_private.admin_rpc_note(uuid,uuid,uuid,bigint,text)','EXECUTE') AS can_note`);
    assert.deepEqual(Object.values(grants.rows[0]),[false,false,false,true]);

    const membership=await repo.getMembership(actor);
    assert.equal(membership.role,'case_manager');
    assert.deepEqual(membership.allowedLgaIds,['ado-ekiti']);
    assert.equal(membership.active,true);
    assert.equal(await repo.getMembership(approver),null);

    // Attack scenario: repository method caller passes forged allowedLgas.
    // The SQL RPC re-reads the real staff membership, not this input.
    const list=await repo.listCases({actorId:actor,allowedLgas:['ikere'],lgaId:null,limit:20});
    assert.equal(list.length,1);
    assert.equal(list[0].id,caseA);
    assert.equal(list[0].currentState,'under_review');
    assert.equal(list[0].revision,1);
    assert.equal(Object.hasOwn(list[0],'description'),false);
    assert.deepEqual(await repo.listCases({actorId:actor,allowedLgas:null,lgaId:'ikere',limit:20}),[]);
    assert.equal((await repo.findCase(caseA,actor))?.lgaId,'ado-ekiti');
    assert.equal(await repo.findCase(caseB,actor),null);
    assert.equal((await repo.listEvents(caseA,50,actor)).length,1);
    assert.deepEqual(await repo.listEvents(caseB,50,actor),[]);
    await repo.recordRead({actorId:actor,action:'case_list',caseId:null,lgaId:null});
    await repo.recordRead({actorId:actor,action:'case_read',caseId:caseA,lgaId:'ado-ekiti'});

    // Internal events, audit entry, request marker and revision change atomically.
    const note='Reviewed sample record and requested further platform triage';
    const command={actorId:actor,caseId:caseA,requestId:noteRequest,
      expectedRevision:1,text:note};
    const created=await repo.createInternalNote(command);
    assert.equal(created.result,'created');
    assert.match(created.eventId,/^[a-f0-9-]{36}$/);
    assert.equal(created.revision,2);
    assert.deepEqual(await repo.createInternalNote(command),
      {result:'replayed',eventId:created.eventId,revision:2});
    assert.deepEqual(await repo.createInternalNote({
      ...command,text:'Other note with reused idempotency identifier',
    }),{result:'conflict'});
    assert.deepEqual(await repo.createInternalNote({
      ...command,requestId:noteRequestTwo,
    }),{result:'conflict'});
    assert.deepEqual(await repo.createInternalNote({
      ...command,caseId:caseB,requestId:noteRequestTwo,
    }),{result:'not_found'});
    const after=await repo.findCase(caseA,actor);
    assert.equal(after.revision,2);
    assert.equal(after.currentState,'under_review','Notes cannot change the case outcome');
    const events=await repo.listEvents(caseA,50,actor);
    assert.equal(events.length,2);
    assert.equal(events[0].kind,'internal_note');
    assert.equal(events[0].detail,note);

    await client.query('RESET ROLE');
    const dbState=await client.query(`SELECT
       (SELECT count(*) FROM civic_private.admin_note_requests WHERE report_id=$1) AS note_requests,
       (SELECT count(*) FROM civic_private.case_events WHERE report_id=$1 AND kind='internal_note') AS note_events,
       (SELECT count(*) FROM civic_private.admin_access_audit WHERE report_id=$1 AND operation='internal_note') AS write_audits,
       (SELECT revision FROM civic_private.reports WHERE id=$1) AS revision`,[caseA]);
    assert.deepEqual(dbState.rows[0],{
      note_requests:'1',note_events:'1',write_audits:'1',revision:'2',
    });
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});

test('database note and audit writes roll back as a unit if audit insertion fails', async () => {
  const client=connection();
  await client.connect();
  await client.query('BEGIN');
  try {
    await populate(client);
    // Deliberately fail the final audit insert after event + revision + note marker.
    await client.query(`CREATE FUNCTION civic_private.ci_deny_admin_audit()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'CI forced audit failure'; END $$`);
    await client.query(`CREATE TRIGGER ci_deny_admin_audit
      BEFORE INSERT ON civic_private.admin_access_audit
      FOR EACH ROW EXECUTE FUNCTION civic_private.ci_deny_admin_audit()`);
    await client.query('SET LOCAL ROLE ekiti_admin_rpc');
    const repo=createPrivatePostgresRepository(client);
    await client.query('SAVEPOINT before_attempt');
    await assert.rejects(repo.createInternalNote({
      actorId:actor,caseId:caseA,requestId:noNotes,expectedRevision:1,
      text:'A sample note whose audit insert is deliberately rejected',
    }));
    await client.query('ROLLBACK TO SAVEPOINT before_attempt');
    await client.query('RESET ROLE');
    const result=await client.query(`SELECT
      (SELECT revision FROM civic_private.reports WHERE id=$1) AS revision,
      (SELECT count(*) FROM civic_private.case_events WHERE report_id=$1 AND kind='internal_note') AS notes,
      (SELECT count(*) FROM civic_private.admin_note_requests WHERE report_id=$1) AS markers`,[caseA]);
    assert.deepEqual(result.rows[0],{revision:'1',notes:'0',markers:'0'});
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
