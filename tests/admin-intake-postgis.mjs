import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';

const actor='12345678-1234-4123-8123-123456789012';
const moderator='22345678-1234-4234-8234-123456789012';
const admin='32345678-1234-4234-8234-123456789012';
const auditor='42345678-1234-4234-8234-123456789012';
const caseA='52345678-1234-4234-8234-123456789012';
const caseB='62345678-1234-4234-8234-123456789012';
const caseC='72345678-1234-4234-8234-123456789012';
const rId=(n)=>`82345678-1234-4234-8234-1234567890${n}`;

test('Sprint 13 scoped private intake proposal is opt-in, default-off, audited and rollback-only',async t=>{
  assert.match(process.env.DATABASE_URL||'',/\/ekiti_test(?:$|\?)/);
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  const sql=await readFile(new URL('../db/proposals/admin_0009_intake_review.sql',import.meta.url),'utf8');
  let inTx=false;
  try{
    await db.query('BEGIN');inTx=true;
    await assert.rejects(db.query(sql),/requires independent safeguarding review/);
    await db.query('ROLLBACK');inTx=false;

    await db.query('BEGIN');inTx=true;
    await db.query("SET LOCAL ekiti.admin_intake_reviewed='yes'");
    await db.query(sql);
    await t.test('raw intake/review tables and release switch denied to public, auth, admin RPC',async()=>{
      const {rows:[p]}=await db.query(`SELECT
        has_table_privilege('ekiti_admin_rpc','civic_private.admin_intake_release','UPDATE') AS switch_update,
        has_table_privilege('ekiti_admin_rpc','civic_private.admin_intake_review_proposals','SELECT') AS proposal_read,
        has_table_privilege('authenticated','civic_private.admin_intake_review_proposals','INSERT') AS citizen_propose,
        has_function_privilege('ekiti_admin_rpc','civic_private.admin_rpc_intake_cases(uuid,text,text,text,integer)','EXECUTE') AS admin_list,
        has_function_privilege('anon','civic_private.admin_rpc_intake_cases(uuid,text,text,text,integer)','EXECUTE') AS anon_list,
        has_function_privilege('authenticated','civic_private.admin_rpc_intake_propose(uuid,uuid,text,text,bigint)','EXECUTE') AS public_write`);
      assert.deepEqual(p,{switch_update:false,proposal_read:false,citizen_propose:false,
        admin_list:true,anon_list:false,public_write:false});
    });
    await db.query(`UPDATE geo.areas SET verification_state='verified'
      WHERE id IN('ado-ekiti','ikere')`);
    await db.query(`INSERT INTO civic_private.staff_memberships(
        user_id,role,active,allowed_lga_ids,approved_by,approved_at)
      VALUES
        ($1,'case_manager',true,ARRAY['ado-ekiti']::text[],$3,now()),
        ($2,'moderator',true,ARRAY['ado-ekiti']::text[],$3,now()),
        ($3,'platform_admin',true,ARRAY[]::text[],$1,now()),
        ($4,'auditor',true,ARRAY[]::text[],$3,now())`,
      [actor,moderator,admin,auditor]);
    await db.query(`INSERT INTO civic_private.reports(
        id,public_reference,request_id,request_fingerprint,tracking_secret_digest,
        kind,description,lga_id,consent_policy_version,delete_at)
      VALUES
       ($1,'a2345678-1234-4234-8234-123456789012',$4,
        decode(repeat('11',32),'hex'),decode(repeat('a1',32),'hex'),
        'Issue','Sensitive details from a community member must remain private',
        'ado-ekiti','ci-v1',now()+interval '30 days'),
       ($2,'b2345678-1234-4234-8234-123456789012',$5,
        decode(repeat('22',32),'hex'),decode(repeat('b2',32),'hex'),
        'Complaint','Private contact and allegation must never be returned',
        'ikere','ci-v1',now()+interval '30 days'),
       ($3,'c2345678-1234-4234-8234-123456789012',$6,
        decode(repeat('33',32),'hex'),decode(repeat('c3',32),'hex'),
        'Commendation','Unpublished platform details',
        'ado-ekiti','ci-v1',now()+interval '30 days')`,
      [caseA,caseB,caseC,rId('10'),rId('11'),rId('12')]);
    await db.query(`INSERT INTO civic_private.case_events(report_id,kind,actor_kind,explanation)
      VALUES($1,'under_review','moderator','Not sent to government'),
        ($2,'closed','moderator','Platform-only review ended')`,[caseA,caseB]);

    const asRpc=async action=>{
      await db.query('SET LOCAL ROLE ekiti_admin_rpc');
      try{return await action();}
      finally{
        // An expected SQL exception aborts the disposable transaction until
        // the surrounding SAVEPOINT is rolled back. Never replace the
        // original exception with a second "transaction aborted" error.
        try{await db.query('SET LOCAL ROLE postgres');}
        catch{/* Caller restores the savepoint for expected failures. */}
      }
    };
    const list=(who,lga=null,kind=null,state=null,limit=20)=>asRpc(async()=>{
      return (await db.query(`SELECT * FROM civic_private.admin_rpc_intake_cases(
        $1::uuid,$2::text,$3::text,$4::text,$5::integer)`,
        [who,lga,kind,state,limit])).rows;
    });
    const propose=(who,id,kind,target=null,revision=1)=>asRpc(async()=>{
      return (await db.query(`SELECT civic_private.admin_rpc_intake_propose(
        $1::uuid,$2::uuid,$3::text,$4::text,$5::bigint) AS v`,
        [who,id,kind,target,revision])).rows[0].v;
    });

    await t.test('SQL install alone neither lists cases nor accepts proposals',async()=>{
      assert.deepEqual(await list(actor),[]);
      assert.deepEqual(await propose(actor,caseA,'safeguarding_review'),
        {result:'not_available'});
      assert.equal((await db.query('SELECT enabled FROM civic_private.admin_intake_release')).rows[0].enabled,false);
    });
    await db.query(`UPDATE civic_private.admin_intake_release
      SET enabled=true,approved_at=now(),review_id='CI-ONLY-REVIEWED-RELEASE'
      WHERE singleton`);

    await t.test('query enforces both real membership and verified LGA with enum filters',async()=>{
      const scoped=await list(actor);
      assert.deepEqual(scoped.map(x=>x.id).sort(),[caseA,caseC].sort());
      assert.ok(scoped.every(x=>x.evidence_access==='blocked_pending_safeguarding'));
      assert.ok(!JSON.stringify(scoped).includes('community member'));
      assert.ok(!JSON.stringify(scoped).includes('contact and allegation'));
      assert.ok(scoped.every(x=>!Object.hasOwn(x,'description')));
      assert.equal((await list(actor,'ado-ekiti','Issue','under_review')).length,1);
      assert.equal((await list(actor,'ado-ekiti','Complaint')).length,0);
      assert.deepEqual(await list(actor,'ikere'),[]);
      assert.deepEqual(await list(auditor),[]);
      assert.equal((await list(admin)).length,3);
      await db.query('SAVEPOINT bad_intake_kind');
      await assert.rejects(list(actor,null,'Anything'),/Invalid intake filters/);
      await db.query('ROLLBACK TO SAVEPOINT bad_intake_kind');
      await db.query('SAVEPOINT bad_intake_limit');
      await assert.rejects(list(actor,null,null,null,1000),/Invalid intake filters/);
      await db.query('ROLLBACK TO SAVEPOINT bad_intake_limit');
    });

    await t.test('moderators propose safeguarding and duplicate review only, no assignment',async()=>{
      assert.deepEqual(await propose(moderator,caseA,'assignment_review','ado-ekiti'),
        {result:'not_available'});
      const safe=await propose(moderator,caseA,'safeguarding_review');
      assert.equal(safe.result,'queued');
      assert.deepEqual(await propose(moderator,caseA,'safeguarding_review'),
        {result:'replayed',proposalId:safe.proposalId});
      assert.equal((await propose(moderator,caseA,'possible_duplicate')).result,'queued');
      assert.deepEqual(await propose(moderator,caseB,'possible_duplicate'),
        {result:'not_available'});
      assert.deepEqual(await propose(auditor,caseA,'safeguarding_review'),
        {result:'not_available'});
    });
    await t.test('assignment proposal validates target LGA scope; never contacts office',async()=>{
      assert.deepEqual(await propose(actor,caseA,'assignment_review','ikere'),
        {result:'not_available'});
      assert.deepEqual(await propose(actor,caseA,'assignment_review','fictional-lga'),
        {result:'not_available'});
      assert.equal((await propose(actor,caseA,'assignment_review','ado-ekiti')).result,'queued');
      const other=await propose(admin,caseB,'assignment_review','ado-ekiti');
      assert.equal(other.result,'queued');
      assert.equal((await propose(actor,caseA,'assignment_review','ado-ekiti',2)).result,'conflict');
      const cases=await db.query('SELECT id,revision,lga_id FROM civic_private.reports ORDER BY id');
      assert.ok(cases.rows.every(x=>Number(x.revision)===1),
        'Proposal-only writes must not modify a report revision');
      assert.deepEqual(cases.rows.find(x=>x.id===caseA).lga_id,'ado-ekiti',
        'proposal must not transfer geography');
      const proposals=await db.query('SELECT * FROM civic_private.admin_intake_review_proposals');
      assert.ok(proposals.rows.every(x=>x.status==='pending'));
      const audits=await db.query('SELECT * FROM civic_private.admin_intake_review_audit');
      assert.equal(audits.rowCount,proposals.rowCount);
      assert.ok(audits.rows.every(x=>x.action==='proposed_only'));
    });
    await t.test('audit failure rolls back proposal creation atomically',async()=>{
      await db.query(`CREATE FUNCTION civic_private.ci_reject_intake_audit()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Audit rejected in CI'; END $$`);
      await db.query(`CREATE TRIGGER ci_reject_intake_audit
        BEFORE INSERT ON civic_private.admin_intake_review_audit
        FOR EACH ROW EXECUTE FUNCTION civic_private.ci_reject_intake_audit()`);
      await db.query('SAVEPOINT pre_proposal');
      await assert.rejects(propose(actor,caseC,'safeguarding_review'),/Audit rejected in CI/);
      await db.query('ROLLBACK TO SAVEPOINT pre_proposal');
      assert.equal((await db.query(`SELECT count(*)::integer AS n FROM
        civic_private.admin_intake_review_proposals WHERE report_id=$1`,[caseC])).rows[0].n,0);
    });
    await t.test('immediate membership revocation and report expiry deny all future reads/writes',async()=>{
      await db.query('UPDATE civic_private.staff_memberships SET active=false WHERE user_id=$1',[actor]);
      assert.deepEqual(await list(actor),[]);
      assert.deepEqual(await propose(actor,caseC,'possible_duplicate'),{result:'not_available'});
      await db.query('UPDATE civic_private.staff_memberships SET active=true WHERE user_id=$1',[actor]);
      await db.query("UPDATE civic_private.reports SET received_at=now()-interval '5 days',delete_at=now()-interval '1 day' WHERE id=$1",[caseC]);
      assert.equal((await list(actor)).some(x=>x.id===caseC),false);
      assert.deepEqual(await propose(actor,caseC,'possible_duplicate'),{result:'not_available'});
    });
  }finally{
    if(inTx)await db.query('ROLLBACK');
    await db.end();
  }
});
