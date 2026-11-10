\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ;
\set grid3_staging false
\ir validate_grid3.sql
WITH levels(kind,expected) AS (VALUES ('state',1),('lga',16),('ward',177))
SELECT kind,expected,count(DISTINCT a.id) AS verified_names,
       count(DISTINCT b.area_id) AS verified_polygons
FROM levels LEFT JOIN geo.areas a ON a.area_kind=kind AND a.verification_state='verified'
  AND (a.id='ekiti' OR a.parent_id='ekiti' OR a.parent_id IN
      (SELECT id FROM geo.areas WHERE area_kind='lga' AND parent_id='ekiti'))
LEFT JOIN geo.boundaries b ON b.area_id=a.id AND b.verification_state='verified'
GROUP BY kind,expected ORDER BY expected;

SELECT * FROM grid3_topology;
SELECT data_source_id,reason,count(*) FROM geo.import_quarantine GROUP BY data_source_id,reason;
ROLLBACK;
