-- Sprint 10 — REVIEW-ONLY, DEFAULT-OFF private case email/SMS links.
-- Requires reviewed Sprint 05/09 private intake, Supabase Auth and links.
-- NEVER include in ordinary migrations or execute against a live project.
-- Local disposable CI setup:
--   BEGIN; SET LOCAL ekiti.case_delivery_reviewed='yes';
--   \i db/proposals/0013_private_case_delivery.sql
--   ROLLBACK;
DO $$
BEGIN
  IF current_setting('ekiti.case_delivery_reviewed',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Case-link delivery requires independent operator and privacy approval';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ekiti_case_link_owner') THEN
    CREATE ROLE ekiti_case_link_owner NOLOGIN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ekiti_case_delivery_api') THEN
    CREATE ROLE ekiti_case_delivery_api NOLOGIN;
  END IF;
END $$;

-- A privileged operator must independently approve delivery and retention.
-- Merely installing SQL or setting browser flags NEVER enables this.
CREATE TABLE civic_private.case_link_release(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
  enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  review_id text,
  CHECK(enabled=false OR (approved_at IS NOT NULL
    AND review_id IS NOT NULL AND length(review_id) BETWEEN 8 AND 160))
);
INSERT INTO civic_private.case_link_release(singleton,enabled) VALUES(true,false);
-- Keep this release-control table owned by the privileged migration role.
-- The function owner gets SELECT only, never implicit owner UPDATE rights.
ALTER TABLE civic_private.case_link_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.case_link_release FORCE ROW LEVEL SECURITY;
REVOKE ALL ON civic_private.case_link_release FROM PUBLIC,anon,authenticated;
CREATE POLICY case_link_release_owner_read ON civic_private.case_link_release
  FOR SELECT TO ekiti_case_link_owner USING(true);
GRANT SELECT ON civic_private.case_link_release TO ekiti_case_link_owner;

