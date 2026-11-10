import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const placeId = '12345678-1234-4234-a234-123456789abc';
const citizen = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('review and claim RPCs require Auth JWT, moderate publication, and hide account records', async () => {
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'),'Refuse to touch a non-CI database');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)',
      [citizen,'citizen@testing.example',other,'other@testing.example']);
    await client.query(`INSERT INTO civic.sources(
      id,publisher,name,canonical_url,review_state,reviewed_at)
      VALUES ('auth-test-source','CI publisher','CI test organization',
        'https://www.ekitistate.gov.ng/','approved',now())`);
    await client.query(`INSERT INTO civic.places(
      id,name,category,lga_id,description,address_text,source_id,source_url,
      review_state,reviewed_at,owner_claim_state)
      VALUES ($1,'CI reviewed guesthouse','Hotels','ado-ekiti','CI only place',
        'CI test address','auth-test-source','https://www.ekitistate.gov.ng/archives/test',
        'published',now(),'unclaimed')`,[placeId]);

    await client.query('SET LOCAL ROLE authenticated');
    const denied = await client.query(`SELECT
      has_table_privilege(current_user,'civic.reviews','SELECT') AS read_reviews,
      has_table_privilege(current_user,'civic.reviews','INSERT') AS insert_reviews,
      has_table_privilege(current_user,'civic.claim_intents','SELECT') AS read_claims,
      has_function_privilege(current_user,'public.civic_submit_review(uuid,integer,text)','EXECUTE') AS submit,
      has_function_privilege(current_user,'public.civic_request_claim(uuid,text)','EXECUTE') AS claim`);
    assert.deepEqual(Object.values(denied.rows[0]),[false,false,false,true,true]);

    await assert.rejects(client.query(`SELECT public.civic_submit_review($1,5,$2)`,
      [placeId,'A real detailed experience longer than fifteen chars.']),/Sign in required/);
    // A PostgreSQL error aborts its transaction; savepoints are required.
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});

test('moderation review and claim contract never publishes pending user content', async () => {
  assert.ok(process.env.DATABASE_URL?.includes('ekiti_test'));
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)',
      [citizen,'citizen2@testing.example',other,'other2@testing.example']);
    await db.query(`INSERT INTO civic.sources(
      id,publisher,name,canonical_url,review_state,reviewed_at)
      VALUES ('auth-test-source2','CI publisher','CI test source',
        'https://www.ekitistate.gov.ng/','approved',now())`);
    await db.query(`INSERT INTO civic.places(
      id,name,category,lga_id,source_id,source_url,review_state,reviewed_at)
      VALUES ($1,'CI reviewed hotel','Hotels','ado-ekiti','auth-test-source2',
        'https://www.ekitistate.gov.ng/archives/1234','published',now())`,[placeId]);
    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[citizen]);
    const added = await db.query(
      'SELECT public.civic_submit_review($1,$2,$3) AS id',
      [placeId,4,'The staff were helpful and the rooms were clean on my visit.']);
    assert.match(added.rows[0].id,/^[0-9a-f-]{36}$/);
    const claim = await db.query(
      'SELECT public.civic_request_claim($1,$2) AS id',
      [placeId,'I operate this business and would like to initiate an ownership review.']);
    assert.match(claim.rows[0].id,/^[0-9a-f-]{36}$/);
    const mine = await db.query('SELECT * FROM public.civic_my_reviews()');
    assert.equal(mine.rowCount,1);
    assert.equal(mine.rows[0].status,'pending');
    const myClaims = await db.query('SELECT * FROM public.civic_my_claims()');
    assert.equal(myClaims.rowCount,1);
    assert.equal(myClaims.rows[0].status,'pending');

    await db.query('SET LOCAL ROLE ekiti_location_reader');
    const raw = await db.query(`SELECT
      has_table_privilege(current_user,'civic.reviews','SELECT') AS can_read,
      has_table_privilege(current_user,'civic.claim_intents','SELECT') AS can_claim`);
    assert.equal(raw.rows[0].can_read,false);
    assert.equal(raw.rows[0].can_claim,false);
    const unapproved = await db.query('SELECT * FROM civic.public_reviews($1,10)',[placeId]);
    assert.equal(unapproved.rowCount,0);
    const summary = await db.query('SELECT * FROM civic.public_rating_summary($1)',[placeId]);
    assert.equal(Number(summary.rows[0].rating_count),0);
    assert.equal(summary.rows[0].average_rating,null);

    await db.query('RESET ROLE');
    await db.query(`UPDATE civic.reviews SET status='published',published_at=now()
      WHERE place_id=$1`,[placeId]);
    await db.query('SET LOCAL ROLE ekiti_location_reader');
    const published = await db.query('SELECT * FROM civic.public_reviews($1,10)',[placeId]);
    assert.equal(published.rowCount,1);
    assert.equal(published.rows[0].stars,4);
    assert.equal(Object.hasOwn(published.rows[0],'author_id'),false);
    const rating = await db.query('SELECT * FROM civic.public_rating_summary($1)',[placeId]);
    assert.equal(Number(rating.rows[0].rating_count),1);
    assert.equal(Number(rating.rows[0].average_rating),4);
    await db.query('RESET ROLE');

    // Withdrawing a review must remove it from the public feed immediately.
    await db.query(`UPDATE civic.reviews SET status='withdrawn',published_at=NULL WHERE place_id=$1`,[placeId]);
    await db.query('SET LOCAL ROLE ekiti_location_reader');
    const hidden = await db.query('SELECT * FROM civic.public_reviews($1,10)',[placeId]);
    assert.equal(hidden.rowCount,0);
    await db.query('RESET ROLE');

    // Another JWT cannot view a different citizen's private account activity.
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[other]);
    await db.query('SET LOCAL ROLE authenticated');
    const otherReviews = await db.query('SELECT * FROM public.civic_my_reviews()');
    const otherClaims = await db.query('SELECT * FROM public.civic_my_claims()');
    assert.equal(otherReviews.rowCount,0);
    assert.equal(otherClaims.rowCount,0);
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
