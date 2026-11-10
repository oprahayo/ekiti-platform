SET search_path = pg_catalog, extensions;
WITH levels(kind,expected) AS (VALUES ('state',1),('lga',16),('ward',177))
SELECT kind,expected,count(DISTINCT a.id) AS verified_names,
       count(DISTINCT b.area_id) AS verified_polygons
FROM levels LEFT JOIN geo.areas a ON a.area_kind=kind AND a.verification_state='verified'
  AND (a.id='ekiti' OR a.parent_id='ekiti' OR a.parent_id IN
      (SELECT id FROM geo.areas WHERE area_kind='lga' AND parent_id='ekiti'))
LEFT JOIN geo.boundaries b ON b.area_id=a.id AND b.verification_state='verified'
GROUP BY kind,expected ORDER BY expected;

WITH lgas AS (SELECT b.* FROM geo.boundaries b JOIN geo.areas a ON a.id=b.area_id
              WHERE a.parent_id='ekiti' AND a.area_kind='lga' AND a.verification_state='verified'
                AND b.verification_state='verified'),
state AS (SELECT ST_Union(geom) AS geom FROM geo.boundaries WHERE area_id='ekiti' AND verification_state='verified'),
footprint AS (SELECT ST_Union(geom) AS geom FROM lgas)
SELECT ST_Area(ST_Difference(state.geom,footprint.geom)::geography) AS uncovered_state_m2,
       ST_Area(ST_Difference(footprint.geom,state.geom)::geography) AS beyond_state_m2,
       (SELECT coalesce(sum(ST_Area(ST_CollectionExtract(ST_Intersection(a.geom,b.geom),3)::geography)),0)
        FROM lgas a JOIN lgas b ON a.area_id<b.area_id AND ST_Intersects(a.geom,b.geom)) AS pairwise_overlap_m2
FROM state,footprint;
SELECT data_source_id,reason,count(*) FROM geo.import_quarantine GROUP BY data_source_id,reason;
