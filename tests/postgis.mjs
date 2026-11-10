import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { resolveIncidentLocation } from '../src/server/location.ts';

test('PostGIS import and incident resolver', async (t) => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = await pool.connect();
  const resolve = (lat, lon) => resolveIncidentLocation(db, lat, lon);
  async function locationAt(sql) {
    const {rows: [p]} = await db.query('SELECT st_y(p) lat,st_x(p) lon FROM (' + sql + ') points');
    return resolve(p.lat, p.lon);
  }
  try {
    await db.query('BEGIN');
    await db.query('SET LOCAL search_path=pg_catalog,extensions');
    await t.test('all 16 verified LGA interiors independently match their own ID', async () => {
      const data = await db.query(`SELECT area_id,st_x(p) lon,st_y(p) lat FROM
        (SELECT area_id,st_pointonsurface(geom) p FROM geo.boundaries
         WHERE data_source_id='grid3-lga-2020' AND verification_state='verified') q`);
      assert.equal(data.rowCount,16);
      for (const p of data.rows) {
        const result = await resolve(p.lat,p.lon);
        assert.equal(result.stateBoundaryStatus,'inside');
        assert.equal(result.lga.match.id,p.area_id);
        assert.deepEqual(result.lga.match.sourceIds,['grid3-lga-2020']);
        assert.equal(result.ward.status,'unmapped');
        assert.equal(result.requiresConfirmation,true);
      }
    });
    await t.test('shared edge returns both candidates', async () => {
      const result = await locationAt(`SELECT st_pointonsurface(st_intersection(a.geom,b.geom)) p
        FROM geo.boundaries a JOIN geo.boundaries b ON a.area_id<b.area_id
        WHERE a.data_source_id=b.data_source_id AND st_touches(a.geom,b.geom) LIMIT 1`);
      assert.equal(result.lga.status,'ambiguous');
      assert.ok(result.lga.candidates.every(c => c.onBoundary));
    });
    await t.test('outside and absent state evidence', async () => {
      assert.equal((await resolve(0,0)).lga.status,'outside_scope');
      await db.query("UPDATE geo.boundaries SET verification_state='unverified' WHERE area_id='ekiti'");
      assert.equal((await resolve(0,0)).lga.status,'unmapped');
      await db.query("UPDATE geo.boundaries SET verification_state='verified' WHERE area_id='ekiti'");
    });
    await t.test('transaction-only operational ward exercises interior, edge and parent conflict', async () => {
      const f = JSON.parse(await readFile(new URL('./data/operational-ward.json',import.meta.url)));
      await db.query("INSERT INTO geo.data_sources(id,title,publisher) VALUES ('test-v4','Operational Wards v4.0','CIESIN')");
      await db.query(`INSERT INTO geo.areas(id,area_kind,parent_id,name,verification_state)
        VALUES ('test-3054','ward','efon',$1,'verified')`,[f.properties.ward]);
      await db.query("SELECT geo.stage_boundary('test-3054','test-v4',$1,4326)",[f]);
      const inside = "SELECT st_pointonsurface(geom) p FROM geo.boundaries WHERE area_id='test-3054'";
      assert.equal((await locationAt(inside)).ward.status,'unmapped');
      await db.query("UPDATE geo.boundaries SET verification_state='verified' WHERE area_id='test-3054'");
      const hit = await locationAt(inside);
      assert.equal(hit.consistency,'consistent');
      assert.equal(hit.requiresConfirmation,false);
      const edge = await locationAt("SELECT st_startpoint(st_exteriorring(st_geometryn(geom,1))) p FROM geo.boundaries WHERE area_id='test-3054'");
      assert.equal(edge.ward.match.onBoundary,true);
      assert.equal(edge.requiresConfirmation,true);
      await db.query("UPDATE geo.areas SET parent_id='oye' WHERE id='test-3054'");
      assert.equal((await locationAt(inside)).consistency,'conflict');
    });
    await t.test('two overlapping operational polygons return both IDs', async () => {
      const pair = JSON.parse(await readFile(new URL('./data/operational-overlap.json',import.meta.url)));
      for (const f of pair) {
        const id = 'test-' + f.properties.OBJECTID;
        await db.query(`INSERT INTO geo.areas(id,area_kind,parent_id,name,verification_state)
          VALUES ($1,'ward','ikere',$2,'verified')`,[id,'GRID3 ' + f.properties.ward]);
        await db.query("SELECT geo.stage_boundary($1,'test-v4',$2,4326)",[id,f]);
        await db.query("UPDATE geo.boundaries SET verification_state='verified' WHERE area_id=$1",[id]);
      }
      const result = await locationAt(`SELECT st_pointonsurface(st_intersection(a.geom,b.geom)) p
        FROM geo.boundaries a,geo.boundaries b WHERE a.area_id='test-3138' AND b.area_id='test-3141'`);
      assert.equal(result.ward.status,'ambiguous');
      assert.deepEqual(result.ward.candidates.map(c => c.id),['test-3138','test-3141']);
      assert.equal(result.requiresConfirmation,true);
    });
    await t.test('rejects non-polygons and transforms projected input', async () => {
      await db.query(`SELECT geo.stage_boundary('efon','test-v4','{"geometry":{"type":"Point","coordinates":[0,0]}}',4326)`);
      assert.equal((await db.query("SELECT 1 FROM geo.import_quarantine WHERE data_source_id='test-v4'")).rowCount,1);
      await db.query(`SELECT geo.stage_boundary('efon','test-v4',jsonb_build_object('geometry',
        st_asgeojson(st_transform(geom,3857))::jsonb),3857) FROM geo.boundaries WHERE area_id='efon'`);
      assert.equal((await db.query("SELECT 1 FROM geo.boundaries WHERE area_id='efon' AND data_source_id='test-v4' AND st_srid(geom)=4326")).rowCount,1);
    });
    await t.test('reader can resolve but cannot read tables, import, or submit invalid coordinates', async () => {
      await db.query('SET LOCAL ROLE ekiti_location_reader');
      assert.equal((await resolve(0,0)).ward.status,'outside_scope');
      const {rows:[priv]} = await db.query(`SELECT has_table_privilege(current_user,'geo.boundaries','SELECT') tables,
        has_function_privilege(current_user,'geo.stage_boundary(text,text,jsonb,integer)','EXECUTE') imports`);
      assert.deepEqual(priv,{tables:false,imports:false});
      await assert.rejects(db.query('SELECT geo.location_candidates(91,0)'),{code:'22023'});
    });
  } finally {
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
  }
});
