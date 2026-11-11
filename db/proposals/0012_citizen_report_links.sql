-- Sprint 09: review-only citizen receipt-to-account linking.
-- NOT a live migration. Requires reviewed private-reporting proposals and
-- Supabase Auth. Run only in disposable CI until operator/legal approval.
-- Explicit transaction opt-in:
--   BEGIN; SET LOCAL ekiti.citizen_case_link_reviewed='yes';
--   \i db/proposals/0012_citizen_report_links.sql
--   COMMIT;
-- Never connect an account to a report by email, contact, IP or device ID.
DO $$
BEGIN
  IF current_setting('ekiti.citizen_case_link_reviewed',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Citizen report linking awaits independent privacy approval';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ekiti_citizen_link_owner') THEN
    CREATE ROLE ekiti_citizen_link_owner NOLOGIN;
  END IF;
END $$;

-- A separate server-side release switch, not controlled by any authenticated
-- browser request. Deploying SQL alone MUST NOT make linking operational.
CREATE TABLE civic_private.citizen_link_release(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
  enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  review_id text CHECK(review_id IS NULL OR length(review_id) BETWEEN 8 AND 160),
  CHECK(enabled=false OR (approved_at IS NOT NULL AND review_id IS NOT NULL))
);
INSERT INTO civic_private.citizen_link_release(singleton,enabled)
  VALUES(true,false);
ALTER TABLE civic_private.citizen_link_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.citizen_link_release FORCE ROW LEVEL SECURITY;
REVOKE ALL ON civic_private.citizen_link_release FROM PUBLIC,anon,authenticated;
CREATE POLICY citizen_link_release_read ON civic_private.citizen_link_release
  FOR SELECT TO ekiti_citizen_link_owner USING(true);
GRANT SELECT ON civic_private.citizen_link_release TO ekiti_citizen_link_owner;

