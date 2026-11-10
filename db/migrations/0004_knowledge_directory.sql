-- New public knowledge and business-directory foundation.
-- COMMIT ONLY: GitHub CI tests this on a disposable Postgres database.
-- Do not apply to production or staging until the migration is separately approved.
BEGIN;
CREATE SCHEMA IF NOT EXISTS civic;
REVOKE ALL ON SCHEMA civic FROM PUBLIC;

CREATE TABLE civic.sources (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{3,80}$'),
  publisher text NOT NULL CHECK (length(publisher) BETWEEN 2 AND 160),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
  canonical_url text NOT NULL CHECK (canonical_url ~ '^https://[^[:space:]]+$'),
  license_note text NOT NULL DEFAULT 'Usage must be reviewed',
  review_state text NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending','approved','suspended')),
  reviewed_at timestamptz,
  last_checked_at timestamptz,
  CHECK (review_state <> 'approved' OR reviewed_at IS NOT NULL)
);

-- Store only editorial short summaries, not copies of copyrighted pages.
-- One source may offer a government claim while another presents criticism.
CREATE TABLE civic.knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES civic.sources(id),
  source_url text NOT NULL UNIQUE CHECK (source_url ~ '^https://[^[:space:]]+$'),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 240),
  summary_en text NOT NULL CHECK (length(summary_en) BETWEEN 15 AND 1400),
  summary_yo text CHECK (summary_yo IS NULL OR length(summary_yo) BETWEEN 15 AND 1400),
  subject text NOT NULL DEFAULT 'general'
    CHECK (subject IN ('general','history','government','budget','health','education','tourism','project','accountability','news')),
  framing text NOT NULL DEFAULT 'source_claim'
    CHECK (framing IN ('source_claim','independently_verified','allegation','opinion')),
  published_on date,
  reviewed_at timestamptz,
  review_state text NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending','approved','disputed','withdrawn')),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english'::regconfig, coalesce(title,'') || ' ' || coalesce(summary_en,''))
  ) STORED,
  CHECK (review_state <> 'approved' OR reviewed_at IS NOT NULL)
);
CREATE INDEX civic_knowledge_search_idx ON civic.knowledge USING gin(search_vector) WHERE review_state='approved';
CREATE INDEX civic_knowledge_date_idx ON civic.knowledge(published_on DESC) WHERE review_state='approved';

-- Listing publication is distinct from ownership: imported entries may be
-- approved as sourced records without implying the business has claimed them.
CREATE TABLE civic.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 180),
  category text NOT NULL CHECK (category IN ('Health','Schools','Offices','Hotels','Other')),
  lga_id text NOT NULL REFERENCES geo.areas(id),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1200),
  address_text text NOT NULL DEFAULT '' CHECK (length(address_text) <= 280),
  contact_phone text CHECK (contact_phone IS NULL OR length(contact_phone) <= 45),
  website_url text CHECK (website_url IS NULL OR website_url ~ '^https://[^[:space:]]+$'),
  photo_url text CHECK (photo_url IS NULL OR photo_url ~ '^https://[^[:space:]]+$'),
  photo_license text,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  coordinates_reviewed_at timestamptz,
  source_id text NOT NULL REFERENCES civic.sources(id),
  source_url text NOT NULL CHECK (source_url ~ '^https://[^[:space:]]+$'),
  review_state text NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending','published','disputed','withdrawn')),
  reviewed_at timestamptz,
  owner_claim_state text NOT NULL DEFAULT 'unclaimed'
    CHECK (owner_claim_state IN ('unclaimed','claimed','disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (coordinates_reviewed_at IS NULL OR latitude IS NOT NULL),
  CHECK (review_state <> 'published' OR reviewed_at IS NOT NULL)
);
CREATE INDEX civic_places_listing_idx ON civic.places(lga_id,category) WHERE review_state='published';

-- Private moderation queues: intentionally NO public insert/read/claim endpoints.
CREATE TABLE civic.review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('article','listing','correction','claim')),
  proposed_record jsonb NOT NULL,
  origin_url text CHECK (origin_url IS NULL OR origin_url ~ '^https://[^[:space:]]+$'),
  fingerprint text UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected')),
  received_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE TABLE civic.claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES civic.places(id),
  proof_review_notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE civic.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.review_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE civic.claim_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.claim_requests FORCE ROW LEVEL SECURITY;

