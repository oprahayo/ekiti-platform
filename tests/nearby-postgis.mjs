import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

test('Sprint 08 reviewed PostGIS nearby function is guarded, least privileged and globally distance ordered',async(t)=>{
  if(!process.env.DATABASE_URL)throw Error('Disposable CI DATABASE_URL required');
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  let transaction=false;
  try{
    const sql=await readFile(new URL('../db/proposals/0011_public_nearby.sql',import.meta.url),'utf8');
    await db.query('BEGIN');transaction=true;
    await assert.rejects(db.query(sql),/Nearby public directory SQL awaits independent review/);
    await db.query('ROLLBACK');transaction=false;
    await db.query('BEGIN');transaction=true;
    await db.query("SET LOCAL ekiti.directory_nearby_reviewed='yes'");
    await db.query(sql);

    await t.test('function has bounded execute grant but source and place tables remain private',async()=>{
      const r=await db.query(`SELECT
        has_function_privilege('ekiti_location_reader',
          'civic.public_places_nearby(double precision,double precision,text,text,text,integer,integer)',
          'EXECUTE') AS can_search,
        has_table_privilege('ekiti_location_reader','civic.places','SELECT') AS raw_places,
        has_table_privilege('ekiti_location_reader','civic.sources','SELECT') AS raw_sources`);
      assert.deepEqual(r.rows[0],{can_search:true,raw_places:false,raw_sources:false});
    });

    const centers=await db.query(`
      WITH points AS (
        SELECT b.area_id, extensions.ST_PointOnSurface(b.geom) AS p
        FROM geo.boundaries b JOIN geo.areas a ON a.id=b.area_id
        WHERE a.area_kind='lga' AND a.verification_state='verified'
          AND b.verification_state='verified'
      )
      SELECT area_id,extensions.ST_Y(p) AS lat,extensions.ST_X(p) AS lon,
        extensions.ST_DistanceSphere(
          p,(SELECT p FROM points WHERE area_id='ado-ekiti' LIMIT 1)) AS meters
      FROM points ORDER BY meters ASC`);
    const near=centers.rows.find(row=>row.area_id==='ado-ekiti');
    const far=centers.rows.find(row=>row.area_id!=='ado-ekiti'&&Number(row.meters)<50_000);
    assert.ok(near&&far,'verified nearby LGA centers available in disposable CI geography');
    assert.ok(Number(far.meters)>Number(near.meters));

    await db.query(`INSERT INTO civic.sources
      (id,name,publisher,canonical_url,review_state,reviewed_at)
      VALUES('ci-s08-reviewed','Sprint08 approved reference','CI publisher',
        'https://example.org/s08-reviewed','approved',now()),
        ('ci-s08-pending','Sprint08 unapproved source','Pending publisher',
         'https://example.org/s08-pending','pending',null)`);
    const seed=async(name,area,coords,overrides={})=>{
      await db.query(`INSERT INTO civic.places
        (name,category,lga_id,description,address_text,latitude,longitude,
         coordinates_reviewed_at,source_id,source_url,review_state,reviewed_at)
        VALUES($1,$2,$3,'CI-only reviewed search fixture','CI test area',
          $4,$5,$6,$7,'https://example.org/source',$8,$9)`,[
          name,overrides.category??'Hotels',area,Number(coords.lat),Number(coords.lon),
          overrides.geocoded===false?null:new Date().toISOString(),
          overrides.source??'ci-s08-reviewed',overrides.review??'published',
          overrides.review==='pending'?null:new Date().toISOString(),
        ]);
    };
    await seed('Z Sprint08 close reviewed',near.area_id,near);
    await seed('A Sprint08 distant reviewed',far.area_id,far);
    await seed('C Sprint08 unpublished',near.area_id,near,{review:'pending'});
    await seed('D Sprint08 no coordinate review',near.area_id,near,{geocoded:false});
    await seed('E Sprint08 unapproved source',near.area_id,near,{source:'ci-s08-pending'});
    await seed('F Sprint08 wrong LGA polygon',far.area_id,near);

    await t.test('only approved source, published place and reviewed coordinates inside matching LGA qualify',async()=>{
      await db.query('SET LOCAL ROLE ekiti_location_reader');
      const found=await db.query(`SELECT name,distance_km FROM civic.public_places_nearby(
        $1::double precision,$2::double precision,NULL,NULL,NULL,50,20)`,
        [Number(near.lat),Number(near.lon)]);
      await db.query('RESET ROLE');
      assert.deepEqual(found.rows.map(row=>row.name),
        ['Z Sprint08 close reviewed','A Sprint08 distant reviewed'],
        'distance sorting must beat alphabetical ordering');
      assert.equal(Number(found.rows[0].distance_km),0);
      assert.ok(Number(found.rows[1].distance_km)>0);
    });
    await t.test('category, LGA, query and radius filters operate before limiting results',async()=>{
      const filtered=await db.query(`SELECT name FROM civic.public_places_nearby(
        $1::double precision,$2::double precision,'Hotels','ado-ekiti','close',50,20)`,
        [Number(near.lat),Number(near.lon)]);
      assert.deepEqual(filtered.rows.map(row=>row.name),['Z Sprint08 close reviewed']);
      const absent=await db.query(`SELECT name FROM civic.public_places_nearby(
        $1::double precision,$2::double precision,'Schools',NULL,NULL,50,20)`,
        [Number(near.lat),Number(near.lon)]);
      assert.equal(absent.rowCount,0);
    });
  }finally{
    if(transaction)await db.query('ROLLBACK');
    await db.end();
  }
});
