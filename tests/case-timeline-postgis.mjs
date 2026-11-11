import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {secretDigestHex} from '../src/reporting/receipt-crypto.ts';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const U='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const secret='a'.repeat(64);

test('Sprint 11 real SQL timeline, ownership, contact consent and release gates are isolated',async(t)=>{
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'),
    'Only the disposable CI database can run citizen case timeline tests');
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  const before=await readFile(new URL('../db/proposals/0012_citizen_report_links.sql',import.meta.url),'utf8');
  const sql=await readFile(new URL('../db/proposals/0014_citizen_case_timeline.sql',import.meta.url),'utf8');
  let active=false;
  try{
    await db.query('BEGIN');active=true;
    await db.query("SET LOCAL ekiti.citizen_case_link_reviewed='yes'");
    await db.query(before);
    await assert.rejects(db.query(sql),
      /Citizen case timeline requires independent privacy approval/);
    await db.query('ROLLBACK');active=false;

    await db.query('BEGIN');active=true;
    await db.query("SET LOCAL ekiti.citizen_case_link_reviewed='yes'");
    await db.query("SET LOCAL ekiti.case_timeline_reviewed='yes'");
    await db.query(before);
    await db.query(sql);
    await t.test('no direct access or activation for anonymous users, signed-in users or function owner',async()=>{
      const {rows:[access]}=await db.query(`SELECT
        has_table_privilege('authenticated','civic_private.case_events','SELECT') AS raw_events,
        has_table_privilege('authenticated','civic_private.citizen_case_notice_preferences','SELECT') AS raw_preferences,
        has_table_privilege('anon','civic_private.citizen_case_review_requests','INSERT') AS anon_review,
        has_table_privilege('ekiti_case_timeline_owner','civic_private.case_timeline_release','UPDATE') AS owner_enable,
        has_function_privilege('authenticated','public.civic_my_case_timeline(uuid)','EXECUTE') AS linked_read,
        has_function_privilege('anon','public.civic_my_case_timeline(uuid)','EXECUTE') AS anonymous_read,
        has_function_privilege('authenticated','public.civic_request_case_review(uuid,text)','EXECUTE') AS linked_review`);
      assert.deepEqual(access,{raw_events:false,raw_preferences:false,anon_review:false,
        owner_enable:false,linked_read:true,anonymous_read:false,linked_review:true});
    });
    await db.query(`INSERT INTO auth.users(id,email,phone,email_confirmed_at,phone_confirmed_at)
      VALUES
        ($1,'a@tests.example','+2348012345678',now(),NULL),
        ($2,'b@tests.example',NULL,now(),NULL),
        ($3,'unconfirmed@tests.example',NULL,NULL,NULL)`,[A,B,U]);

    const result=await db.query(`INSERT INTO civic_private.reports
      (request_id,request_fingerprint,tracking_secret_digest,kind,description,
       lga_id,place,consent_policy_version,delete_at)
      VALUES(gen_random_uuid(),decode($1,'hex'),decode($2,'hex'),
        'Issue','The public road near the market is damaged and needs attention.',
        'ado-ekiti','CI-only road','ci-privacy',now()+interval '4 days')
      RETURNING id,public_reference`,['1'.repeat(64),await secretDigestHex(secret)]);
    const report=result.rows[0];
    await db.query(`INSERT INTO civic_private.case_events(report_id,kind,actor_kind,explanation)
      VALUES($1,'intake_accepted','system','Secret private platform note'),
            ($1,'under_review','moderator','Not a ministry or government response'),
            ($1,'needs_information','moderator','Sensitive internal followup request')`,
      [report.id]);

    async function asUser(user,callback){
      await db.query('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);
      try{return await callback();}
      finally{
        await db.query('SET LOCAL ROLE postgres');
        await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
      }
    }
    const timeline=async(user)=>asUser(user,async()=>{
      return (await db.query('SELECT * FROM public.civic_my_case_timeline($1::uuid)',
        [report.public_reference])).rows;
    });
    const preference=async(user,channel)=>asUser(user,async()=>{
      return (await db.query(`SELECT public.civic_set_case_notice_preference($1::uuid,$2::text) AS accepted`,
        [report.public_reference,channel])).rows[0].accepted;
    });
    const review=async(user,kind)=>asUser(user,async()=>{
      return (await db.query(`SELECT public.civic_request_case_review($1::uuid,$2::text) AS accepted`,
        [report.public_reference,kind])).rows[0].accepted;
    });

    await t.test('installed timeline is default OFF even for an explicitly linked owner',async()=>{
      await db.query(`UPDATE civic_private.citizen_link_release
        SET enabled=true,approved_at=now(),review_id='CI-ONLY-S09-APPROVAL' WHERE singleton=true`);
      assert.equal(await asUser(A,async()=>(
        await db.query('SELECT public.civic_link_private_report($1::uuid,$2::text) AS linked',
          [report.public_reference,secret])).rows[0].linked),true);
      assert.deepEqual(await timeline(A),[]);
      assert.equal(await preference(A,'email'),false);
      assert.equal(await review(A,'correction'),false);
      const status=(await db.query('SELECT enabled FROM civic_private.case_timeline_release')).rows[0];
      assert.equal(status.enabled,false);
    });

    await db.query(`UPDATE civic_private.case_timeline_release
      SET enabled=true,approved_at=now(),review_id='CI-ONLY-S11-APPROVAL'
      WHERE singleton=true`);
    await t.test('only linked and confirmed account reads source-labelled allowlisted platform event history',async()=>{
      assert.deepEqual(await timeline(B),[]);
      assert.deepEqual(await timeline(U),[]);
      const owner=await timeline(A);
      assert.equal(owner.length,1);
      const v=owner[0];
      assert.deepEqual(Object.keys(v),[
        'public_reference','kind','received_at','events',
        'notification_channel','correction_review_requested','duplicate_review_requested',
        'government_acknowledged','public_map_status',
      ]);
      assert.equal(v.public_reference,report.public_reference);
      assert.deepEqual(v.events.map(e=>e.kind),
        ['intake_accepted','under_review','needs_information']);
      for(const event of v.events)
        assert.deepEqual(Object.keys(event).sort(),['at','kind','origin']);
      assert.ok(v.events.every(e=>e.origin==='independent_platform'));
      assert.equal(v.notification_channel,'off');
      assert.equal(v.government_acknowledged,false);
      assert.equal(v.public_map_status,'not_published');
      for(const forbidden of ['Secret private platform note','ministry','damaged','CI-only road',
        'Sensitive internal followup','+2348012345678',secret])
        assert.equal(JSON.stringify(v).includes(forbidden),false,forbidden);
    });
    await t.test('preferences require a matching confirmed contact; OFF revokes consent',async()=>{
      assert.equal(await preference(B,'email'),false,'other account has no case link');
      assert.equal(await preference(U,'email'),false,'unconfirmed account rejected');
      assert.equal(await preference(A,'sms'),false,'secondary phone is not confirmed');
      assert.equal(await preference(A,'push'),false,'unsupported channel');
      assert.equal(await preference(A,'email'),true);
      let prefs=(await db.query('SELECT * FROM civic_private.citizen_case_notice_preferences')).rows;
      assert.equal(prefs.length,1);
      assert.equal(prefs[0].channel,'email');
      assert.equal(prefs[0].contact_digest.length,32);
      assert.ok(prefs[0].consent_at);
      assert.ok(!JSON.stringify(prefs).includes('a@tests.example'));
      assert.equal((await timeline(A))[0].notification_channel,'email');
      await db.query('UPDATE auth.users SET phone_confirmed_at=now() WHERE id=$1',[A]);
      assert.equal(await preference(A,'sms'),true);
      assert.equal((await timeline(A))[0].notification_channel,'sms');
      assert.equal(await preference(A,'off'),true);
      prefs=(await db.query('SELECT * FROM civic_private.citizen_case_notice_preferences')).rows;
      assert.equal(prefs[0].contact_digest,null);
      assert.equal(prefs[0].consent_at,null);
      assert.equal((await timeline(A))[0].notification_channel,'off');
    });
    await t.test('correction/possible duplicate requests remain content-free, idempotent and private',async()=>{
      assert.equal(await review(B,'correction'),false);
      assert.equal(await review(U,'correction'),false);
      assert.equal(await review(A,'unsupported'),false);
      assert.equal(await review(A,'correction'),true);
      assert.equal(await review(A,'correction'),false,'no duplicate replay');
      assert.equal(await review(A,'potential_duplicate'),true);
      const rows=(await db.query('SELECT * FROM civic_private.citizen_case_review_requests')).rows;
      assert.deepEqual(rows.map(x=>x.kind).sort(),['correction','potential_duplicate']);
      for(const row of rows)
        assert.deepEqual(Object.keys(row).sort(),['citizen_id','kind','report_id','requested_at']);
      const owner=(await timeline(A))[0];
      assert.equal(owner.correction_review_requested,true);
      assert.equal(owner.duplicate_review_requested,true);
      assert.equal(owner.events.length,3,'review requests never invent platform events');
      assert.deepEqual(await timeline(B),[]);
    });
    await t.test('account unlink removes preference and review request without deleting report',async()=>{
      assert.equal(await asUser(A,async()=>(
        await db.query('SELECT public.civic_unlink_private_report($1::uuid) AS removed',
          [report.public_reference])).rows[0].removed),true);
      assert.deepEqual(await timeline(A),[]);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.citizen_case_notice_preferences')).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.citizen_case_review_requests')).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.reports WHERE id=$1',[report.id])).rows[0].n,1);
    });
    await t.test('report expiry excludes events, deletion cascades linked account records',async()=>{
      assert.equal(await asUser(A,async()=>(
        await db.query('SELECT public.civic_link_private_report($1::uuid,$2::text) AS linked',
          [report.public_reference,secret])).rows[0].linked),true);
      assert.equal(await preference(A,'email'),true);
      await db.query("UPDATE civic_private.reports SET delete_at=now()-interval '1 second' WHERE id=$1",[report.id]);
      assert.deepEqual(await timeline(A),[]);
      assert.equal(await preference(A,'email'),false);
      await db.query('DELETE FROM civic_private.reports WHERE id=$1',[report.id]);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.citizen_case_notice_preferences')).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.citizen_case_links')).rows[0].n,0);
    });
  }finally{
    if(active)await db.query('ROLLBACK');
    await db.end();
  }
});
