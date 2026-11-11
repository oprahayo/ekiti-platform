import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const owner='12345678-1234-4234-8234-123456789a01';
const other='12345678-1234-4234-8234-123456789a02';

test('directory submission RPC is owner-isolated and cannot publish without staff review',async()=>{
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'),
    'Never run this test against a non-disposable database');
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  try{
    await db.query('BEGIN');
    await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)',
      [owner,'owner@example.test',other,'other@example.test']);
    await db.query('SET LOCAL ROLE authenticated');
    const grants=await db.query(`SELECT
      has_schema_privilege(current_user,'civic','USAGE') AS private_schema,
      has_table_privilege(current_user,'civic.directory_submissions','SELECT') AS raw_read,
      has_table_privilege(current_user,'civic.directory_submissions','INSERT') AS raw_write,
      has_function_privilege(current_user,
        'public.civic_submit_directory_listing(text,text,text,text)','EXECUTE') AS submit`);
    assert.deepEqual(grants.rows[0],{
      private_schema:false,raw_read:false,raw_write:false,submit:true,
    });
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner]);
    const response=await db.query(`SELECT public.civic_submit_directory_listing(
      'CI electrical repairs','Electricians','ado-ekiti',
      'Fictional repair listing for isolated CI verification only.') AS id`);
    const id=response.rows[0].id;
    assert.match(id,/^[a-f0-9-]{36}$/i);
    let mine=await db.query('SELECT * FROM public.civic_my_directory_submissions()');
    assert.equal(mine.rowCount,1);
    assert.equal(mine.rows[0].status,'pending');
    assert.equal(mine.rows[0].name,'CI electrical repairs');
    assert.equal(mine.rows[0].moderation_note,undefined);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[other]);
    mine=await db.query('SELECT * FROM public.civic_my_directory_submissions()');
    assert.equal(mine.rowCount,0);
    const attempted=await db.query('SELECT public.civic_withdraw_directory_submission($1) AS withdrawn',[id]);
    assert.equal(attempted.rows[0].withdrawn,false);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner]);
    const withdrawn=await db.query('SELECT public.civic_withdraw_directory_submission($1) AS withdrawn',[id]);
    assert.equal(withdrawn.rows[0].withdrawn,true);
    const after=await db.query('SELECT status FROM public.civic_my_directory_submissions()');
    assert.equal(after.rows[0].status,'withdrawn');
  }finally{
    await db.query('ROLLBACK');
    await db.end();
  }
});
