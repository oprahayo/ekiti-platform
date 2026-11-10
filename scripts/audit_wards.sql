CREATE TEMP TABLE wards AS SELECT id,parent,name,st_geomfromgeojson(geometry_json) geom FROM raw;
SELECT parent,count(*) operational_features,
       (SELECT count(*) FROM geo.areas a WHERE a.area_kind='ward' AND a.parent_id=w.parent
        AND verification_state='verified') electoral_names,
       count(*) FILTER (WHERE NOT st_isvalid(geom) OR st_isempty(geom)) invalid
FROM wards w GROUP BY parent ORDER BY parent;
-- Exclude invalid polygons from topology metrics; never repair the source.
CREATE TEMP TABLE valid AS SELECT * FROM wards WHERE st_isvalid(geom) AND NOT st_isempty(geom);
CREATE INDEX ON valid USING gist(geom);
WITH state AS (SELECT geom FROM geo.boundaries WHERE area_id='ekiti' AND data_source_id='grid3-state-2020'),
footprint AS (SELECT st_union(geom) geom FROM valid)
SELECT round(st_area(st_difference(state.geom,footprint.geom)::geography)::numeric) AS gap_m2,
       round(st_area(st_difference(footprint.geom,state.geom)::geography)::numeric) AS outside_m2,
       (SELECT count(*) FROM valid a JOIN valid b ON a.id<b.id AND st_relate(a.geom,b.geom,'2********')) AS overlapping_pairs,
       (SELECT count(*) FROM valid w LEFT JOIN geo.boundaries b ON b.area_id=w.parent AND b.data_source_id='grid3-lga-2020'
        WHERE b.id IS NULL OR NOT st_coveredby(w.geom,b.geom)) AS outside_named_parent
FROM state,footprint;
ROLLBACK;
