#!/usr/bin/env node
/**
 * Read-only readiness probe for the Ekiti Civic public search readers.
 * Run with the same restricted Postgres login used by the citizen Worker.
 * Never prints connection strings, credentials, result rows or private data.
 */
import pg from 'pg';

const connectionString=process.env.PUBLIC_READER_DATABASE_URL || process.env.DATABASE_URL;
if(!connectionString){
  console.error('Public-reader check blocked: set PUBLIC_READER_DATABASE_URL to the restricted staging reader connection.');
  process.exitCode=2;
}else{
  const client=new pg.Client({
    connectionString,connectionTimeoutMillis:5000,query_timeout:5000,
    application_name:'ekiti-public-reader-readiness',
  });
  const checks=[
    {name:'civic.public_knowledge(text,integer)',
      sql:'SELECT * FROM civic.public_knowledge($1,$2) LIMIT 1',values:['Ekiti',1]},
    {name:'civic.public_places(text,text,text,integer)',
      sql:'SELECT * FROM civic.public_places($1,$2,$3,$4) LIMIT 1',values:[null,null,null,1]},
    {name:'civic.public_place(uuid)',
      sql:'SELECT * FROM civic.public_place($1) LIMIT 1',values:['00000000-0000-0000-0000-000000000000']},
  ];
  const descriptions={
    '42883':'Function is missing or has the wrong argument signature',
    '42P01':'Required public table is missing',
    '3F000':'Public civic schema is missing',
    '42501':'Restricted reader does not have the required permission',
  };
  let connected=false;
  try{
    await client.connect();
    await client.query('BEGIN READ ONLY');
    connected=true;
    let failed=0;
    for(let i=0;i<checks.length;i++){
      const check=checks[i];
      const savepoint='public_reader_check_'+i;
      await client.query('SAVEPOINT '+savepoint);
      try{
        await client.query(check.sql,check.values);
        console.log('PASS '+check.name);
      }catch(error){
        failed++;
        await client.query('ROLLBACK TO SAVEPOINT '+savepoint);
        const code=typeof error?.code==='string'?error.code:'unknown';
        console.error('FAIL '+check.name+': '+(descriptions[code]||'Query failed')+' (SQLSTATE '+code+')');
      }
    }
    await client.query('ROLLBACK');
    connected=false;
    if(failed){
      console.error(failed+' of '+checks.length+' reviewed readers failed. Inspect db/migrations/0004_knowledge_directory.sql; do not enable private feature gates.');
      process.exitCode=1;
    }else{
      console.log('PASS Public search readers are callable with the restricted login (read-only; no result rows disclosed).');
    }
  }catch(error){
    const code=typeof error?.code==='string'?error.code:'unknown';
    console.error('Public-reader readiness could not connect/check safely (SQLSTATE '+code+').');
    process.exitCode=1;
  }finally{
    if(connected)await client.query('ROLLBACK').catch(()=>{});
    await client.end().catch(()=>{});
  }
}
