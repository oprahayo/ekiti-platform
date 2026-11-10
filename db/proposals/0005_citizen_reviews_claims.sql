-- PROPOSAL ONLY. Do not apply to staging or production without approval.
-- Requires existing civic schema and Supabase Auth (auth.uid() + authenticated role).
-- Explicit transaction-only gate:
--   BEGIN;
--   SET LOCAL ekiti.citizen_policy_approved = 'yes';
--   \i db/proposals/0005_citizen_reviews_claims.sql
--   COMMIT;
-- Only apply after terms/privacy, moderation owner, notification, retention and
-- email OTP settings are reviewed. This schema collects no ID documents/photos.
DO $$
BEGIN
  IF current_setting('ekiti.citizen_policy_approved', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Citizen reviews and claims require explicit policy approval';
  END IF;
END $$;

CREATE TABLE civic.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES civic.places(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 15 AND 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  moderation_notes text,
  CONSTRAINT civic_one_review_per_person_place UNIQUE (place_id, author_id),
  CONSTRAINT civic_review_publication_time CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX civic_reviews_published_idx
  ON civic.reviews (place_id, published_at DESC, id)
  WHERE status='published';
CREATE INDEX civic_reviews_owner_idx ON civic.reviews(author_id, updated_at DESC);

CREATE TABLE civic.claim_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES civic.places(id) ON DELETE CASCADE,
  claimant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statement text NOT NULL CHECK (length(btrim(statement)) BETWEEN 30 AND 700),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected','withdrawn')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  moderator_notes text,
  CONSTRAINT civic_one_claim_per_person_place UNIQUE (place_id,claimant_id),
  CONSTRAINT civic_claim_verified_has_review CHECK (status <> 'verified' OR reviewed_at IS NOT NULL)
);
CREATE INDEX civic_claims_owner_idx ON civic.claim_intents(claimant_id,requested_at DESC);

ALTER TABLE civic.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.claim_intents ENABLE ROW LEVEL SECURITY;
-- Table owner security-definer functions must bypass RLS while public/authenticated
-- callers have no direct table privileges or policies. Do not add FORCE here.

REVOKE ALL ON civic.reviews,civic.claim_intents FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA civic FROM PUBLIC,anon,authenticated;

-- Public: only moderator-published reviews for an approved source/place.
-- No author identity, email, moderation notes or pending reviews exposed.
CREATE FUNCTION civic.public_reviews(
  _place uuid, _limit integer DEFAULT 10
) RETURNS TABLE(
  id uuid, stars smallint, body text, published_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT r.id,r.stars,r.body,r.published_at
  FROM civic.reviews r
  JOIN civic.places p ON p.id=r.place_id
  JOIN civic.sources s ON s.id=p.source_id
  WHERE r.place_id=_place AND r.status='published'
    AND p.review_state='published' AND s.review_state='approved'
  ORDER BY r.published_at DESC,r.id DESC
  LIMIT least(greatest(coalesce(_limit,10),1),20);
$$;

CREATE FUNCTION civic.public_rating_summary(_place uuid)
RETURNS TABLE(rating_count bigint, average_rating numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT count(r.id),round(avg(r.stars::numeric),1)
  FROM civic.places p
  JOIN civic.sources s ON s.id=p.source_id
  LEFT JOIN civic.reviews r ON r.place_id=p.id AND r.status='published'
  WHERE p.id=_place AND p.review_state='published' AND s.review_state='approved'
  GROUP BY p.id;
$$;

-- Authenticated client RPCs, never exposed to anonymous/public clients.
-- auth.uid() comes from a verified Supabase JWT, NOT a client-provided user ID.
CREATE FUNCTION public.civic_submit_review(
  _place_id uuid, _stars integer, _body text
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  cleaned text := btrim(coalesce(_body,''));
  answer uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _stars IS NULL OR _stars NOT BETWEEN 1 AND 5
    OR length(cleaned) NOT BETWEEN 15 AND 1000
  THEN RAISE EXCEPTION 'Invalid review'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM civic.places p
    JOIN civic.sources s ON s.id=p.source_id
    WHERE p.id=_place_id AND p.review_state='published' AND s.review_state='approved'
  ) THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
  IF EXISTS (
    SELECT 1 FROM civic.claim_intents c
    WHERE c.place_id=_place_id AND c.claimant_id=actor AND c.status='verified'
  ) THEN RAISE EXCEPTION 'Owners cannot rate their own listing'; END IF;
  INSERT INTO civic.reviews(place_id,author_id,stars,body,status)
    VALUES (_place_id,actor,_stars,cleaned,'pending')
    ON CONFLICT (place_id,author_id)
    DO UPDATE SET stars=EXCLUDED.stars,body=EXCLUDED.body,
      status='pending',published_at=NULL,moderation_notes=NULL,updated_at=now()
  RETURNING id INTO answer;
  RETURN answer;
END;
$$;

CREATE FUNCTION public.civic_request_claim(
  _place_id uuid, _statement text
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  cleaned text := btrim(coalesce(_statement,''));
  answer uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF length(cleaned) NOT BETWEEN 30 AND 700 THEN
    RAISE EXCEPTION 'Claim explanation must be 30–700 characters';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM civic.places p JOIN civic.sources s ON s.id=p.source_id
    WHERE p.id=_place_id AND p.review_state='published'
      AND s.review_state='approved' AND p.owner_claim_state='unclaimed'
  ) THEN RAISE EXCEPTION 'Listing unavailable for claim'; END IF;
  INSERT INTO civic.claim_intents(place_id,claimant_id,statement,status)
    VALUES (_place_id,actor,cleaned,'pending')
    ON CONFLICT (place_id,claimant_id)
    DO UPDATE SET statement=EXCLUDED.statement,status='pending',
      reviewed_at=NULL,moderator_notes=NULL,requested_at=now()
    WHERE civic.claim_intents.status IN ('pending','rejected','withdrawn')
  RETURNING id INTO answer;
  IF answer IS NULL THEN RAISE EXCEPTION 'Claim already verified'; END IF;
  RETURN answer;
END;
$$;

-- Private account activity: only a verified JWT's own contributions.
CREATE FUNCTION public.civic_my_reviews()
RETURNS TABLE(place_id uuid,stars smallint,body text,status text,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT r.place_id,r.stars,r.body,r.status,r.updated_at
  FROM civic.reviews r
  WHERE auth.uid() IS NOT NULL AND r.author_id=auth.uid()
  ORDER BY r.updated_at DESC LIMIT 60;
$$;
CREATE FUNCTION public.civic_my_claims()
RETURNS TABLE(place_id uuid,status text,requested_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT c.place_id,c.status,c.requested_at
  FROM civic.claim_intents c
  WHERE auth.uid() IS NOT NULL AND c.claimant_id=auth.uid()
  ORDER BY c.requested_at DESC LIMIT 60;
$$;

REVOKE ALL ON FUNCTION civic.public_reviews(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic.public_rating_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION civic.public_reviews(uuid,integer) TO ekiti_location_reader;
GRANT EXECUTE ON FUNCTION civic.public_rating_summary(uuid) TO ekiti_location_reader;
REVOKE ALL ON FUNCTION public.civic_submit_review(uuid,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_request_claim(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_my_reviews() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_my_claims() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civic_submit_review(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_request_claim(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_my_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_my_claims() TO authenticated;
