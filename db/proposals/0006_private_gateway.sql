-- REVIEW PROPOSAL ONLY -- DO NOT APPLY TO ANY LIVE SUPABASE PROJECT.
--
-- Requires db/proposals/0004_reporting_private.sql (also unapproved).
-- Explicit one-time manual approval is required even on a throwaway database:
--   BEGIN;
--   SET LOCAL ekiti.report_policy_approved = 'yes';
--   SET LOCAL ekiti.private_gateway_reviewed = 'yes';
--   \i db/proposals/0006_private_gateway.sql
--   COMMIT;
--
-- The application is deliberately NOT connected here: both roles below are
-- NOLOGIN. A separate access review must provision an independent Hyperdrive
-- login and grant it membership in ekiti_report_api (never location reader).
-- This file is NOT included in normal migrations or staging:prepare.

DO $$
BEGIN
  IF current_setting('ekiti.report_policy_approved', true) IS DISTINCT FROM 'yes'
     OR current_setting('ekiti.private_gateway_reviewed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Private case gateway is not approved; see docs/private-intake-milestone.md';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ekiti_private_gateway') THEN
    CREATE ROLE ekiti_private_gateway NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ekiti_report_api') THEN
    CREATE ROLE ekiti_report_api NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ekiti_report_maintenance') THEN
    CREATE ROLE ekiti_report_maintenance NOLOGIN;
  END IF;
END $$;

-- SECURITY DEFINER owner has access under explicit role-scoped RLS policies.
-- Application role has no table privileges, only the named function calls.
GRANT USAGE, CREATE ON SCHEMA civic_private TO ekiti_private_gateway;
GRANT USAGE ON SCHEMA geo TO ekiti_private_gateway;
GRANT SELECT (id, area_kind, parent_id, verification_state)
  ON geo.areas TO ekiti_private_gateway;
GRANT SELECT, INSERT, DELETE ON civic_private.reports TO ekiti_private_gateway;
GRANT SELECT, INSERT ON civic_private.case_events TO ekiti_private_gateway;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA civic_private TO ekiti_private_gateway;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='civic_private'
                 AND tablename='reports' AND policyname='private_gateway_select') THEN
    CREATE POLICY private_gateway_select ON civic_private.reports
      FOR SELECT TO ekiti_private_gateway USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='civic_private'
                 AND tablename='reports' AND policyname='private_gateway_insert') THEN
    CREATE POLICY private_gateway_insert ON civic_private.reports
      FOR INSERT TO ekiti_private_gateway WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='civic_private'
                 AND tablename='reports' AND policyname='private_gateway_delete') THEN
    CREATE POLICY private_gateway_delete ON civic_private.reports
      FOR DELETE TO ekiti_private_gateway USING (delete_at <= now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='civic_private'
                 AND tablename='case_events' AND policyname='private_gateway_select') THEN
    CREATE POLICY private_gateway_select ON civic_private.case_events
      FOR SELECT TO ekiti_private_gateway USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='civic_private'
                 AND tablename='case_events' AND policyname='private_gateway_insert') THEN
    CREATE POLICY private_gateway_insert ON civic_private.case_events
      FOR INSERT TO ekiti_private_gateway WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION civic_private.accept_private_report(
  _request_id uuid, _fingerprint bytea, _digest bytea,
  _kind text, _description text, _lga text, _ward text,
  _place text, _policy_version text, _retention_days integer
)
RETURNS TABLE (public_reference uuid, received_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF _request_id IS NULL OR octet_length(_fingerprint) <> 32
     OR octet_length(_digest) <> 32
     OR _kind NOT IN ('Issue','Complaint','Commendation')
     OR _description IS NULL OR length(_description) NOT BETWEEN 20 AND 4000
     OR _place IS NULL OR length(_place) > 160
     OR nullif(_policy_version,'') IS NULL OR length(_policy_version) > 80
     OR _retention_days NOT BETWEEN 1 AND 365
     OR NOT EXISTS (
       SELECT 1 FROM geo.areas WHERE id = _lga
         AND area_kind='lga' AND verification_state='verified'
     )
     OR (_ward IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM geo.areas WHERE id = _ward AND area_kind='ward'
         AND parent_id = _lga AND verification_state='verified'
     ))
  THEN
    RAISE EXCEPTION 'invalid_private_intake' USING ERRCODE = '22023';
  END IF;

  -- Both INSERTs are committed atomically by the surrounding transaction.
  -- A public reference cannot be issued until case + first event both exist.
  RETURN QUERY
  WITH inserted AS (
    INSERT INTO civic_private.reports(
      request_id, request_fingerprint, tracking_secret_digest,
      kind, description, lga_id, ward_id, place, consent_policy_version, delete_at
    ) VALUES (
      _request_id, _fingerprint, _digest, _kind, _description,
      _lga, _ward, _place, _policy_version,
      now() + (_retention_days * interval '1 day')
    ) RETURNING id, civic_private.reports.public_reference, civic_private.reports.received_at
  ),
  event_record AS (
    INSERT INTO civic_private.case_events(report_id,kind,actor_kind)
      SELECT id, 'intake_accepted', 'system' FROM inserted RETURNING id
  )
  SELECT r.public_reference, r.received_at
  FROM inserted r CROSS JOIN event_record;
END $$;

ALTER FUNCTION civic_private.accept_private_report(
  uuid,bytea,bytea,text,text,text,text,text,text,integer
) OWNER TO ekiti_private_gateway;

CREATE OR REPLACE FUNCTION civic_private.track_private_report(_reference uuid, _digest bytea)
RETURNS TABLE (kind text, at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT e.kind, e.created_at AS at
    FROM civic_private.reports r
    JOIN civic_private.case_events e ON e.report_id = r.id
   WHERE r.public_reference = _reference
     AND r.tracking_secret_digest = _digest
     AND r.delete_at > now()
     AND e.kind IN ('intake_accepted','under_review','needs_information','closed')
   ORDER BY e.id ASC LIMIT 60;
$$;
ALTER FUNCTION civic_private.track_private_report(uuid,bytea)
  OWNER TO ekiti_private_gateway;

CREATE OR REPLACE FUNCTION civic_private.purge_expired_private_reports()
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _deleted integer;
BEGIN
  DELETE FROM civic_private.reports WHERE delete_at <= now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END $$;
ALTER FUNCTION civic_private.purge_expired_private_reports()
  OWNER TO ekiti_private_gateway;

-- PostgreSQL functions are executable by PUBLIC unless explicitly revoked.
REVOKE ALL ON FUNCTION civic_private.accept_private_report(
  uuid,bytea,bytea,text,text,text,text,text,text,integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_private.track_private_report(uuid,bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_private.purge_expired_private_reports() FROM PUBLIC;
GRANT USAGE ON SCHEMA civic_private TO ekiti_report_api, ekiti_report_maintenance;
GRANT EXECUTE ON FUNCTION civic_private.accept_private_report(
  uuid,bytea,bytea,text,text,text,text,text,text,integer
) TO ekiti_report_api;
GRANT EXECUTE ON FUNCTION civic_private.track_private_report(uuid,bytea)
  TO ekiti_report_api;
GRANT EXECUTE ON FUNCTION civic_private.purge_expired_private_reports()
  TO ekiti_report_maintenance;

-- No grants to anon, authenticated, ekiti_location_reader or a live
-- Hyperdrive login. Operator must schedule and audit a real deletion job.
