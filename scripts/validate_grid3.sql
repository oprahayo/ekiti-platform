-- Run in a transaction. Both import and coverage validate this release manifest.
SET LOCAL search_path=pg_catalog,extensions,pg_temp;
CREATE TEMP VIEW expected_grid3(area_key,record_id,source_key) AS VALUES
  ('ado-ekiti', '28507', 'grid3-lga-2020'),
  ('efon', '28653', 'grid3-lga-2020'),
  ('ekiti', '1153', 'grid3-state-2020'),
  ('ekiti-east', '28602', 'grid3-lga-2020'),
  ('ekiti-south-west', '28529', 'grid3-lga-2020'),
  ('ekiti-west', '28656', 'grid3-lga-2020'),
  ('emure', '28625', 'grid3-lga-2020'),
  ('gbonyin', '28577', 'grid3-lga-2020'),
  ('ido-osi', '28512', 'grid3-lga-2020'),
  ('ijero', '28633', 'grid3-lga-2020'),
  ('ikere', '28626', 'grid3-lga-2020'),
  ('ikole', '28911', 'grid3-lga-2020'),
  ('ilejemeje', '28531', 'grid3-lga-2020'),
  ('irepodun-ifelodun', '28578', 'grid3-lga-2020'),
  ('ise-orun', '28608', 'grid3-lga-2020'),
  ('moba', '28913', 'grid3-lga-2020'),
  ('oye', '28514', 'grid3-lga-2020');

\if :grid3_staging
DO $$ BEGIN
  IF EXISTS (SELECT FROM expected_grid3 e FULL JOIN features f USING(area_key,source_key)
             WHERE f.area_key IS NULL OR e.area_key IS NULL
                OR e.record_id IS DISTINCT FROM f.feature#>>'{properties,uniq_id}') THEN
    RAISE EXCEPTION 'Unexpected GRID3 input IDs or source records';
  END IF;
END $$;
\endif

CREATE TEMP VIEW grid3_snapshot AS
SELECT b.area_id AS area_key,b.data_source_id AS source_key,b.source_record_id,b.geom,
       b.verification_state AS boundary_status,a.verification_state AS name_status,
       a.parent_id,a.area_kind,a.data_source_id AS name_source
FROM geo.boundaries b JOIN geo.areas a ON a.id=b.area_id
WHERE b.data_source_id IN ('grid3-lga-2020','grid3-state-2020');

DO $$ BEGIN
  IF EXISTS (SELECT FROM geo.import_quarantine
             WHERE data_source_id IN ('grid3-lga-2020','grid3-state-2020')) THEN
    RAISE EXCEPTION 'GRID3 snapshot contains quarantined records';
  END IF;
  IF EXISTS (SELECT FROM expected_grid3 e FULL JOIN grid3_snapshot s USING(area_key,source_key)
             WHERE e.area_key IS NULL OR s.area_key IS NULL
               OR s.source_record_id IS DISTINCT FROM e.record_id
               OR s.area_kind <> CASE WHEN e.area_key='ekiti' THEN 'state' ELSE 'lga' END
               OR s.parent_id IS DISTINCT FROM CASE WHEN e.area_key<>'ekiti' THEN 'ekiti' END
               OR s.name_status='disputed' OR s.boundary_status='rejected'
               OR ST_IsEmpty(s.geom) OR NOT ST_IsValid(s.geom)) THEN
    RAISE EXCEPTION 'Missing, rejected or unexpected GRID3 snapshot record';
  END IF;
END $$;

\if :grid3_staging
DO $$ BEGIN
  IF EXISTS (SELECT FROM grid3_snapshot s JOIN features f USING(area_key,source_key)
             WHERE NOT ST_OrderingEquals(s.geom,ST_Multi(ST_GeomFromGeoJSON(f.feature->'geometry')))
               OR NOT (s.name_source=s.source_key AND s.name_status='verified'
                       OR s.name_source='ekiti-lga-name-audit' AND s.name_status='unverified')
               OR s.name_source IS NULL) THEN
    RAISE EXCEPTION 'Staged GRID3 geometry or area provenance differs from reviewed input';
  END IF;
END $$;
\else
DO $$ BEGIN
  IF EXISTS (SELECT FROM grid3_snapshot WHERE boundary_status<>'verified'
             OR name_status<>'verified' OR name_source IS DISTINCT FROM source_key) THEN
    RAISE EXCEPTION 'GRID3 snapshot is not fully verified';
  END IF;
END $$;
\endif

CREATE TEMP VIEW grid3_topology AS
WITH lgas AS (SELECT * FROM grid3_snapshot WHERE area_kind='lga'),
state AS (SELECT geom FROM grid3_snapshot WHERE area_kind='state'),
footprint AS (SELECT ST_Union(geom) AS geom FROM lgas)
SELECT ST_Area(ST_Difference(state.geom,footprint.geom)::geography) AS uncovered_state_m2,
       ST_Area(ST_Difference(footprint.geom,state.geom)::geography) AS beyond_state_m2,
       (SELECT coalesce(sum(ST_Area(ST_CollectionExtract(ST_Intersection(a.geom,b.geom),3)::geography)),0)
        FROM lgas a JOIN lgas b ON a.area_key<b.area_key AND ST_Intersects(a.geom,b.geom)) AS pairwise_overlap_m2
FROM state,footprint;
DO $$
DECLARE metrics record;
BEGIN
  SELECT * INTO STRICT metrics FROM grid3_topology;
  IF (metrics.uncovered_state_m2=0 AND metrics.beyond_state_m2=0
      AND metrics.pairwise_overlap_m2=0) IS NOT TRUE THEN
    RAISE EXCEPTION 'GRID3 topology exceeds zero square metre thresholds: %', row_to_json(metrics);
  END IF;
END $$;
