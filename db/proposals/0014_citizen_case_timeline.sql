-- Sprint 11 — REVIEW-ONLY private citizen case timelines & notification preferences.
-- NOT a deployment migration. Requires previously reviewed private intake and
-- Sprint 09 citizen account links. No message provider or cron is connected.
-- Disposable CI only:
--   BEGIN; SET LOCAL ekiti.case_timeline_reviewed='yes';
--   \i db/proposals/0014_citizen_case_timeline.sql
--   ROLLBACK;
DO $$
BEGIN
  IF current_setting('ekiti.case_timeline_reviewed',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Citizen case timeline requires independent privacy approval';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ekiti_case_timeline_owner') THEN
    CREATE ROLE ekiti_case_timeline_owner NOLOGIN;
  END IF;
END $$;

-- Privileged migration operator retains ownership of release switch.
-- The function owner is granted SELECT only: it CANNOT activate the feature.
CREATE TABLE civic_private.case_timeline_release(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
  enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  review_id text CHECK(review_id IS NULL OR length(review_id) BETWEEN 8 AND 160),
  CHECK(NOT enabled OR (approved_at IS NOT NULL AND review_id IS NOT NULL))
);
INSERT INTO civic_private.case_timeline_release(singleton,enabled) VALUES(true,false);
ALTER TABLE civic_private.case_timeline_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.case_timeline_release FORCE ROW LEVEL SECURITY;
CREATE POLICY citizen_timeline_release_read ON civic_private.case_timeline_release
  FOR SELECT TO ekiti_case_timeline_owner USING(true);
REVOKE ALL ON civic_private.case_timeline_release FROM PUBLIC,anon,authenticated;
GRANT SELECT ON civic_private.case_timeline_release TO ekiti_case_timeline_owner;

-- Preference is only an intent; it DOES NOT queue or deliver notifications.
-- Row is deleted when the explicit citizen-report account link is removed,
-- the account is removed, or the private report is actually deleted.
CREATE TABLE civic_private.citizen_case_notice_preferences(
  report_id uuid PRIMARY KEY REFERENCES civic_private.citizen_case_links(report_id) ON DELETE CASCADE,
  citizen_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'off' CHECK(channel IN('off','email','sms')),
  contact_digest bytea CHECK(contact_digest IS NULL OR octet_length(contact_digest)=32),
  consent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((channel='off' AND contact_digest IS NULL AND consent_at IS NULL)
    OR (channel<>'off' AND contact_digest IS NOT NULL AND consent_at IS NOT NULL))
);
ALTER TABLE civic_private.citizen_case_notice_preferences OWNER TO ekiti_case_timeline_owner;
ALTER TABLE civic_private.citizen_case_notice_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.citizen_case_notice_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY timeline_preferences_owner ON civic_private.citizen_case_notice_preferences
  FOR ALL TO ekiti_case_timeline_owner USING(true) WITH CHECK(true);
REVOKE ALL ON civic_private.citizen_case_notice_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON civic_private.citizen_case_notice_preferences
  TO ekiti_case_timeline_owner;

-- A resident may submit a minimal, opt-in review REQUEST about a linked
-- report. It is not a revision, official complaint to an office, or status
-- update; moderators would need a separate approved process to handle it.
-- No free-form narrative, duplicate target, private phone or media is stored.
CREATE TABLE civic_private.citizen_case_review_requests(
  report_id uuid NOT NULL REFERENCES civic_private.citizen_case_links(report_id) ON DELETE CASCADE,
  citizen_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN('correction','potential_duplicate')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(report_id,citizen_id,kind)
);
ALTER TABLE civic_private.citizen_case_review_requests OWNER TO ekiti_case_timeline_owner;
ALTER TABLE civic_private.citizen_case_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.citizen_case_review_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY timeline_review_request_owner ON civic_private.citizen_case_review_requests
  FOR ALL TO ekiti_case_timeline_owner USING(true) WITH CHECK(true);
REVOKE ALL ON civic_private.citizen_case_review_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON civic_private.citizen_case_review_requests TO ekiti_case_timeline_owner;

GRANT USAGE ON SCHEMA civic_private,auth,extensions TO ekiti_case_timeline_owner;
GRANT SELECT(id,public_reference,kind,received_at,delete_at)
  ON civic_private.reports TO ekiti_case_timeline_owner;
