-- Sprint 08: review-only, distance-ordered PUBLIC listing query.
-- DO NOT run on a live Supabase database. Not included in migrations/staging.
-- Requires 0001_geography.sql + approved public 0004_knowledge_directory.sql.
-- CI runs this transactionally on a disposable PostGIS instance.
DO $$
BEGIN
  IF current_setting('ekiti.directory_nearby_reviewed',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Nearby public directory SQL awaits independent review';
  END IF;
END $$;

CREATE FUNCTION civic.public_places_nearby(
  _latitude double precision,_longitude double precision,
  _category text DEFAULT NULL,_lga text DEFAULT NULL,_query text DEFAULT NULL,
  _radius_km integer DEFAULT 25,_limit integer DEFAULT 20
) RETURNS TABLE (
  id uuid,name text,category text,lga_id text,
  address_text text,publisher text,source_url text,distance_km double precision
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
  -- A reviewed public place is not geocoded merely because it has coordinates.
  -- Coordinates MUST be independently reviewed and contained in the verified
  -- polygon for the same LGA; otherwise exclude it completely.
  SELECT p.id,p.name,p.category,p.lga_id,
    p.address_text,s.publisher,p.source_url,
    (round((d.meters / 1000)::numeric,1))::double precision AS distance_km
  FROM civic.places p
  JOIN civic.sources s ON s.id=p.source_id
  JOIN geo.areas a ON a.id=p.lga_id
  CROSS JOIN LATERAL (
    SELECT extensions.ST_SetSRID(extensions.ST_MakePoint(p.longitude,p.latitude),4326) AS place_geom
  ) point
  CROSS JOIN LATERAL (
    SELECT extensions.ST_DistanceSphere(
      extensions.ST_SetSRID(extensions.ST_MakePoint(_longitude,_latitude),4326),
      point.place_geom) AS meters
  ) d
  WHERE p.review_state='published'
    AND p.reviewed_at IS NOT NULL
    AND s.review_state='approved'
    AND a.area_kind='lga' AND a.verification_state='verified'
    AND p.coordinates_reviewed_at IS NOT NULL
    AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM geo.boundaries b
      WHERE b.area_id=p.lga_id AND b.verification_state='verified'
        AND extensions.ST_Covers(b.geom,point.place_geom)
    )
    AND _latitude BETWEEN -90 AND 90 AND _longitude BETWEEN -180 AND 180
    AND _radius_km BETWEEN 1 AND 50 AND _limit BETWEEN 1 AND 20
    AND (_category IS NULL OR p.category=_category)
    AND (_lga IS NULL OR p.lga_id=_lga)
    AND (_query IS NULL OR _query='' OR lower(p.name) LIKE '%'||lower(_query)||'%'
         OR lower(p.address_text) LIKE '%'||lower(_query)||'%')
    AND d.meters <= _radius_km*1000
  ORDER BY d.meters,p.name,p.id
  LIMIT least(greatest(coalesce(_limit,20),1),20);
$$;
REVOKE ALL ON FUNCTION civic.public_places_nearby(
  double precision,double precision,text,text,text,integer,integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION civic.public_places_nearby(
  double precision,double precision,text,text,text,integer,integer
) TO ekiti_location_reader;

-- The returned rows contain only public editorial listing attributes,
-- NO device coordinate, exact search origin, private claim, personal data or
-- hidden records. Verified location only permits APPROXIMATE straight-line
-- distance, never driving ETA or independently checked operating hours.
