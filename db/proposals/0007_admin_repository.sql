-- PROPOSAL ONLY: isolated private backend repository, NEVER applied to Supabase automatically.
-- Requires db/proposals/0004_reporting_private.sql and 0006_admin_private.sql.
-- Operator must approve separately: BEGIN; SET LOCAL ekiti.admin_repository_approved='yes';
-- psql -f db/proposals/0007_admin_repository.sql (DISPOSABLE CI ONLY until approved)
-- A dedicated, server-only API login can be granted ekiti_admin_rpc later, after review.
-- Never grant this role to anon, authenticated, location reader, or the public Worker.
BEGIN;
DO $$
BEGIN
  IF current_setting('ekiti.admin_repository_approved', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Admin repository requires explicit separate authorization';
  END IF;
  IF to_regclass('civic_private.staff_memberships') IS NULL OR
     to_regclass('civic_private.admin_note_requests') IS NULL THEN
    RAISE EXCEPTION 'Private reporting and administrative proposals are prerequisites';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ekiti_admin_rpc') THEN
    CREATE ROLE ekiti_admin_rpc NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Use unambiguous function signatures with fully qualified tables and search path.
-- All functions run under a privileged service-owned identity. This proposal is
-- only tested as disposable CI postgres. The eventual owner/BYPASSRLS permissions,
-- role grants, session trust and audit retention require independent security review.
CREATE FUNCTION civic_private.admin_rpc_membership(_actor uuid)
RETURNS TABLE(user_id uuid, role text, active boolean, expires_at timestamptz,
              allowed_lga_ids text[], verified_office_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
 SELECT m.user_id, m.role, m.active, m.expires_at,
        m.allowed_lga_ids, m.verified_office_id
 FROM civic_private.staff_memberships m
 WHERE m.user_id = _actor AND m.active
   AND (m.expires_at IS NULL OR m.expires_at > now())
   AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
 LIMIT 1;
$$;

CREATE FUNCTION civic_private.admin_rpc_cases(_actor uuid, _lga text, _limit integer)
RETURNS TABLE(
  id uuid, public_reference uuid, kind text, lga_id text, current_state text,
  revision bigint, received_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 25 OR
     (_lga IS NOT NULL AND (_lga !~ '^[a-z0-9][a-z0-9-]{1,63}$')) THEN
    RAISE EXCEPTION 'Invalid case query';
  END IF;
  RETURN QUERY
    WITH authorized AS (
      SELECT m.role, m.allowed_lga_ids
      FROM civic_private.staff_memberships m
      WHERE m.user_id = _actor AND m.active
        AND (m.expires_at IS NULL OR m.expires_at > now())
        AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
        AND m.role IN ('platform_admin','case_manager','moderator')
    )
    SELECT r.id, r.public_reference, r.kind, r.lga_id,
      coalesce(e.kind, 'intake_accepted')::text, r.revision,
      r.received_at, coalesce(e.created_at, r.received_at)
    FROM civic_private.reports r
    CROSS JOIN authorized staff
    LEFT JOIN LATERAL (
      SELECT ev.kind, ev.created_at
      FROM civic_private.case_events ev
      WHERE ev.report_id = r.id AND ev.kind <> 'internal_note'
      ORDER BY ev.id DESC LIMIT 1
    ) e ON true
    WHERE r.delete_at > now()
      AND (_lga IS NULL OR r.lga_id = _lga)
      AND (staff.role = 'platform_admin' OR r.lga_id = ANY(staff.allowed_lga_ids))
    ORDER BY r.received_at DESC, r.id DESC
    LIMIT _limit;
END;
$$;

CREATE FUNCTION civic_private.admin_rpc_case(_actor uuid, _case uuid)
RETURNS TABLE(
  id uuid, public_reference uuid, kind text, lga_id text, current_state text,
  revision bigint, received_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT x.*
  FROM civic_private.admin_rpc_cases(_actor,NULL,25) x
  WHERE x.id = _case;
$$;
-- The bounded admin_rpc_cases() scan above only covers the newest 25 records.
-- Replace the detail function with an explicitly authorized targeted lookup,
-- never a limit-dependent scan.
CREATE OR REPLACE FUNCTION civic_private.admin_rpc_case(_actor uuid, _case uuid)
RETURNS TABLE(
  id uuid, public_reference uuid, kind text, lga_id text, current_state text,
  revision bigint, received_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT r.id, r.public_reference, r.kind, r.lga_id,
      coalesce(e.kind,'intake_accepted')::text, r.revision,
      r.received_at, coalesce(e.created_at,r.received_at)
  FROM civic_private.reports r
  JOIN civic_private.staff_memberships m
    ON m.user_id = _actor AND m.active
   AND (m.expires_at IS NULL OR m.expires_at > now())
   AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
   AND m.role IN ('platform_admin','case_manager','moderator')
   AND (m.role = 'platform_admin' OR r.lga_id = ANY(m.allowed_lga_ids))
  LEFT JOIN LATERAL (
    SELECT ev.kind, ev.created_at FROM civic_private.case_events ev
    WHERE ev.report_id = r.id AND ev.kind <> 'internal_note'
    ORDER BY ev.id DESC LIMIT 1
  ) e ON true
  WHERE r.id = _case AND r.delete_at > now();
$$;

CREATE FUNCTION civic_private.admin_rpc_events(_actor uuid, _case uuid, _limit integer)
RETURNS TABLE(id uuid, kind text, actor_kind text, created_at timestamptz, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Invalid event limit';
  END IF;
  RETURN QUERY
    SELECT ev.event_uuid, ev.kind, ev.actor_kind, ev.created_at, ev.explanation
    FROM civic_private.case_events ev
    JOIN civic_private.reports r ON r.id = ev.report_id AND r.delete_at > now()
    JOIN civic_private.staff_memberships m
      ON m.user_id = _actor AND m.active
     AND (m.expires_at IS NULL OR m.expires_at > now())
     AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
     AND m.role IN ('platform_admin','case_manager','moderator')
     AND (m.role = 'platform_admin' OR r.lga_id = ANY(m.allowed_lga_ids))
    WHERE ev.report_id = _case
    ORDER BY ev.id DESC LIMIT _limit;
END;
$$;

-- A read must have an authorized live membership AND a matching scope at the
-- instant the audit row is written. A read with an audit insertion error fails closed.
CREATE FUNCTION civic_private.admin_rpc_audit_read(
  _actor uuid, _action text, _case uuid, _lga text
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  permitted boolean;
BEGIN
  IF _action NOT IN ('case_list','case_read','event_read') THEN
    RAISE EXCEPTION 'Unsupported audit action';
  END IF;
  IF _action = 'case_list' THEN
    SELECT EXISTS(
      SELECT 1 FROM civic_private.staff_memberships m
      WHERE m.user_id = _actor AND m.active
        AND (m.expires_at IS NULL OR m.expires_at > now())
        AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
        AND m.role IN ('platform_admin','case_manager','moderator')
        AND (_lga IS NULL OR m.role = 'platform_admin' OR _lga = ANY(m.allowed_lga_ids))
    ) INTO permitted;
    IF _case IS NOT NULL THEN RAISE EXCEPTION 'Unexpected case for list audit'; END IF;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM civic_private.reports r
      JOIN civic_private.staff_memberships m ON m.user_id = _actor AND m.active
       AND (m.expires_at IS NULL OR m.expires_at > now())
       AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
       AND m.role IN ('platform_admin','case_manager','moderator')
       AND (m.role = 'platform_admin' OR r.lga_id = ANY(m.allowed_lga_ids))
      WHERE r.id = _case AND r.delete_at > now()
        AND (_lga IS NULL OR r.lga_id = _lga)
    ) INTO permitted;
  END IF;
  IF NOT permitted THEN RAISE EXCEPTION 'Access denied'; END IF;
  INSERT INTO civic_private.admin_access_audit(actor_id,operation,report_id,lga_id)
  VALUES (_actor,_action,_case,_lga);
END;
$$;

-- Critical section: serializes same-request keys even across case IDs, locks a
-- report for revision check, and writes event, note marker, revision and audit
-- in one transaction. A report lock also serializes distinct-key concurrent notes.
CREATE FUNCTION civic_private.admin_rpc_note(
  _actor uuid, _case uuid, _request uuid, _expected_revision bigint, _text text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  report_row civic_private.reports%ROWTYPE;
  staff_role text;
  staff_lgas text[];
  prior civic_private.admin_note_requests%ROWTYPE;
  current_digest bytea;
  event_id bigint;
  event_uuid uuid;
  next_revision bigint;
BEGIN
  IF _actor IS NULL OR _case IS NULL OR _request IS NULL OR _text IS NULL OR
     _expected_revision IS NULL OR _expected_revision < 1 OR
     length(_text) NOT BETWEEN 8 AND 500 OR btrim(_text) <> _text OR
     _text ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid note';
  END IF;
  SELECT m.role,m.allowed_lga_ids INTO staff_role,staff_lgas
  FROM civic_private.staff_memberships m
  WHERE m.user_id = _actor AND m.active
    AND (m.expires_at IS NULL OR m.expires_at > now())
    AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
    AND m.role IN ('platform_admin','case_manager','moderator');
  IF staff_role IS NULL THEN RETURN jsonb_build_object('result','not_found'); END IF;

  -- Transaction-level advisory lock with a fixed hash for the UUID. Collisions
  -- only serialize unrelated requests, never relax authorization or uniqueness.
  PERFORM pg_advisory_xact_lock(hashtextextended(_request::text, 14153));
  SELECT * INTO report_row FROM civic_private.reports r
  WHERE r.id = _case AND r.delete_at > now() FOR UPDATE;
  IF NOT FOUND OR
     (staff_role <> 'platform_admin' AND NOT report_row.lga_id = ANY(staff_lgas))
  THEN RETURN jsonb_build_object('result','not_found'); END IF;

  current_digest := sha256(convert_to(
    _actor::text || ':' || _case::text || ':' ||
    _expected_revision::text || ':' || _text,'UTF8'));

  SELECT * INTO prior FROM civic_private.admin_note_requests a
  WHERE a.request_id = _request;
  IF FOUND THEN
    IF prior.report_id <> _case OR prior.actor_id <> _actor OR
       prior.expected_revision <> _expected_revision OR
       prior.request_digest <> current_digest THEN
      RETURN jsonb_build_object('result','conflict');
    END IF;
    SELECT ev.event_uuid INTO event_uuid FROM civic_private.case_events ev
    WHERE ev.id = prior.event_id AND ev.report_id = _case;
    IF event_uuid IS NULL THEN RAISE EXCEPTION 'Missing persisted event'; END IF;
    RETURN jsonb_build_object('result','replayed','eventId',event_uuid,
                              'revision',prior.committed_revision);
  END IF;
  IF report_row.revision <> _expected_revision THEN
    RETURN jsonb_build_object('result','conflict');
  END IF;
  INSERT INTO civic_private.case_events(report_id,kind,actor_kind,explanation)
  VALUES (_case,'internal_note','moderator',_text)
  RETURNING id, civic_private.case_events.event_uuid INTO event_id,event_uuid;
  next_revision := report_row.revision + 1;
  UPDATE civic_private.reports SET revision = next_revision WHERE id = _case;
  INSERT INTO civic_private.admin_note_requests(
    request_id,report_id,actor_id,request_digest,event_id,
    expected_revision,committed_revision
  ) VALUES (_request,_case,_actor,current_digest,event_id,_expected_revision,next_revision);
  INSERT INTO civic_private.admin_access_audit(actor_id,operation,report_id,lga_id)
  VALUES (_actor,'internal_note',_case,report_row.lga_id);
  RETURN jsonb_build_object('result','created','eventId',event_uuid,'revision',next_revision);
END;
$$;

-- The owner, never the caller, performs all table reads/writes. The invoker role
-- has function execution only; it has no table or sequence privileges.
REVOKE ALL ON FUNCTION civic_private.admin_rpc_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_private.admin_rpc_cases(uuid,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_private.admin_rpc_case(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_private.admin_rpc_events(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_private.admin_rpc_audit_read(uuid,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_private.admin_rpc_note(uuid,uuid,uuid,bigint,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA civic_private TO ekiti_admin_rpc;
GRANT EXECUTE ON FUNCTION civic_private.admin_rpc_membership(uuid) TO ekiti_admin_rpc;
GRANT EXECUTE ON FUNCTION civic_private.admin_rpc_cases(uuid,text,integer) TO ekiti_admin_rpc;
GRANT EXECUTE ON FUNCTION civic_private.admin_rpc_case(uuid,uuid) TO ekiti_admin_rpc;
GRANT EXECUTE ON FUNCTION civic_private.admin_rpc_events(uuid,uuid,integer) TO ekiti_admin_rpc;
GRANT EXECUTE ON FUNCTION civic_private.admin_rpc_audit_read(uuid,text,uuid,text) TO ekiti_admin_rpc;
GRANT EXECUTE ON FUNCTION civic_private.admin_rpc_note(uuid,uuid,uuid,bigint,text) TO ekiti_admin_rpc;
COMMIT;