GRANT SELECT(report_id,citizen_id)
  ON civic_private.citizen_case_links TO ekiti_case_timeline_owner;
GRANT SELECT(id,report_id,kind,actor_kind,created_at)
  ON civic_private.case_events TO ekiti_case_timeline_owner;
GRANT SELECT(id,email,phone,email_confirmed_at,phone_confirmed_at)
  ON auth.users TO ekiti_case_timeline_owner;
GRANT SELECT(singleton,enabled,approved_at,review_id)
  ON civic_private.citizen_link_release TO ekiti_case_timeline_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO ekiti_case_timeline_owner;

-- Private tables remain FORCE RLS. The NOLOGIN owner alone can read them
-- through the limited SECURITY DEFINER RPCs; the caller cannot SELECT rows.
CREATE POLICY timeline_report_reader ON civic_private.reports
  FOR SELECT TO ekiti_case_timeline_owner USING(true);
CREATE POLICY timeline_event_reader ON civic_private.case_events
  FOR SELECT TO ekiti_case_timeline_owner USING(true);
CREATE POLICY timeline_link_reader ON civic_private.citizen_case_links
  FOR SELECT TO ekiti_case_timeline_owner USING(true);
CREATE POLICY timeline_previous_release ON civic_private.citizen_link_release
  FOR SELECT TO ekiti_case_timeline_owner USING(true);

GRANT CREATE ON SCHEMA public TO ekiti_case_timeline_owner;

CREATE FUNCTION public.civic_my_case_timeline(_reference uuid)
RETURNS TABLE (
  public_reference uuid,kind text,received_at timestamptz,
  events jsonb,notification_channel text,
  correction_review_requested boolean,duplicate_review_requested boolean,
  government_acknowledged boolean,public_map_status text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT r.public_reference,r.kind,r.received_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'kind',timeline.kind,'at',timeline.created_at,'origin','independent_platform'
      ) ORDER BY timeline.id)
      FROM (
        SELECT e.id,e.kind,e.created_at
        FROM civic_private.case_events e
        WHERE e.report_id=r.id AND
          e.kind IN ('intake_accepted','under_review','needs_information','closed')
        ORDER BY e.id DESC LIMIT 50
      ) timeline
    ),'[]'::jsonb) AS events,
    COALESCE(p.channel,'off')::text AS notification_channel,
    EXISTS(SELECT 1 FROM civic_private.citizen_case_review_requests c
      WHERE c.report_id=r.id AND c.citizen_id=auth.uid()
        AND c.kind='correction') AS correction_review_requested,
    EXISTS(SELECT 1 FROM civic_private.citizen_case_review_requests d
      WHERE d.report_id=r.id AND d.citizen_id=auth.uid()
        AND d.kind='potential_duplicate') AS duplicate_review_requested,
    false AS government_acknowledged,'not_published'::text AS public_map_status
  FROM civic_private.citizen_case_links l
  JOIN civic_private.reports r ON r.id=l.report_id
  LEFT JOIN civic_private.citizen_case_notice_preferences p
    ON p.report_id=r.id AND p.citizen_id=l.citizen_id
  WHERE _reference IS NOT NULL AND r.public_reference=_reference
    AND r.delete_at>now() AND l.citizen_id=auth.uid()
    AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
      AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL))
    AND EXISTS(SELECT 1 FROM civic_private.citizen_link_release s
      WHERE s.singleton=true AND s.enabled AND s.approved_at IS NOT NULL
        AND s.review_id IS NOT NULL)
    AND EXISTS(SELECT 1 FROM civic_private.case_timeline_release t
      WHERE t.singleton=true AND t.enabled AND t.approved_at IS NOT NULL
        AND t.review_id IS NOT NULL)
  LIMIT 1;
$$;
ALTER FUNCTION public.civic_my_case_timeline(uuid) OWNER TO ekiti_case_timeline_owner;

