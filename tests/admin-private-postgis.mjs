import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

test('disposable proposed admin tables deny public reader and citizen database roles', async () => {
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'),
    'Refusing to inspect anything but disposable CI ekiti_test');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='civic_private'
        AND c.relname IN ('reports','case_events','staff_memberships','admin_access_audit','admin_note_requests')
      ORDER BY c.relname`);
    assert.deepEqual(result.rows.map(row => row.relname), [
      'admin_access_audit','admin_note_requests','case_events','reports','staff_memberships',
    ]);
    for(const row of result.rows) {
      assert.equal(row.relrowsecurity,true,row.relname+' must use RLS');
      assert.equal(row.relforcerowsecurity,true,row.relname+' must force RLS');
    }
    const isolation=await client.query(`SELECT
      has_schema_privilege('ekiti_location_reader','civic_private','USAGE') AS loc_schema,
      has_table_privilege('ekiti_location_reader','civic_private.reports','SELECT') AS loc_report,
      has_table_privilege('ekiti_location_reader','civic_private.staff_memberships','SELECT') AS loc_staff,
      has_table_privilege('ekiti_location_reader','civic_private.admin_access_audit','INSERT') AS loc_audit,
      has_table_privilege('authenticated','civic_private.admin_note_requests','INSERT') AS auth_write,
      has_table_privilege('anon','civic_private.case_events','SELECT') AS anon_events`);
    assert.deepEqual(Object.values(isolation.rows[0]),[false,false,false,false,false,false]);
  } finally { await client.end(); }
});

test('proposal defaults reject active self-approved staff and use UUID-backed events', async () => {
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'));
  const client=new pg.Client({connectionString:process.env.DATABASE_URL});
  await client.connect();
  try {
    await client.query('BEGIN');
    const subject='12345678-1234-4123-8123-123456789012';
    await client.query(`INSERT INTO civic_private.staff_memberships(user_id,role)
      VALUES ($1,'case_manager')`,[subject]);
    const disabled=await client.query(
      'SELECT active,allowed_lga_ids FROM civic_private.staff_memberships WHERE user_id=$1',[subject]);
    assert.equal(disabled.rows[0].active,false);
    assert.deepEqual(disabled.rows[0].allowed_lga_ids,[]);
    await client.query('SAVEPOINT prevent_self_approval');
    await assert.rejects(client.query(`UPDATE civic_private.staff_memberships
      SET active=true,approved_by=$1,approved_at=now() WHERE user_id=$1`,[subject]));
    await client.query('ROLLBACK TO SAVEPOINT prevent_self_approval');
    await client.query('SAVEPOINT prevent_unverified_office');
    await assert.rejects(client.query(`INSERT INTO civic_private.staff_memberships(
      user_id,role,active,approved_by,approved_at)
      VALUES ('22345678-1234-4234-8234-123456789012','government_officer',true,
       '32345678-1234-4234-8234-123456789012',now())`));
    await client.query('ROLLBACK TO SAVEPOINT prevent_unverified_office');
    const cols=await client.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema='civic_private' AND table_name='case_events'
        AND column_name='event_uuid'`);
    assert.equal(cols.rowCount,1);
  } finally {
    await client.query('ROLLBACK'); await client.end();
  }
});
