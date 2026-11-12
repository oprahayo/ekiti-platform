import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {secretDigestHex} from '../src/reporting/receipt-crypto.ts';

/**
 * Runs only against disposable CI PostGIS after 0004 and 0006 proposals.
 * ALL changes including roles, functions, test rows and tables are ROLLED BACK.
 */
test('Sprint 06 private evidence SQL proposal executes transactionally and enforces receipt access',async(t)=>{
  if(!process.env.DATABASE_URL)throw Error('CI-only disposable DATABASE_URL required');
  const admin=new pg.Client({connectionString:process.env.DATABASE_URL});
  await admin.connect();
  let active=false;
  try{
    const sql=await readFile(new URL('../db/proposals/0010_private_evidence.sql',import.meta.url),'utf8');
    await admin.query('BEGIN');active=true;
    await assert.rejects(admin.query(sql),/Evidence storage has not received explicit review/);
    await admin.query('ROLLBACK');active=false;

    await admin.query('BEGIN');active=true;
    await admin.query("SET LOCAL ekiti.report_policy_approved = 'yes'");
    await admin.query("SET LOCAL ekiti.private_gateway_reviewed = 'yes'");
    await admin.query("SET LOCAL ekiti.evidence_privacy_reviewed = 'yes'");
    await admin.query(sql);

    await t.test('public and read-only app roles cannot see evidence ledger or execute functions',async()=>{
      const privileges=await admin.query(`
        SELECT
          has_schema_privilege('ekiti_location_reader','civic_private','USAGE') AS public_schema,
          has_table_privilege('ekiti_location_reader','civic_private.evidence_chunks','SELECT') AS public_chunks,
          has_table_privilege('ekiti_evidence_api','civic_private.evidence_chunks','SELECT') AS api_chunks,
          has_function_privilege('ekiti_evidence_api',
            'civic_private.start_evidence_session(uuid,bytea,text,text,text)','EXECUTE') AS api_execute`);
      assert.deepEqual(privileges.rows[0],{
        public_schema:false,public_chunks:false,api_chunks:false,api_execute:true,
      });
    });

    const digest=await secretDigestHex('b'.repeat(64));
    const report=await admin.query(`
      INSERT INTO civic_private.reports
        (request_id,request_fingerprint,tracking_secret_digest,kind,description,
         lga_id,ward_id,place,consent_policy_version,delete_at)
      VALUES(gen_random_uuid(),decode($1,'hex'),decode($2,'hex'),
        'Issue','A damaged bridge is unsafe for residents near the local market.',
        'ado-ekiti',null,'Road near market','ci-review-only',now()+interval '7 days')
      RETURNING public_reference`,['1'.repeat(64),digest]);
    const reference=report.rows[0].public_reference;
    const start=await admin.query(`
      SELECT civic_private.start_evidence_session($1::uuid,decode($2,'hex'),
        'Audio','audio/webm','ci-evidence-policy') AS id`,[reference,digest]);
    const id=start.rows[0].id;
    assert.match(id,/^[0-9a-f-]{36}$/);
    await t.test('correct receipt can create and query a session, wrong secret cannot',async()=>{
      const valid=await admin.query(`
        SELECT * FROM civic_private.evidence_session_status($1::uuid,decode($2,'hex'))`,[id,digest]);
      assert.equal(valid.rowCount,1);
      assert.equal(valid.rows[0].finished,false);
      const absent=await admin.query(`
        SELECT * FROM civic_private.evidence_session_status($1::uuid,decode($2,'hex'))`,[id,'a'.repeat(64)]);
      assert.equal(absent.rowCount,0);
      await admin.query('SAVEPOINT denied');
      await assert.rejects(admin.query(`
        SELECT civic_private.start_evidence_session($1::uuid,decode($2,'hex'),
        'Audio','audio/webm','ci-evidence-policy')`,[reference,'a'.repeat(64)]),{code:'22023'});
      await admin.query('ROLLBACK TO SAVEPOINT denied');
    });

    const objectKey='private-evidence/v1/'+crypto.randomUUID()+'/'+crypto.randomUUID();
    const checksum='f'.repeat(64);
    await t.test('sequential atomic ACK, idempotent duplicate, conflicting chunk and gaps',async()=>{
      const wrongOrder=async()=>{
        await admin.query('SAVEPOINT invalid_evidence');
        await assert.rejects(admin.query(`
          SELECT civic_private.ack_evidence_chunk($1::uuid,decode($2,'hex'),$3,
          decode($4,'hex'),$5,$6)`,[id,digest,2,checksum,5,objectKey]),{code:'22023'});
        await admin.query('ROLLBACK TO SAVEPOINT invalid_evidence');
      };
      await wrongOrder();
      const accepted=await admin.query(`
        SELECT civic_private.ack_evidence_chunk($1::uuid,decode($2,'hex'),0,
        decode($3,'hex'),5,$4) AS stored`,[id,digest,checksum,objectKey]);
      assert.equal(accepted.rows[0].stored,true);
      const retry=await admin.query(`
        SELECT civic_private.ack_evidence_chunk($1::uuid,decode($2,'hex'),0,
        decode($3,'hex'),5,$4) AS stored`,[id,digest,checksum,objectKey]);
      assert.equal(retry.rows[0].stored,false);
      const status=await admin.query(`
        SELECT * FROM civic_private.evidence_session_status($1::uuid,decode($2,'hex'))`,[id,digest]);
      assert.equal(Number(status.rows[0].total_bytes),5);
      const chunks=await admin.query(`
        SELECT index,encode(sha256,'hex') AS hash FROM
        civic_private.evidence_chunk_list($1::uuid,decode($2,'hex'))`,[id,digest]);
      assert.deepEqual(chunks.rows,[{index:0,hash:checksum}]);
      await admin.query('SAVEPOINT conflict');
      await assert.rejects(admin.query(`
        SELECT civic_private.ack_evidence_chunk($1::uuid,decode($2,'hex'),0,
        decode($3,'hex'),5,$4)`,[id,digest,'e'.repeat(64),objectKey]),{code:'23505'});
      await admin.query('ROLLBACK TO SAVEPOINT conflict');
    });
    await t.test('cannot finalize with missing index and cannot rewrite after finalization',async()=>{
      const notReady=await admin.query(`
        SELECT civic_private.finish_evidence_session($1::uuid,decode($2,'hex'),2) AS done`,[id,digest]);
      assert.equal(notReady.rows[0].done,false);
      const finished=await admin.query(`
        SELECT civic_private.finish_evidence_session($1::uuid,decode($2,'hex'),1) AS done`,[id,digest]);
      assert.equal(finished.rows[0].done,true);
      await admin.query('SAVEPOINT finished_write');
      await assert.rejects(admin.query(`
        SELECT civic_private.ack_evidence_chunk($1::uuid,decode($2,'hex'),1,
        decode($3,'hex'),5,$4)`,[id,digest,checksum,
        'private-evidence/v1/'+crypto.randomUUID()+'/'+crypto.randomUUID()]),{code:'22023'});
      await admin.query('ROLLBACK TO SAVEPOINT finished_write');
    });
  }finally{
    if(active)await admin.query('ROLLBACK');
    await admin.end();
  }
});
