import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

/** Runs ONLY against GitHub Actions' disposable PostGIS database. */
test('reviewed content is searchable, unrevised content stays private and claims are isolated', async () => {
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'),'Refuse to test a non-CI database');
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query(`INSERT INTO civic.sources(id,publisher,name,canonical_url,review_state,reviewed_at)
      VALUES ('test-gov-source','Government publication','CI test source',
      'https://www.ekitistate.gov.ng/','approved',now()),
      ('test-unverified','Unverified source','Unreviewed import',
      'https://example.com/','pending',null)`);
    await db.query(`INSERT INTO civic.knowledge(source_id,source_url,title,summary_en,subject,review_state,reviewed_at)
      VALUES
      ('test-gov-source','https://www.ekitistate.gov.ng/archives/ci-test-1',
       'Bridge improvement announced for Ikere','A government publication announced an Ikere bridge improvement project.',
       'project','approved',now()),
      ('test-gov-source','https://www.ekitistate.gov.ng/archives/ci-test-2',
       'Pending bridge criticism','A citizen suggestion should remain invisible to all public callers.',
       'accountability','pending',null),
      ('test-unverified','https://example.com/bridge-news',
       'Unreviewed source bridge news','A third party claimed a bridge was completed without verification.',
       'project','approved',now())`);
    const created = await db.query(`INSERT INTO civic.places(
      name,category,lga_id,description,address_text,latitude,longitude,source_id,source_url,
      review_state,reviewed_at
    ) VALUES
      ('CI Hotel Example','Hotels','ido-osi','A test hotel record','Ido-Ekiti, Ekiti',7.80,5.00,
        'test-gov-source','https://www.ekitistate.gov.ng/archives/ci-hotel',
        'published',now()),
      ('CI Private Hotel','Hotels','ido-osi','Unreviewed example','Ido-Ekiti',7.80,5.00,
        'test-gov-source','https://www.ekitistate.gov.ng/archives/ci-private',
        'pending',null)
      RETURNING id,review_state`);
    await db.query(`INSERT INTO civic.review_queue(kind,proposed_record,origin_url)
      VALUES ('listing','{"pending":true}'::jsonb,'https://www.ekitistate.gov.ng/')`);
    await db.query('SET LOCAL ROLE ekiti_location_reader');
    const knowledge = await db.query(`SELECT * FROM civic.public_knowledge('bridge',10)`);
    assert.equal(knowledge.rowCount,1);
    assert.match(knowledge.rows[0].title,/Bridge improvement/);
    const hotels = await db.query(`SELECT * FROM civic.public_places('Hotels','ido-osi','CI',20)`);
    assert.equal(hotels.rowCount,1);
    assert.equal(hotels.rows[0].name,'CI Hotel Example');
    assert.equal(hotels.rows[0].latitude,null,'Unreviewed coordinates must be hidden');
    assert.equal(hotels.rows[0].longitude,null);
    assert.equal(hotels.rows[0].owner_claim_state,'unclaimed');

    const inspected = await db.query(`SELECT * FROM civic.public_place($1)`,[created.rows[0].id]);
    assert.equal(inspected.rowCount,1);
    const hidden = await db.query(`SELECT * FROM civic.public_place($1)`,[created.rows[1].id]);
    assert.equal(hidden.rowCount,0);
    const rights = await db.query(`SELECT
      has_table_privilege(current_user,'civic.knowledge','SELECT') AS raw_knowledge,
      has_table_privilege(current_user,'civic.places','SELECT') AS raw_places,
      has_table_privilege(current_user,'civic.review_queue','SELECT') AS reviews,
      has_table_privilege(current_user,'civic.claim_requests','INSERT') AS claims`);
    assert.deepEqual(Object.values(rights.rows[0]),[false,false,false,false]);
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