-- Table-owner SECURITY DEFINER functions bypass RLS, but reader roles do not.
-- The two private queues use FORCE RLS because they have no public gateway.
-- Explicit, bounded, status-filtered read gateway to the existing location role.
CREATE FUNCTION civic.public_knowledge(_query text, _limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,title text,summary_en text,summary_yo text,subject text,framing text,
  published_on date,source_url text,publisher text,reviewed_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT d.id,d.title,d.summary_en,d.summary_yo,d.subject,d.framing,
         d.published_on,d.source_url,s.publisher,d.reviewed_at
  FROM civic.knowledge d
  JOIN civic.sources s ON s.id=d.source_id
  WHERE d.review_state='approved' AND s.review_state='approved'
    AND length(trim(coalesce(_query,''))) BETWEEN 2 AND 160
    AND d.search_vector @@ websearch_to_tsquery('english',_query)
  ORDER BY ts_rank_cd(d.search_vector,websearch_to_tsquery('english',_query)) DESC,
    d.published_on DESC NULLS LAST,d.id
  LIMIT least(greatest(coalesce(_limit,10),1),20);
$$;

CREATE FUNCTION civic.public_places(
  _category text DEFAULT NULL,_lga text DEFAULT NULL,_query text DEFAULT NULL,_limit int DEFAULT 20
) RETURNS TABLE (
  id uuid,name text,category text,lga_id text,description text,address_text text,
  contact_phone text,website_url text,photo_url text,
  latitude double precision,longitude double precision,
  owner_claim_state text,source_url text,publisher text,reviewed_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT p.id,p.name,p.category,p.lga_id,p.description,p.address_text,
         p.contact_phone,p.website_url,
         CASE WHEN p.photo_license IS NOT NULL THEN p.photo_url ELSE NULL END,
         CASE WHEN p.coordinates_reviewed_at IS NOT NULL THEN p.latitude ELSE NULL END,
         CASE WHEN p.coordinates_reviewed_at IS NOT NULL THEN p.longitude ELSE NULL END,
         p.owner_claim_state,p.source_url,s.publisher,p.reviewed_at
  FROM civic.places p
  JOIN civic.sources s ON s.id=p.source_id
  JOIN geo.areas a ON a.id=p.lga_id
  WHERE p.review_state='published' AND s.review_state='approved'
    AND a.area_kind='lga' AND a.verification_state='verified'
    AND (_category IS NULL OR p.category=_category)
    AND (_lga IS NULL OR p.lga_id=_lga)
    AND (_query IS NULL OR length(_query)=0 OR
      lower(p.name) LIKE '%'||lower(_query)||'%' OR
      lower(p.address_text) LIKE '%'||lower(_query)||'%')
  ORDER BY p.name,p.id
  LIMIT least(greatest(coalesce(_limit,20),1),30);
$$;

CREATE FUNCTION civic.public_place(_id uuid)
RETURNS TABLE (
  id uuid,name text,category text,lga_id text,description text,address_text text,
  contact_phone text,website_url text,photo_url text,
  latitude double precision,longitude double precision,
  owner_claim_state text,source_url text,publisher text,reviewed_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT p.id,p.name,p.category,p.lga_id,p.description,p.address_text,
         p.contact_phone,p.website_url,
         CASE WHEN p.photo_license IS NOT NULL THEN p.photo_url ELSE NULL END,
         CASE WHEN p.coordinates_reviewed_at IS NOT NULL THEN p.latitude ELSE NULL END,
         CASE WHEN p.coordinates_reviewed_at IS NOT NULL THEN p.longitude ELSE NULL END,
         p.owner_claim_state,p.source_url,s.publisher,p.reviewed_at
  FROM civic.places p JOIN civic.sources s ON s.id=p.source_id
  JOIN geo.areas a ON a.id=p.lga_id
  WHERE p.id=_id AND p.review_state='published' AND s.review_state='approved'
    AND a.area_kind='lga' AND a.verification_state='verified';
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA civic FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA civic FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA civic FROM PUBLIC;
GRANT USAGE ON SCHEMA civic TO ekiti_location_reader;
GRANT EXECUTE ON FUNCTION civic.public_knowledge(text,integer) TO ekiti_location_reader;
GRANT EXECUTE ON FUNCTION civic.public_places(text,text,text,integer) TO ekiti_location_reader;
GRANT EXECUTE ON FUNCTION civic.public_place(uuid) TO ekiti_location_reader;
-- No reader or public grants on private review / claim queues.
COMMIT;
