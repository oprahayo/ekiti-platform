import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {secretDigestHex} from '../src/reporting/receipt-crypto.ts';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UNVERIFIED='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SECRET_A='1'.repeat(64),SECRET_B='2'.repeat(64);
const TOK1='a'.repeat(64),TOK2='b'.repeat(64),TOK3='c'.repeat(64);

test('Sprint10 default-off verified delivery SQL, exact scope, single use, expiry and rollback',async(t)=>{
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'),'Disposable CI only');
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  const prev=await readFile(new URL('../db/proposals/0012_citizen_report_links.sql',import.meta.url),'utf8');
  const sql=await readFile(new URL('../db/proposals/0013_private_case_delivery.sql',import.meta.url),'utf8');
  let active=false;
  try{
    await db.query('BEGIN');active=true;
    await db.query("SET LOCAL ekiti.citizen_case_link_reviewed='yes'");
    await db.query(prev);
    await assert.rejects(db.query(sql),/requires independent operator and privacy approval/);
    await db.query('ROLLBACK');active=false;

    await db.query('BEGIN');active=true;
    await db.query("SET LOCAL ekiti.citizen_case_link_reviewed='yes'");
    await db.query("SET LOCAL ekiti.case_delivery_reviewed='yes'");
    await db.query(prev);
    await db.query(sql);
    await t.test('reader/anon/auth roles cannot enumerate queue or impersonate sender',async()=>{
      const x=await db.query(`SELECT
        has_table_privilege('authenticated','civic_private.case_link_outbox','SELECT') AS auth_queue,
        has_table_privilege('anon','civic_private.case_link_outbox','SELECT') AS anon_queue,
        has_table_privilege('ekiti_location_reader','civic_private.case_link_outbox','SELECT') AS public_queue,
        has_table_privilege('ekiti_case_delivery_api','civic_private.case_link_outbox','SELECT') AS sender_queue,
        has_function_privilege('authenticated',
          'public.civic_request_case_link(uuid,text,text)','EXECUTE') AS user_request,
        has_function_privilege('authenticated',
          'civic_private.case_link_delivery_lease(bytea)','EXECUTE') AS auth_lease,
        has_function_privilege('ekiti_case_delivery_api',
          'civic_private.case_link_delivery_lease(bytea)','EXECUTE') AS sender_lease,
        has_function_privilege('ekiti_case_delivery_api',
          'civic_private.case_link_delivery_purge()','EXECUTE') AS sender_purge`);
      assert.deepEqual(x.rows[0],{auth_queue:false,anon_queue:false,public_queue:false,
        sender_queue:false,user_request:true,auth_lease:false,sender_lease:true,sender_purge:false});
    });
    await db.query(`INSERT INTO auth.users
      (id,email,phone,email_confirmed_at,phone_confirmed_at) VALUES
      ($1,'a@tests.example',NULL,now(),NULL),
      ($2,'b@tests.example','+2348012345678',NULL,now()),
      ($3,'unverified@tests.example',NULL,NULL,NULL)`,[A,B,UNVERIFIED]);

    const insertReport=async(secret,fingerprint)=> {
      const result=await db.query(`INSERT INTO civic_private.reports
        (request_id,request_fingerprint,tracking_secret_digest,kind,description,
         lga_id,place,consent_policy_version,delete_at)
        VALUES(gen_random_uuid(),decode($1,'hex'),decode($2,'hex'),'Issue',
          'This CI-only road needs significant maintenance in the public square.',
          'ado-ekiti','Public square','ci-policy',now()+interval '3 days')
        RETURNING id,public_reference`,[fingerprint,await secretDigestHex(secret)]);
      return result.rows[0];
    };
    const reportA=await insertReport(SECRET_A,'3'.repeat(64));
    const reportB=await insertReport(SECRET_B,'4'.repeat(64));

    async function caller(uid,work){
      await db.query('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);
      try{return await work();}
      finally{
        await db.query('SET LOCAL ROLE postgres');
        await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
      }
    }
    const request=async(uid,ref,receipt,channel)=>caller(uid,async()=>{
      const r=await db.query(`SELECT public.civic_request_case_link($1::uuid,$2::text,$3::text) AS result`,
        [ref,receipt,channel]);
      return r.rows[0].result;
    });
    const redeem=async(uid,token)=>caller(uid,async()=>{
      const r=await db.query('SELECT public.civic_redeem_case_link($1::text) AS result',[token]);
      return r.rows[0].result;
    });
    const lease=async(token)=>{
      await db.query('SET LOCAL ROLE ekiti_case_delivery_api');
      try{
        return (await db.query(`SELECT * FROM civic_private.case_link_delivery_lease(
          decode($1,'hex'))`,[await secretDigestHex(token)])).rows;
      }finally{await db.query('SET LOCAL ROLE postgres');}
    };
    const settle=async(id,attempt,accepted)=>{
      await db.query('SET LOCAL ROLE ekiti_case_delivery_api');
      try{
        return (await db.query(`SELECT civic_private.case_link_delivery_settle(
          $1::uuid,$2::integer,$3::boolean) AS result`,[id,attempt,accepted])).rows[0].result;
      }finally{await db.query('SET LOCAL ROLE postgres');}
    };

    await t.test('SQL install keeps both request and delivery disabled even with a valid receipt',async()=>{
      assert.equal(await request(A,reportA.public_reference,SECRET_A,'email'),false);
      assert.deepEqual(await lease(TOK1),[]);
      assert.equal(await redeem(A,TOK1),false);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.case_link_outbox')).rows[0].n,0);
    });
    // An operator explicitly approves both feature layers for this
    // disposable transaction ONLY; the runner always rolls everything back.
    await db.query(`UPDATE civic_private.citizen_link_release
      SET enabled=true,approved_at=now(),review_id='CI-ONLY-S09-OPERATOR'
      WHERE singleton=true`);
    await db.query(`UPDATE civic_private.case_link_release
      SET enabled=true,approved_at=now(),review_id='CI-ONLY-S10-OPERATOR'
      WHERE singleton=true`);
    await t.test('unverified, incorrect receipt and unconfirmed channel cannot enqueue',async()=>{
      assert.equal(await request(UNVERIFIED,reportA.public_reference,SECRET_A,'email'),false);
      assert.equal(await request(A,reportA.public_reference,SECRET_B,'email'),false);
      assert.equal(await request(A,reportA.public_reference,SECRET_A,'sms'),false);
      assert.equal(await request(B,reportB.public_reference,SECRET_B,'email'),false);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.case_link_outbox')).rows[0].n,0);
    });
    await t.test('recipient proof queues once with cooldown, stores only a hashed destination',async()=>{
      assert.equal(await request(A,reportA.public_reference,SECRET_A,'email'),true);
      assert.equal(await request(A,reportA.public_reference,SECRET_A,'email'),false);
      const q=(await db.query('SELECT * FROM civic_private.case_link_outbox WHERE report_id=$1',[reportA.id])).rows[0];
      assert.equal(q.status,'queued');assert.equal(q.attempts,0);
      assert.equal(q.contact_digest.length,32);assert.equal(q.token_digest,null);
      assert.equal(Object.hasOwn(q,'destination'),false);
      assert.equal(JSON.stringify(q).includes('a@tests.example'),false);
    });
    await t.test('provider failure schedules bounded retry and rotates old token',async()=>{
      const [first]=await lease(TOK1);
      assert.equal(first.channel,'email');assert.equal(first.destination,'a@tests.example');
      assert.equal(first.attempt,1);
      assert.equal(await settle(first.delivery_id,1,false),true);
      assert.equal(await settle(first.delivery_id,1,true),false,'stale ACK rejected');
      const retry=(await db.query('SELECT status,attempts,next_attempt_at FROM civic_private.case_link_outbox WHERE id=$1',[first.delivery_id])).rows[0];
      assert.equal(retry.status,'queued');assert.equal(retry.attempts,1);
      assert.ok(new Date(retry.next_attempt_at).getTime()>Date.now());
      assert.deepEqual(await lease(TOK2),[],'cooldown is enforced by DB');
      await db.query("UPDATE civic_private.case_link_outbox SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[first.delivery_id]);
      const [second]=await lease(TOK2);
      assert.equal(second.attempt,2);
      assert.equal(await settle(second.delivery_id,2,true),true);
      assert.equal(await settle(second.delivery_id,2,true),false,'same ACK not reusable');
      const q=(await db.query('SELECT token_digest,status FROM civic_private.case_link_outbox WHERE id=$1',[first.delivery_id])).rows[0];
      assert.equal(q.status,'provider_accepted');
      assert.equal(q.token_digest.toString('hex'),await secretDigestHex(TOK2));
      assert.equal(await redeem(A,TOK1),false,'old rotated token invalid');
    });
    await t.test('forwarded token does not redeem for another account; valid token is single use',async()=>{
      assert.equal(await redeem(B,TOK2),false);
      assert.equal(await redeem(UNVERIFIED,TOK2),false);
      assert.equal(await redeem(A,TOK2),true);
      assert.equal(await redeem(A,TOK2),false);
      const mine=await caller(A,async()=>
        (await db.query('SELECT * FROM public.civic_my_private_reports()')).rows);
      assert.equal(mine.length,1);
      assert.equal(mine[0].public_reference,reportA.public_reference);
      assert.equal(mine[0].government_acknowledged,false);
      assert.equal(mine[0].public_map_status,'not_published');
      assert.ok(!JSON.stringify(mine).includes('public square'));
      const other=await caller(B,async()=>
        (await db.query('SELECT * FROM public.civic_my_private_reports()')).rows);
      assert.equal(other.length,0);
    });
    await t.test('SMS destination is verified at dispatch; changed contact fails closed',async()=>{
      assert.equal(await request(B,reportB.public_reference,SECRET_B,'sms'),true);
      await db.query("UPDATE auth.users SET phone='+2348099999999' WHERE id=$1",[B]);
      assert.deepEqual(await lease(TOK3),[],'queued SMS not sent to a changed number');
      await db.query("UPDATE auth.users SET phone='+2348012345678' WHERE id=$1",[B]);
      const [msg]=await lease(TOK3);
      assert.equal(msg.channel,'sms');
      assert.equal(msg.destination,'+2348012345678');
      assert.equal(await settle(msg.delivery_id,1,true),true);
    });
    await t.test('expired token does not redeem, even to original verified user',async()=>{
      await db.query("UPDATE civic_private.case_link_outbox SET token_expires_at=now()-interval '1 second' WHERE citizen_id=$1",[B]);
      assert.equal(await redeem(B,TOK3),false);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.citizen_case_links WHERE citizen_id=$1',[B])).rows[0].n,0);
    });
    await t.test('report deletion cascades to pending and redeemed delivery rows',async()=>{
      await db.query('DELETE FROM civic_private.reports WHERE id IN($1,$2)',[reportA.id,reportB.id]);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.case_link_outbox')).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.citizen_case_links')).rows[0].n,0);
    });
  }finally{
    if(active)await db.query('ROLLBACK');
    await db.end();
  }
});
