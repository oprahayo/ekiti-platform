BEGIN;
ALTER TABLE geo.boundaries ADD COLUMN source_record_id text;

-- Migration 0001 installs PostGIS in extensions; on preconfigured databases
-- install it there before applying the migrations.
CREATE FUNCTION geo.stage_boundary(area_key text, source_key text, feature jsonb, srid integer)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, extensions, pg_temp AS $$
DECLARE
  shape geometry;
  failure text;
BEGIN
  BEGIN
    shape := ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(feature->'geometry'), srid), 4326);
    IF shape IS NULL OR ST_IsEmpty(shape) OR GeometryType(shape) NOT IN ('POLYGON','MULTIPOLYGON')
       OR NOT ST_IsValid(shape) OR NOT ST_CoveredBy(shape, ST_MakeEnvelope(-180,-90,180,90,4326)) THEN
      RAISE EXCEPTION 'Missing, invalid, or out-of-range polygon';
    END IF;
    INSERT INTO geo.boundaries(area_id,data_source_id,geom,source_record_id)
    VALUES(area_key,source_key,ST_Multi(shape),feature#>>'{properties,uniq_id}')
    ON CONFLICT(area_id,data_source_id) DO NOTHING;
  EXCEPTION WHEN data_exception OR integrity_constraint_violation OR raise_exception OR internal_error THEN
    GET STACKED DIAGNOSTICS failure = MESSAGE_TEXT;
    INSERT INTO geo.import_quarantine(data_source_id,external_name,source_crs,raw_record,reason)
    VALUES(source_key,area_key,srid::text,feature,failure);
  END;
END;
$$;

-- Only this read operation is granted to the application. Its owner must
-- control geo and extensions, with no CREATE grants there to login roles.
CREATE FUNCTION geo.location_candidates(latitude double precision, longitude double precision)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, extensions, pg_temp AS $$
DECLARE
  point geometry;
  result jsonb;
BEGIN
  IF latitude IS NULL OR longitude IS NULL OR NOT (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Invalid incident coordinates' USING ERRCODE='22023';
  END IF;
  point := ST_SetSRID(ST_MakePoint(longitude,latitude),4326);
  WITH verified AS NOT MATERIALIZED (
    SELECT a.id,a.name,a.parent_id,a.area_kind,b.geom,b.data_source_id,b.source_record_id
    FROM geo.boundaries b JOIN geo.areas a ON a.id=b.area_id
    WHERE a.verification_state='verified' AND b.verification_state='verified'
      AND ((a.area_kind='state' AND a.id='ekiti')
        OR (a.area_kind='lga' AND a.parent_id='ekiti')
        OR (a.area_kind='ward' AND EXISTS (SELECT FROM geo.areas p WHERE p.id=a.parent_id
             AND p.area_kind='lga' AND p.parent_id='ekiti' AND p.verification_state='verified')))
  ), hits AS (
    SELECT *, NOT ST_Contains(geom,point) AS edge FROM verified WHERE ST_Covers(geom,point)
  ), candidates AS (
    SELECT area_kind,id,jsonb_build_object('id',id,'name',name,'parentId',parent_id,
      'sourceId',min(data_source_id),'sourceIds',jsonb_agg(data_source_id ORDER BY data_source_id),
      'sources',jsonb_agg(jsonb_build_object('id',data_source_id,'recordId',source_record_id) ORDER BY data_source_id),
      'onBoundary',bool_or(edge)) AS item
    FROM hits GROUP BY area_kind,id,name,parent_id
  )
  SELECT jsonb_build_object(
    'stateBoundaryStatus',CASE WHEN NOT EXISTS (SELECT FROM verified WHERE area_kind='state') THEN 'unknown'
      WHEN NOT EXISTS (SELECT FROM hits WHERE area_kind='state') THEN 'outside'
      WHEN (SELECT count(*) FROM hits WHERE area_kind='state') <>
           (SELECT count(*) FROM verified WHERE area_kind='state') THEN 'unknown' ELSE 'inside' END,
    'stateOnBoundary',EXISTS(SELECT FROM hits WHERE area_kind='state' AND edge),
    'lgas',coalesce(jsonb_agg(item ORDER BY id) FILTER (WHERE area_kind='lga'),'[]'),
    'wards',coalesce(jsonb_agg(item ORDER BY id) FILTER (WHERE area_kind='ward'),'[]')
  ) INTO result FROM candidates;
  RETURN result;
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA geo FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='ekiti_location_reader') THEN
    CREATE ROLE ekiti_location_reader NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA geo TO ekiti_location_reader;
GRANT EXECUTE ON FUNCTION geo.location_candidates(double precision,double precision) TO ekiti_location_reader;
COMMIT;
