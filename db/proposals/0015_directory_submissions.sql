-- Candidate only: self-service directory submissions, no automatic publication.
-- This is NOT a deployed migration. The operator must approve notice, retention,
-- authorized review staff, report/claim handling, and test deletion before release.
-- Run only in an isolated reviewed database with:
-- BEGIN; SET LOCAL ekiti.directory_policy_approved = 'yes';
-- \i db/proposals/0015_directory_submissions.sql
-- COMMIT;
DO $guard$ BEGIN
  IF current_setting('ekiti.directory_policy_approved',true) IS DISTINCT FROM 'yes'
  THEN RAISE EXCEPTION 'Directory collection requires explicit operator and retention approval';
  END IF;
END $guard$;

CREATE TABLE civic.directory_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 110),
  category text NOT NULL CHECK(length(btrim(category)) BETWEEN 3 AND 80),
  lga_id text NOT NULL REFERENCES geo.areas(id),
  description text NOT NULL CHECK(length(btrim(description)) BETWEEN 15 AND 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','under_review','approved','rejected','withdrawn')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  moderation_note text,
  CONSTRAINT approved_has_review CHECK(status<>'approved' OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
CREATE INDEX directory_submission_owner_idx
  ON civic.directory_submissions(author_id,submitted_at DESC);
CREATE UNIQUE INDEX directory_submission_pending_unique
  ON civic.directory_submissions(author_id,lga_id,lower(name))
  WHERE status IN ('pending','under_review');

ALTER TABLE civic.directory_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.directory_submissions FORCE ROW LEVEL SECURITY;
-- No client table access. Strict, audited SECURITY DEFINER RPC only.
REVOKE ALL ON civic.directory_submissions FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA civic FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.civic_submit_directory_listing(
  _name text,_category text,_lga_id text,_description text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,pg_temp AS $$
DECLARE actor uuid := auth.uid(); result_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _name IS NULL OR _category IS NULL OR _description IS NULL OR
     length(btrim(_name)) NOT BETWEEN 3 AND 110 OR
     length(btrim(_category)) NOT BETWEEN 3 AND 80 OR
     length(btrim(_description)) NOT BETWEEN 15 AND 1000 OR
     _lga_id IS NULL OR _lga_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR
     _name ~ '[[:cntrl:]]' OR _category ~ '[[:cntrl:]]' OR
     _description ~ '[[:cntrl:]]' OR
     NOT EXISTS (SELECT FROM geo.areas a WHERE a.id=_lga_id
       AND a.area_kind='lga' AND a.parent_id='ekiti' AND a.verification_state='verified')
     THEN RAISE EXCEPTION 'Invalid listing details or unverified local government';
  END IF;
  -- Per-account cap; NOT a replacement for externally enforced IP/account rate limits.
  IF (SELECT count(*) FROM civic.directory_submissions s
      WHERE s.author_id=actor AND s.submitted_at>now()-interval '24 hours')>=3
     THEN RAISE EXCEPTION 'Submission limit reached; try later';
  END IF;
  INSERT INTO civic.directory_submissions(author_id,name,category,lga_id,description)
  VALUES(actor,btrim(_name),btrim(_category),_lga_id,btrim(_description))
  RETURNING id INTO result_id;
  RETURN result_id; -- Actual durable acknowledgement from the database.
END $$;

CREATE FUNCTION public.civic_my_directory_submissions()
RETURNS TABLE(id uuid,name text,category text,lga_id text,description text,
  status text,submitted_at timestamptz,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT s.id,s.name,s.category,s.lga_id,s.description,s.status,
         s.submitted_at,s.updated_at
  FROM civic.directory_submissions s
  WHERE auth.uid() IS NOT NULL AND s.author_id=auth.uid()
  ORDER BY s.submitted_at DESC,s.id DESC LIMIT 50;
$$;

CREATE FUNCTION public.civic_withdraw_directory_submission(_submission_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  UPDATE civic.directory_submissions s
  SET status='withdrawn',updated_at=now()
  WHERE s.id=_submission_id AND s.author_id=auth.uid()
    AND s.status IN ('pending','under_review');
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.civic_submit_directory_listing(text,text,text,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_my_directory_submissions() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_withdraw_directory_submission(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civic_submit_directory_listing(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_my_directory_submissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_withdraw_directory_submission(uuid) TO authenticated;

-- No approval-to-publication RPC: a separately reviewed private staff
-- transaction must verify the submitted business and publish into reviewed
-- directory records with provenance and a correction/withdrawal audit.