-- No plaintext phone/email or ticket is stored. The fingerprint prevents a
-- queued request from silently delivering to a later changed account contact.
CREATE TABLE civic_private.case_link_outbox(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES civic_private.reports(id) ON DELETE CASCADE,
  citizen_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK(channel IN('email','sms')),
  contact_digest bytea NOT NULL CHECK(octet_length(contact_digest)=32),
  status text NOT NULL DEFAULT 'queued'
    CHECK(status IN('queued','leased','provider_accepted','failed','redeemed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  token_digest bytea CHECK(token_digest IS NULL OR octet_length(token_digest)=32),
  token_expires_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id,citizen_id,channel),
  CHECK((token_digest IS NULL AND token_expires_at IS NULL)
    OR (token_digest IS NOT NULL AND token_expires_at IS NOT NULL))
);
ALTER TABLE civic_private.case_link_outbox OWNER TO ekiti_case_link_owner;
ALTER TABLE civic_private.case_link_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.case_link_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY case_link_outbox_owner ON civic_private.case_link_outbox
  FOR ALL TO ekiti_case_link_owner USING(true) WITH CHECK(true);
CREATE INDEX case_link_outbox_due ON civic_private.case_link_outbox(next_attempt_at)
  WHERE status IN('queued','leased');
CREATE UNIQUE INDEX case_link_outbox_digest ON civic_private.case_link_outbox(token_digest)
  WHERE token_digest IS NOT NULL;
REVOKE ALL ON civic_private.case_link_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON civic_private.case_link_outbox TO ekiti_case_link_owner;

GRANT USAGE ON SCHEMA civic_private,auth,extensions TO ekiti_case_link_owner;
GRANT SELECT(id,public_reference,tracking_secret_digest,delete_at)
  ON civic_private.reports TO ekiti_case_link_owner;
GRANT SELECT(id,email,phone,email_confirmed_at,phone_confirmed_at)
  ON auth.users TO ekiti_case_link_owner;
GRANT SELECT,INSERT ON civic_private.citizen_case_links TO ekiti_case_link_owner;
GRANT SELECT ON civic_private.citizen_link_release TO ekiti_case_link_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO ekiti_case_link_owner;
CREATE POLICY case_delivery_report_read ON civic_private.reports
  FOR SELECT TO ekiti_case_link_owner USING(true);
CREATE POLICY case_delivery_citizen_link ON civic_private.citizen_case_links
  FOR ALL TO ekiti_case_link_owner USING(true) WITH CHECK(true);
CREATE POLICY case_delivery_prior_release ON civic_private.citizen_link_release
  FOR SELECT TO ekiti_case_link_owner USING(true);

-- Functions are owned by a NOLOGIN role, with no PUBLIC executable default.
GRANT CREATE ON SCHEMA public,civic_private TO ekiti_case_link_owner;

CREATE FUNCTION public.civic_request_case_link(
  _reference uuid,_receipt_secret text,_channel text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _citizen uuid;_report uuid;_contact text;_queued uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM civic_private.case_link_release
      WHERE singleton=true AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM civic_private.citizen_link_release
      WHERE singleton=true AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
  THEN RETURN false; END IF;
  _citizen:=auth.uid();
  IF _citizen IS NULL OR _reference IS NULL OR _receipt_secret IS NULL
    OR _receipt_secret !~ '^[0-9a-f]{64}$'
    OR _channel NOT IN ('email','sms') THEN RETURN false; END IF;
  SELECT CASE WHEN _channel='email'
    AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
       THEN lower(btrim(u.email))
    WHEN _channel='sms'
    AND u.phone_confirmed_at IS NOT NULL AND u.phone IS NOT NULL
       THEN btrim(u.phone) ELSE NULL END
    INTO _contact FROM auth.users u WHERE u.id=_citizen;
  IF _contact IS NULL OR _contact='' THEN RETURN false; END IF;
  SELECT r.id INTO _report FROM civic_private.reports r
    WHERE r.public_reference=_reference AND r.delete_at>now()
      AND r.tracking_secret_digest=
        extensions.digest(convert_to(_receipt_secret,'UTF8'),'sha256');
  IF _report IS NULL OR EXISTS(
      SELECT 1 FROM civic_private.citizen_case_links l
        WHERE l.report_id=_report AND l.citizen_id<>_citizen)
  THEN RETURN false; END IF;
  -- One queue slot per user/report/channel, with a 15-minute cooldown.
  -- No unsent raw token and no recipient PII is persisted.
  INSERT INTO civic_private.case_link_outbox(
    report_id,citizen_id,channel,contact_digest
  ) VALUES(
    _report,_citizen,_channel,
    extensions.digest(convert_to(_contact,'UTF8'),'sha256')
  ) ON CONFLICT(report_id,citizen_id,channel) DO UPDATE
      SET contact_digest=excluded.contact_digest,status='queued',
          token_digest=NULL,token_expires_at=NULL,lease_until=NULL,
          attempts=0,requested_at=now(),updated_at=now(),
          next_attempt_at=now()
      WHERE civic_private.case_link_outbox.requested_at<=now()-interval '15 minutes'
  RETURNING id INTO _queued;
  RETURN _queued IS NOT NULL;
END $$;
ALTER FUNCTION public.civic_request_case_link(uuid,text,text)
  OWNER TO ekiti_case_link_owner;

-- Only a separately provisioned delivery worker can reserve one queue row.
-- The worker generates a fresh 256-bit raw token in volatile memory and
-- passes only its digest to this function. Each retry invalidates old tokens.
CREATE FUNCTION civic_private.case_link_delivery_lease(_digest bytea)
RETURNS TABLE(delivery_id uuid, channel text,destination text,attempt integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _id uuid;_channel text;_dest text;_attempt integer;
BEGIN
  IF octet_length(_digest)<>32 OR NOT EXISTS(
    SELECT 1 FROM civic_private.case_link_release
    WHERE singleton=true AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL
  ) OR NOT EXISTS(
    SELECT 1 FROM civic_private.citizen_link_release
    WHERE singleton=true AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL
  ) THEN RETURN; END IF;
  SELECT q.id,q.channel,
    CASE WHEN q.channel='email' THEN lower(btrim(u.email))
      ELSE btrim(u.phone) END,
    q.attempts+1
  INTO _id,_channel,_dest,_attempt
  FROM civic_private.case_link_outbox q
  JOIN civic_private.reports r ON r.id=q.report_id
  JOIN auth.users u ON u.id=q.citizen_id
  WHERE (q.status='queued' OR (q.status='leased' AND q.lease_until<now()))
    AND q.next_attempt_at<=now() AND q.attempts<3 AND r.delete_at>now()
    AND ((q.channel='email' AND u.email_confirmed_at IS NOT NULL AND
      u.email IS NOT NULL AND q.contact_digest=
        extensions.digest(convert_to(lower(btrim(u.email)),'UTF8'),'sha256'))
      OR (q.channel='sms' AND u.phone_confirmed_at IS NOT NULL AND
      u.phone IS NOT NULL AND q.contact_digest=
        extensions.digest(convert_to(btrim(u.phone),'UTF8'),'sha256')))
  ORDER BY q.next_attempt_at,q.requested_at,q.id
  LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
  IF _id IS NULL THEN RETURN; END IF;
  UPDATE civic_private.case_link_outbox q
    SET status='leased',attempts=_attempt,token_digest=_digest,
      token_expires_at=now()+interval '10 minutes',
      lease_until=now()+interval '45 seconds',updated_at=now()
    WHERE q.id=_id;
  RETURN QUERY SELECT _id,_channel,_dest,_attempt;
END $$;
ALTER FUNCTION civic_private.case_link_delivery_lease(bytea)
  OWNER TO ekiti_case_link_owner;

-- "provider_accepted" means an external provider accepted a send request,
-- not that the recipient received the message.
CREATE FUNCTION civic_private.case_link_delivery_settle(
  _delivery uuid,_attempt integer,_accepted boolean
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _affected integer;
BEGIN
  IF _delivery IS NULL OR _attempt NOT BETWEEN 1 AND 3
    OR _accepted IS NULL THEN RETURN false; END IF;
  UPDATE civic_private.case_link_outbox q SET
    status=CASE WHEN _accepted THEN 'provider_accepted'
      WHEN q.attempts<3 THEN 'queued' ELSE 'failed' END,
    token_digest=CASE WHEN _accepted THEN q.token_digest ELSE NULL END,
    token_expires_at=CASE WHEN _accepted THEN q.token_expires_at ELSE NULL END,
    lease_until=NULL,
    next_attempt_at=CASE WHEN _accepted THEN q.next_attempt_at
      ELSE now()+(CASE q.attempts WHEN 1 THEN interval '1 minute'
        WHEN 2 THEN interval '5 minutes' ELSE interval '30 minutes' END) END,
    updated_at=now()
  WHERE q.id=_delivery AND q.status='leased'
    AND q.attempts=_attempt AND q.lease_until>=now();
  GET DIAGNOSTICS _affected=ROW_COUNT;
  RETURN _affected=1;
END $$;
ALTER FUNCTION civic_private.case_link_delivery_settle(uuid,integer,boolean)
  OWNER TO ekiti_case_link_owner;

-- One-time redemption needs BOTH this opaque token AND the ORIGINAL
-- authenticated, confirmed account that requested delivery. No anonymous
-- bearer link can grant a private report, even if forwarded to someone else.
CREATE FUNCTION public.civic_redeem_case_link(_token text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _citizen uuid;_report uuid;_owner uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM civic_private.case_link_release
    WHERE singleton=true AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM civic_private.citizen_link_release
    WHERE singleton=true AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
  THEN RETURN false; END IF;
  _citizen:=auth.uid();
  IF _citizen IS NULL OR _token IS NULL OR _token !~ '^[0-9a-f]{64}$'
    OR NOT EXISTS(
      SELECT 1 FROM auth.users u WHERE u.id=_citizen AND
        (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
    ) THEN RETURN false; END IF;
  -- Atomic update locks the token row. A second request cannot replay it.
  UPDATE civic_private.case_link_outbox q SET
    status='redeemed',token_digest=NULL,token_expires_at=NULL,updated_at=now()
  FROM civic_private.reports r
  WHERE q.report_id=r.id AND r.delete_at>now()
    AND q.citizen_id=_citizen AND q.status='provider_accepted'
    AND q.token_expires_at>now()
    AND q.token_digest=extensions.digest(convert_to(_token,'UTF8'),'sha256')
    AND NOT EXISTS(SELECT 1 FROM civic_private.citizen_case_links l
      WHERE l.report_id=q.report_id AND l.citizen_id<>_citizen)
  RETURNING q.report_id INTO _report;
  IF _report IS NULL THEN RETURN false; END IF;
  INSERT INTO civic_private.citizen_case_links(report_id,citizen_id)
    VALUES(_report,_citizen) ON CONFLICT(report_id) DO NOTHING;
  SELECT l.citizen_id INTO _owner FROM civic_private.citizen_case_links l
    WHERE l.report_id=_report;
  RETURN _owner=_citizen;
END $$;
ALTER FUNCTION public.civic_redeem_case_link(text)
  OWNER TO ekiti_case_link_owner;

-- Administrative purge only. Must be explicitly scheduled after retention
-- review; no frontend or ordinary authenticated user can call this.
CREATE FUNCTION civic_private.case_link_delivery_purge()
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _count integer;
BEGIN
  DELETE FROM civic_private.case_link_outbox q
    WHERE (q.status IN('redeemed','failed') OR
      (q.status='provider_accepted' AND q.token_expires_at<now()))
      AND q.updated_at<now()-interval '30 days';
  GET DIAGNOSTICS _count=ROW_COUNT;
  RETURN _count;
END $$;
ALTER FUNCTION civic_private.case_link_delivery_purge()
  OWNER TO ekiti_case_link_owner;

REVOKE CREATE ON SCHEMA public,civic_private FROM ekiti_case_link_owner;
REVOKE ALL ON FUNCTION public.civic_request_case_link(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.civic_redeem_case_link(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION civic_private.case_link_delivery_lease(bytea) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION civic_private.case_link_delivery_settle(uuid,integer,boolean)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION civic_private.case_link_delivery_purge()
  FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.civic_request_case_link(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.civic_redeem_case_link(text) TO authenticated;
GRANT USAGE ON SCHEMA civic_private TO ekiti_case_delivery_api;
GRANT EXECUTE ON FUNCTION civic_private.case_link_delivery_lease(bytea) TO ekiti_case_delivery_api;
GRANT EXECUTE ON FUNCTION civic_private.case_link_delivery_settle(uuid,integer,boolean)
  TO ekiti_case_delivery_api;
-- Do not grant purge to the sender. Review with an isolated maintenance role.
-- No direct table grants, no public phone/email/token columns and no
-- automatic message delivery or authority to impersonate an office.