CREATE FUNCTION public.civic_set_case_notice_preference(_reference uuid,_channel text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _citizen uuid;_report uuid;_contact text;
BEGIN
  IF _reference IS NULL OR _channel IS NULL OR
    _channel NOT IN('off','email','sms') THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM civic_private.citizen_link_release s
      WHERE s.singleton=true AND s.enabled AND s.review_id IS NOT NULL
        AND s.approved_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM civic_private.case_timeline_release t
      WHERE t.singleton=true AND t.enabled AND t.review_id IS NOT NULL
        AND t.approved_at IS NOT NULL)
  THEN RETURN false; END IF;
  _citizen:=auth.uid();
  IF _citizen IS NULL OR NOT EXISTS(
    SELECT 1 FROM auth.users u WHERE u.id=_citizen AND
      (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
  ) THEN RETURN false; END IF;
  SELECT r.id INTO _report
    FROM civic_private.reports r
    JOIN civic_private.citizen_case_links l ON l.report_id=r.id
    WHERE r.public_reference=_reference AND r.delete_at>now()
      AND l.citizen_id=_citizen;
  IF _report IS NULL THEN RETURN false; END IF;
  IF _channel='email' THEN
    SELECT lower(btrim(u.email)) INTO _contact FROM auth.users u
      WHERE u.id=_citizen AND u.email_confirmed_at IS NOT NULL
        AND u.email IS NOT NULL;
  ELSIF _channel='sms' THEN
    SELECT btrim(u.phone) INTO _contact FROM auth.users u
      WHERE u.id=_citizen AND u.phone_confirmed_at IS NOT NULL
        AND u.phone IS NOT NULL;
  ELSE
    _contact:=NULL;
  END IF;
  IF _channel<>'off' AND (_contact IS NULL OR _contact='') THEN RETURN false; END IF;
  INSERT INTO civic_private.citizen_case_notice_preferences(
    report_id,citizen_id,channel,contact_digest,consent_at
  ) VALUES(_report,_citizen,_channel,
    CASE WHEN _contact IS NULL THEN NULL ELSE
      extensions.digest(convert_to(_contact,'UTF8'),'sha256') END,
    CASE WHEN _channel='off' THEN NULL ELSE now() END)
  ON CONFLICT(report_id) DO UPDATE SET
    citizen_id=excluded.citizen_id,channel=excluded.channel,
    contact_digest=excluded.contact_digest,consent_at=excluded.consent_at,
    updated_at=now()
  WHERE civic_private.citizen_case_notice_preferences.citizen_id=_citizen;
  RETURN FOUND;
END $$;
ALTER FUNCTION public.civic_set_case_notice_preference(uuid,text)
  OWNER TO ekiti_case_timeline_owner;

CREATE FUNCTION public.civic_request_case_review(_reference uuid,_kind text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _citizen uuid;_report uuid;_inserted integer;
BEGIN
  IF _reference IS NULL OR _kind IS NULL OR
    _kind NOT IN('correction','potential_duplicate') THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM civic_private.citizen_link_release s
    WHERE s.singleton=true AND s.enabled AND s.review_id IS NOT NULL
      AND s.approved_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM civic_private.case_timeline_release t
    WHERE t.singleton=true AND t.enabled AND t.review_id IS NOT NULL
      AND t.approved_at IS NOT NULL)
  THEN RETURN false; END IF;
  _citizen:=auth.uid();
  IF _citizen IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users u
    WHERE u.id=_citizen AND
      (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL))
  THEN RETURN false; END IF;
  SELECT r.id INTO _report FROM civic_private.reports r
    JOIN civic_private.citizen_case_links l ON l.report_id=r.id
    WHERE r.public_reference=_reference AND l.citizen_id=_citizen
      AND r.delete_at>now();
  IF _report IS NULL THEN RETURN false; END IF;
  INSERT INTO civic_private.citizen_case_review_requests(
    report_id,citizen_id,kind
  ) VALUES(_report,_citizen,_kind) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _inserted=ROW_COUNT;
  RETURN _inserted=1;
END $$;
ALTER FUNCTION public.civic_request_case_review(uuid,text)
  OWNER TO ekiti_case_timeline_owner;

REVOKE CREATE ON SCHEMA public FROM ekiti_case_timeline_owner;
REVOKE ALL ON FUNCTION public.civic_my_case_timeline(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_set_case_notice_preference(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_request_case_review(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civic_my_case_timeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_set_case_notice_preference(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_request_case_review(uuid,text) TO authenticated;

-- No notification sender is created, enabled or scheduled here. A preference
-- does not mean an email/SMS was queued, sent, delivered or read. Report and
-- link deletion cascade to preferences and citizen review requests. Private
-- timeline never exposes narrative, origin-specific staff notes, household
-- address, contact, media or a government acknowledgement claim.
