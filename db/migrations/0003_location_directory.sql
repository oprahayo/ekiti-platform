BEGIN;
-- Expose only public reference labels and their hierarchy to the Worker.
CREATE FUNCTION geo.location_directory()
RETURNS TABLE(id text,name text,kind text,"parentId" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  WITH lgas AS (
    SELECT a.id FROM geo.areas a WHERE a.area_kind='lga'
      AND a.parent_id='ekiti' AND a.verification_state='verified'
  )
  SELECT a.id,a.name,a.area_kind,a.parent_id FROM geo.areas a
  WHERE a.verification_state='verified' AND (
    a.id IN (SELECT id FROM lgas)
    OR (a.area_kind IN ('ward','settlement') AND a.parent_id IN (SELECT id FROM lgas))
  ) ORDER BY a.area_kind,a.name,a.id;
$$;
REVOKE ALL ON FUNCTION geo.location_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION geo.location_directory() TO ekiti_location_reader;
COMMIT;