CREATE TABLE civic_private.citizen_case_links(
  report_id uuid PRIMARY KEY REFERENCES civic_private.reports(id) ON DELETE CASCADE,
  citizen_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX citizen_case_links_owner ON civic_private.citizen_case_links(citizen_id,linked_at DESC);
ALTER TABLE civic_private.citizen_case_links OWNER TO ekiti_citizen_link_owner;
ALTER TABLE civic_private.citizen_case_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.citizen_case_links FORCE ROW LEVEL SECURITY;
CREATE POLICY citizen_link_owner_policy ON civic_private.citizen_case_links
  FOR ALL TO ekiti_citizen_link_owner USING(true) WITH CHECK(true);
REVOKE ALL ON civic_private.citizen_case_links FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON civic_private.citizen_case_links TO ekiti_citizen_link_owner;

-- The NOLOGIN function owner has narrowly scoped access to reports/events.
-- These policies never grant row access to the client or public reader.
GRANT USAGE ON SCHEMA civic_private,auth,extensions TO ekiti_citizen_link_owner;
GRANT SELECT (id,public_reference,tracking_secret_digest,kind,received_at,delete_at)
  ON civic_private.reports TO ekiti_citizen_link_owner;
GRANT SELECT (id,report_id,kind,created_at)
  ON civic_private.case_events TO ekiti_citizen_link_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO ekiti_citizen_link_owner;
-- Authentication is not enough: a Supabase anonymous/unconfirmed account
-- must never gain private case history solely from having an auth.uid().
-- Only these confirmation columns are exposed to the NOLOGIN function owner.
GRANT SELECT (id,email_confirmed_at,phone_confirmed_at)
  ON auth.users TO ekiti_citizen_link_owner;
CREATE POLICY citizen_link_report_select ON civic_private.reports
  FOR SELECT TO ekiti_citizen_link_owner USING(true);
CREATE POLICY citizen_link_event_select ON civic_private.case_events
  FOR SELECT TO ekiti_citizen_link_owner USING(true);

-- A temporary CREATE privilege lets the NOLOGIN owner hold narrowly scoped
-- public RPC functions; immediately revoke it afterwards.
GRANT CREATE ON SCHEMA public TO ekiti_citizen_link_owner;

CREATE FUNCTION public.civic_link_private_report(_reference uuid,_secret text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _citizen uuid;_report uuid;_owner uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM civic_private.citizen_link_release
    WHERE singleton=true AND enabled=true AND approved_at IS NOT NULL
      AND review_id IS NOT NULL) THEN RETURN false; END IF;
  _citizen:=auth.uid();
  IF _citizen IS NULL OR NOT EXISTS(
    SELECT 1 FROM auth.users u WHERE u.id=_citizen AND
      (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
  ) THEN RETURN false; END IF;
  IF _reference IS NULL OR _secret IS NULL
    OR _secret !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
  -- Never persist a receipt secret, only its verified digest already held
  -- by the existing private report gateway.
  SELECT r.id INTO _report FROM civic_private.reports r
    WHERE r.public_reference=_reference
      AND r.tracking_secret_digest=extensions.digest(convert_to(_secret,'UTF8'),'sha256')
      AND r.delete_at>now();
  IF _report IS NULL THEN RETURN false; END IF;
  INSERT INTO civic_private.citizen_case_links(report_id,citizen_id)
    VALUES(_report,_citizen) ON CONFLICT(report_id) DO NOTHING;
  SELECT l.citizen_id INTO _owner FROM civic_private.citizen_case_links l
    WHERE l.report_id=_report;
  -- Existing links are never silently transferred to a different account.
  RETURN _owner=_citizen;
END $$;
ALTER FUNCTION public.civic_link_private_report(uuid,text) OWNER TO ekiti_citizen_link_owner;

CREATE FUNCTION public.civic_my_private_reports()
RETURNS TABLE(public_reference uuid,kind text,received_at timestamptz,
  last_platform_event text, government_acknowledged boolean,public_map_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT r.public_reference,r.kind,r.received_at,
    coalesce(e.kind,'intake_accepted')::text AS last_platform_event,
    false AS government_acknowledged,'not_published'::text AS public_map_status
  FROM civic_private.citizen_case_links l
  JOIN civic_private.reports r ON r.id=l.report_id
  LEFT JOIN LATERAL(
    SELECT ce.kind FROM civic_private.case_events ce
    WHERE ce.report_id=r.id AND ce.kind IN (
      'intake_accepted','under_review','needs_information','closed')
    ORDER BY ce.id DESC LIMIT 1
  ) e ON true
  WHERE EXISTS(SELECT 1 FROM civic_private.citizen_link_release
    WHERE singleton=true AND enabled=true AND approved_at IS NOT NULL
      AND review_id IS NOT NULL)
    AND auth.uid() IS NOT NULL AND l.citizen_id=auth.uid()
    AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
      AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL))
    AND r.delete_at>now()
  ORDER BY r.received_at DESC,r.public_reference
  LIMIT 30;
$$;
ALTER FUNCTION public.civic_my_private_reports() OWNER TO ekiti_citizen_link_owner;

CREATE FUNCTION public.civic_unlink_private_report(_reference uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _count integer;
BEGIN
  IF auth.uid() IS NULL OR _reference IS NULL THEN RETURN false; END IF;
  DELETE FROM civic_private.citizen_case_links l
    USING civic_private.reports r
    WHERE l.report_id=r.id AND l.citizen_id=auth.uid()
      AND r.public_reference=_reference;
  GET DIAGNOSTICS _count=ROW_COUNT;
  RETURN _count=1;
END $$;
ALTER FUNCTION public.civic_unlink_private_report(uuid) OWNER TO ekiti_citizen_link_owner;

REVOKE CREATE ON SCHEMA public FROM ekiti_citizen_link_owner;
REVOKE ALL ON FUNCTION public.civic_link_private_report(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_my_private_reports() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_unlink_private_report(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civic_link_private_report(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_my_private_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_unlink_private_report(uuid) TO authenticated;

-- An approved operator must independently update civic_private.citizen_link_release
-- after testing the real environment. No app role or function owner can UPDATE
-- that switch; a Vite feature flag is NOT the security boundary.

-- Linked reports are only a private account index. No narrative, exact GPS,
-- media, contact, case notes, public map publishing, delivery or government
-- acknowledgement is exposed. Link rows cascade away on report retention
-- deletion or Supabase account deletion. This is not a deletion job.
