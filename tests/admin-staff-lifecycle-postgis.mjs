import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const adminA='11111111-1111-4111-8111-111111111111';
const adminB='22222222-2222-4222-8222-222222222222';
const target='33333333-3333-4333-8333-333333333333';
const other='44444444-4444-4444-8444-444444444444';

test('Sprint 12 lifecycle proposal is default-off, dual-controlled and isolated',async t=>{
  assert.ok(process.env.DATABASE_URL?.includes('/ekiti_test'),'Disposable CI DB only');
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  const sql=await readFile(new URL('../db/proposals/admin_0008_staff_lifecycle.sql',import.meta.url),'utf8');
  let transaction=false;
  try{
    await db.query('BEGIN');transaction=true;
    await assert.rejects(db.query(sql),/awaits operator and security approval/);
    await db.query('ROLLBACK');transaction=false;
    await db.query('BEGIN');transaction=true;
    await db.query("SET LOCAL ekiti.staff_lifecycle_reviewed='yes'");
    await db.query(sql);

    const allowedExpires=new Date(Date.now()+10*24*3600_000);
    await db.query(`INSERT INTO auth.users(id,email) VALUES
      ($1,'a@ci.invalid'),($2,'b@ci.invalid'),($3,'c@ci.invalid'),($4,'d@ci.invalid')`,
      [adminA,adminB,target,other]);
    await db.query(`INSERT INTO civic_private.staff_memberships
      (user_id,role,active,allowed_lga_ids,approved_by,approved_at)
      VALUES($1,'platform_admin',true,ARRAY[]::text[],$2,now()),
            ($2,'platform_admin',true,ARRAY[]::text[],$1,now())`,
      [adminA,adminB]);
    await db.query(`UPDATE geo.areas SET verification_state='verified'
      WHERE id IN ('ado-ekiti','ikere')`);

    const propose=async(actor,user,role,lgas,expires=allowedExpires)=>{
      const r=await db.query(`SELECT civic_private.staff_lifecycle_propose(
        $1::uuid,$2::uuid,$3::text,$4::text[],$5::timestamptz) AS id`,
        [actor,user,role,lgas,expires]);
      return r.rows[0].id;
    };
    const approve=async(actor,id)=>{
      const r=await db.query('SELECT civic_private.staff_lifecycle_approve($1::uuid,$2::uuid) AS result',
        [actor,id]);return r.rows[0].result;
    };
    const revoke=async(actor,user,reason)=>{
      const r=await db.query(`SELECT civic_private.staff_lifecycle_revoke(
        $1::uuid,$2::uuid,$3::text) AS result`,[actor,user,reason]);
      return r.rows[0].result;
    };
    const membership=async(user)=>{
      await db.query('SET LOCAL ROLE ekiti_admin_rpc');
      try{return (await db.query('SELECT * FROM civic_private.admin_rpc_membership($1::uuid)',
        [user])).rows;}
      finally{await db.query('SET LOCAL ROLE postgres');}
    };

    await t.test('public, Supabase citizen and existing admin API have no invitation or table access',async()=>{
      const r=await db.query(`SELECT
        has_function_privilege('anon',
          'civic_private.staff_lifecycle_propose(uuid,uuid,text,text[],timestamptz)',
          'EXECUTE') AS anonymous_propose,
        has_function_privilege('authenticated',
          'civic_private.staff_lifecycle_approve(uuid,uuid)','EXECUTE') AS citizen_approve,
        has_function_privilege('ekiti_admin_rpc',
          'civic_private.staff_lifecycle_revoke(uuid,uuid,text)','EXECUTE') AS gateway_revoke,
        has_table_privilege('ekiti_staff_lifecycle_operator',
          'civic_private.staff_memberships','UPDATE') AS operator_write_membership,
        has_table_privilege('ekiti_staff_lifecycle_operator',
          'civic_private.staff_lifecycle_release','UPDATE') AS operator_enable,
        has_function_privilege('ekiti_staff_lifecycle_operator',
          'civic_private.staff_lifecycle_propose(uuid,uuid,text,text[],timestamptz)',
          'EXECUTE') AS operator_propose`);
      assert.deepEqual(r.rows[0],{
        anonymous_propose:false,citizen_approve:false,gateway_revoke:false,
        operator_write_membership:false,operator_enable:false,operator_propose:true,
      });
    });

    await t.test('a valid platform admin still cannot grant anything before operator approval',async()=>{
      assert.equal(await propose(adminA,target,'case_manager',['ado-ekiti']),null);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM civic_private.staff_invitation_proposals')).rows[0].n,0);
      assert.equal((await membership(target)).length,0);
      assert.equal((await db.query('SELECT enabled FROM civic_private.staff_lifecycle_release')).rows[0].enabled,false);
    });

    // This is a disposable transaction only. The operator controls this switch
    // outside any staff web app or existing admin SQL role.
    await db.query(`UPDATE civic_private.staff_lifecycle_release
      SET enabled=true,approved_at=now(),review_id='CI-ONLY-DUAL-APPROVAL' WHERE singleton`);

    await t.test('self-approval, unverified LGA, elevated roles and excessive durations are rejected',async()=>{
      assert.equal(await propose(adminA,adminA,'case_manager',['ado-ekiti']),null);
      assert.equal(await propose(adminA,target,'platform_admin',['ado-ekiti']),null);
      assert.equal(await propose(adminA,target,'government_officer',['ado-ekiti']),null);
      assert.equal(await propose(adminA,target,'auditor',['ado-ekiti']),null);
      assert.equal(await propose(adminA,target,'case_manager',[]),null);
      assert.equal(await propose(adminA,target,'case_manager',['not-in-ekiti']),null);
      assert.equal(await propose(adminA,target,'case_manager',['ado-ekiti','ado-ekiti']),null);
      assert.equal(await propose(adminA,target,'case_manager',['ado-ekiti'],
        new Date(Date.now()+100*24*3600_000)),null);
      assert.equal(await propose(target,other,'case_manager',['ado-ekiti']),null);
      assert.equal((await membership(target)).length,0);
    });

    let invitation;
    await t.test('first admin proposes reviewed LGA and second admin alone can activate membership',async()=>{
      invitation=await propose(adminA,target,'case_manager',['ado-ekiti']);
      assert.match(invitation,/^[a-f0-9-]{36}$/);
      assert.equal(await propose(adminA,target,'case_manager',['ado-ekiti']),null,
        'only one pending proposal per target');
      assert.equal((await membership(target)).length,0,'proposal is not approval');
      assert.equal(await approve(adminA,invitation),false);
      assert.equal(await approve(target,invitation),false);
      assert.equal(await approve(adminB,invitation),true);
      assert.equal(await approve(adminB,invitation),false,'cannot replay approval');
      const rows=await membership(target);
      assert.equal(rows.length,1);
      assert.equal(rows[0].role,'case_manager');
      assert.deepEqual(rows[0].allowed_lga_ids,['ado-ekiti']);
      assert.equal(rows[0].active,true);
      assert.equal(rows[0].verified_office_id,null);
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM civic_private.staff_lifecycle_audit
        WHERE target_id=$1 AND action IN ('proposed','approved')`,[target])).rows[0].n,2);
    });

    await t.test('existing membership is not silently broadened or replaced',async()=>{
      assert.equal(await propose(adminA,target,'moderator',['ikere']),null);
      assert.equal(await revoke(target,adminB,'offboarding'),false);
      assert.equal(await revoke(adminA,adminB,'offboarding'),false,
        'no routine can revoke another platform administrator');
      assert.equal(await revoke(adminA,target,'not-an-enum'),false);
    });

    await t.test('revocation takes effect on next independent SQL membership lookup',async()=>{
      assert.equal(await revoke(adminB,target,'offboarding'),true);
      assert.equal((await membership(target)).length,0);
      assert.equal(await revoke(adminB,target,'offboarding'),false);
      const record=(await db.query(`SELECT active,expires_at FROM civic_private.staff_memberships
        WHERE user_id=$1`,[target])).rows[0];
      assert.equal(record.active,false);
      assert.ok(record.expires_at<=new Date());
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM civic_private.staff_lifecycle_audit
        WHERE target_id=$1 AND action='revoked'`,[target])).rows[0].n,1);
    });

    await t.test('incomplete audit rolls back membership grant atomically',async()=>{
      const id=await propose(adminA,other,'moderator',['ikere']);
      assert.ok(id);
      await db.query(`CREATE FUNCTION civic_private.ci_reject_staff_audit()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.action='approved' THEN RAISE EXCEPTION 'CI staff audit rejected'; END IF;
          RETURN NEW; END $$`);
      await db.query(`CREATE TRIGGER ci_reject_staff_audit BEFORE INSERT
        ON civic_private.staff_lifecycle_audit FOR EACH ROW
        EXECUTE FUNCTION civic_private.ci_reject_staff_audit()`);
      await db.query('SAVEPOINT before_approval');
      await assert.rejects(approve(adminB,id),/CI staff audit rejected/);
      await db.query('ROLLBACK TO SAVEPOINT before_approval');
      assert.equal((await membership(other)).length,0);
      const status=(await db.query('SELECT status FROM civic_private.staff_invitation_proposals WHERE id=$1',[id])).rows[0];
      assert.equal(status.status,'pending');
    });
  }finally{
    if(transaction)await db.query('ROLLBACK');
    await db.end();
  }
});
