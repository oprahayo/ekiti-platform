import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {secretDigestHex} from '../src/reporting/receipt-crypto.ts';

const userA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secret='9'.repeat(64);
const wrongSecret='8'.repeat(64);

test('Sprint 09 receipt-to-account proposal is opt-in, least privileged and cross-account private',async(t)=>{
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'),
    'Run only with disposable CI PostGIS, never with production credentials');
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  const sql=await readFile(new URL('../db/proposals/0012_citizen_report_links.sql',import.meta.url),'utf8');
  let tx=false;
  try{
    await db.query('BEGIN');tx=true;
    await assert.rejects(db.query(sql),/awaits independent privacy approval/);
    await db.query('ROLLBACK');tx=false;
    await db.query('BEGIN');tx=true;
    await db.query("SET LOCAL ekiti.citizen_case_link_reviewed='yes'");
    await db.query(sql);
    await t.test('raw private tables denied to authenticated and public; RPCs only granted to authenticated',async()=>{
      const {rows:[p]}=await db.query(`SELECT
        has_schema_privilege('authenticated','civic_private','USAGE') AS schema,
        has_table_privilege('authenticated','civic_private.reports','SELECT') AS cases,
        has_table_privilege('authenticated','civic_private.citizen_case_links','SELECT') AS links,
        has_table_privilege('authenticated','civic_private.citizen_link_release','UPDATE') AS enable_links,
        has_table_privilege('anon','civic_private.citizen_case_links','SELECT') AS anon_links,
        has_function_privilege('authenticated','public.civic_link_private_report(uuid,text)','EXECUTE') AS link_rpc,
        has_function_privilege('anon','public.civic_my_private_reports()','EXECUTE') AS anon_history,
        has_schema_privilege('ekiti_citizen_link_owner','public','CREATE') AS owner_create`);
      assert.deepEqual(p,{schema:false,cases:false,links:false,enable_links:false,anon_links:false,
        link_rpc:true,anon_history:false,owner_create:false});
    });
    await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at)
      VALUES($1,$2,now()),($3,$4,now())`,
      [userA,'ci-a@tests.example',userB,'ci-b@tests.example']);
    const unverified='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',
      [unverified,'ci-unconfirmed@tests.example']);
    const digest=await secretDigestHex(secret);
    const report=await db.query(`INSERT INTO civic_private.reports
      (request_id,request_fingerprint,tracking_secret_digest,kind,
        description,lga_id,ward_id,place,consent_policy_version,delete_at)
      VALUES(gen_random_uuid(),decode($1,'hex'),decode($2,'hex'),
        'Issue','A bridge by the local marketplace needs maintenance for safety.',
        'ado-ekiti',NULL,'market','ci-privacy-only',now()+interval '5 days')
      RETURNING id,public_reference`,['1'.repeat(64),digest]);
    const id=report.rows[0].id,reference=report.rows[0].public_reference;
    await db.query(`INSERT INTO civic_private.case_events(report_id,kind,actor_kind)
      VALUES($1,'intake_accepted','system'),($1,'under_review','moderator')`,[id]);

    await t.test('SQL installation is independently OFF even for a valid signed-in receipt',async()=>{
      await db.query('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[userA]);
      const denied=await db.query('SELECT public.civic_link_private_report($1,$2) AS linked',
        [reference,secret]);
      assert.equal(denied.rows[0].linked,false);
      assert.equal((await db.query('SELECT * FROM public.civic_my_private_reports()')).rowCount,0);
      await db.query('SET LOCAL ROLE postgres');
      assert.equal((await db.query('SELECT enabled FROM civic_private.citizen_link_release')).rows[0].enabled,false);
    });
    // A privileged operator explicitly approves this TEST ONLY inside an
    // uncommitted transaction. Browser credentials cannot update the switch.
    await db.query(`UPDATE civic_private.citizen_link_release
      SET enabled=true,approved_at=now(),review_id='CI-ONLY-OPERATOR-APPROVAL-NEVER-LIVE'
      WHERE singleton=true`);
    assert.equal((await db.query('SELECT enabled FROM civic_private.citizen_link_release')).rows[0].enabled,true);
    assert.equal((await db.query(`SELECT tracking_secret_digest=extensions.digest(convert_to($1,'UTF8'),'sha256') AS matches
      FROM civic_private.reports WHERE id=$2`,[secret,id])).rows[0].matches,true);

    await t.test('an unverified authenticated user cannot link or read a private case',async()=>{
      await db.query('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[unverified]);
      assert.equal((await db.query('SELECT auth.uid() AS uid')).rows[0].uid,unverified);
      const denied=await db.query('SELECT public.civic_link_private_report($1,$2) AS linked',
        [reference,secret]);
      assert.equal(denied.rows[0].linked,false);
      assert.equal((await db.query('SELECT * FROM public.civic_my_private_reports()')).rowCount,0);
      await db.query('SET LOCAL ROLE postgres');
      await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
    });
    await t.test('guest cannot link, wrong secret fails and correct secret links only to explicit account',async()=>{
      // Emulate a separate anonymous request: JWT claim GUCs must not
      // accidentally survive across simulated transactions in one CI session.
      await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
      assert.equal((await db.query('SELECT auth.uid() AS uid')).rows[0].uid,null);
      const guest=await db.query('SELECT public.civic_link_private_report($1,$2) AS linked',
        [reference,secret]);
      assert.equal(guest.rows[0].linked,false);
      await db.query('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[userA]);
      const bad=await db.query('SELECT public.civic_link_private_report($1,$2) AS linked',
        [reference,wrongSecret]);
      assert.equal(bad.rows[0].linked,false);
      const authStatus=await db.query('SELECT auth.uid() AS uid');
      assert.equal(authStatus.rows[0].uid,userA,'JWT subject is present for signed-in RPC');
      const good=await db.query('SELECT public.civic_link_private_report($1,$2) AS linked',
        [reference,secret]);
      assert.equal(good.rows[0].linked,true);
      const retry=await db.query('SELECT public.civic_link_private_report($1,$2) AS linked',
        [reference,secret]);
      assert.equal(retry.rows[0].linked,true);
      await db.query('SET LOCAL ROLE postgres');
      const raw=await db.query(`SELECT citizen_id FROM civic_private.citizen_case_links
        WHERE report_id=$1`,[id]);
      assert.deepEqual(raw.rows,[{citizen_id:userA}]);
    });
    await t.test('history reveals only platform event and UUID, never narrative/location/receipt digest',async()=>{
      await db.query('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[userA]);
      const mine=await db.query('SELECT * FROM public.civic_my_private_reports()');
      assert.equal(mine.rowCount,1);
      assert.deepEqual(Object.keys(mine.rows[0]),[
        'public_reference','kind','received_at','last_platform_event',
        'government_acknowledged','public_map_status',
      ]);
      assert.equal(mine.rows[0].last_platform_event,'under_review');
      assert.equal(mine.rows[0].government_acknowledged,false);
      assert.equal(mine.rows[0].public_map_status,'not_published');
      assert.ok(!JSON.stringify(mine.rows).includes(secret));
      assert.ok(!JSON.stringify(mine.rows).includes('marketplace'));
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[userB]);
      const others=await db.query('SELECT * FROM public.civic_my_private_reports()');
      assert.equal(others.rowCount,0);
      const steal=await db.query('SELECT public.civic_link_private_report($1,$2) AS linked',
        [reference,secret]);
      assert.equal(steal.rows[0].linked,false,'correct receipt does not silently transfer ownership');
      const unlinkOther=await db.query('SELECT public.civic_unlink_private_report($1) AS unlinked',[reference]);
      assert.equal(unlinkOther.rows[0].unlinked,false);
      await db.query('SET LOCAL ROLE postgres');
    });
    await t.test('owner can explicitly unlink; report is not deleted and link reclaims only with receipt',async()=>{
      await db.query('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[userA]);
      const removed=await db.query('SELECT public.civic_unlink_private_report($1) AS unlinked',[reference]);
      assert.equal(removed.rows[0].unlinked,true);
      assert.equal((await db.query('SELECT * FROM public.civic_my_private_reports()')).rowCount,0);
      await db.query('SET LOCAL ROLE postgres');
      assert.equal((await db.query('SELECT id FROM civic_private.reports WHERE id=$1',[id])).rowCount,1);
      await db.query('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[userB]);
      const relink=await db.query('SELECT public.civic_link_private_report($1,$2) AS linked',
        [reference,secret]);
      assert.equal(relink.rows[0].linked,true);
      await db.query('SET LOCAL ROLE postgres');
    });
    await t.test('retention deletion cascades to linked account index',async()=>{
      await db.query('DELETE FROM civic_private.reports WHERE id=$1',[id]);
      assert.equal((await db.query('SELECT * FROM civic_private.citizen_case_links WHERE report_id=$1',[id])).rowCount,0);
    });
  }finally{
    if(tx)await db.query('ROLLBACK');
    await db.end();
  }
});
