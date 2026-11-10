-- Ekiti civic platform: geographic reference foundation.
-- Must run on PostgreSQL with PostGIS available. No real geometry is seeded here.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS geo;

CREATE TABLE IF NOT EXISTS geo.data_sources (
  id text PRIMARY KEY,
  title text NOT NULL,
  publisher text NOT NULL,
  source_url text,
  license text,
  source_date date,
  imported_at timestamptz NOT NULL DEFAULT now(),
  verification_notes text
);

CREATE TABLE IF NOT EXISTS geo.areas (
  id text PRIMARY KEY,
  area_kind text NOT NULL CHECK (area_kind IN ('state','lga','ward','lcda','settlement','constituency')),
  name text NOT NULL,
  parent_id text REFERENCES geo.areas(id),
  data_source_id text REFERENCES geo.data_sources(id),
  verification_state text NOT NULL DEFAULT 'unverified' CHECK (verification_state IN ('unverified','verified','disputed')),
  UNIQUE (area_kind,parent_id,name)
);
CREATE INDEX IF NOT EXISTS area_parent_idx ON geo.areas(parent_id);

CREATE TABLE IF NOT EXISTS geo.boundaries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  area_id text NOT NULL REFERENCES geo.areas(id),
  data_source_id text NOT NULL REFERENCES geo.data_sources(id),
  geom extensions.geometry(MultiPolygon,4326) NOT NULL,
  verification_state text NOT NULL DEFAULT 'unverified' CHECK (verification_state IN ('unverified','verified','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boundaries_valid CHECK (extensions.ST_IsValid(geom)),
  CONSTRAINT boundaries_srid CHECK (extensions.ST_SRID(geom)=4326),
  UNIQUE(area_id,data_source_id)
);
CREATE INDEX IF NOT EXISTS boundaries_verified_gist_idx ON geo.boundaries USING gist(geom) WHERE verification_state='verified';

-- Keep invalid/unreconciled source geometry outside the approved spatial table.
CREATE TABLE IF NOT EXISTS geo.import_quarantine (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data_source_id text REFERENCES geo.data_sources(id),
  external_name text,
  source_crs text,
  raw_record jsonb NOT NULL,
  reason text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Candidates only; authoritative resolution must also check state coverage,
-- boundaries, conflicts, source dates and precision. Empty results are not
-- evidence the point is outside Ekiti when no polygons have been imported.
CREATE OR REPLACE FUNCTION geo.verified_area_candidates(_latitude double precision, _longitude double precision)
RETURNS TABLE(id text, name text, area_kind text, parent_id text, data_source_id text)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT a.id,a.name,a.area_kind,a.parent_id,b.data_source_id
  FROM geo.boundaries b JOIN geo.areas a ON a.id=b.area_id
  WHERE b.verification_state='verified'
    AND a.verification_state='verified'
    AND _latitude BETWEEN -90 AND 90 AND _longitude BETWEEN -180 AND 180
    AND extensions.ST_Covers(b.geom, extensions.ST_SetSRID(extensions.ST_MakePoint(_longitude,_latitude),4326))
  ORDER BY a.area_kind,a.name;
$$;

-- Default deny for visitors / API roles; server access requires explicit privileges.
REVOKE ALL ON SCHEMA geo FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA geo FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA geo FROM PUBLIC;
COMMIT;
