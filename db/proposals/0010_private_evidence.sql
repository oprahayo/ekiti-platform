-- Sprint 06: REVIEW-ONLY encrypted evidence ledger proposal.
-- NEVER APPLY to live Supabase or auto-run from staging:prepare.
-- Depends on separately reviewed 0004_reporting_private.sql + 0006_private_gateway.sql.
-- To inspect against a throwaway DB only:
-- BEGIN;
-- SET LOCAL ekiti.report_policy_approved='yes';
-- SET LOCAL ekiti.private_gateway_reviewed='yes';
-- SET LOCAL ekiti.evidence_privacy_reviewed='yes';
-- \i db/proposals/0010_private_evidence.sql
-- COMMIT;
-- THIS DOES NOT CREATE AN R2 BUCKET, ENCRYPTION KEY, RETENTION JOB OR APPROVAL.

DO $$
BEGIN
  IF current_setting('ekiti.report_policy_approved',true) IS DISTINCT FROM 'yes'
     OR current_setting('ekiti.private_gateway_reviewed',true) IS DISTINCT FROM 'yes'
     OR current_setting('ekiti.evidence_privacy_reviewed',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Evidence storage has not received explicit review';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ekiti_evidence_api') THEN
    CREATE ROLE ekiti_evidence_api NOLOGIN;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS civic_private.evidence_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES civic_private.reports(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('Audio','Video')),
  mime_type text NOT NULL CHECK(mime_type IN ('audio/webm','audio/mp4','video/webm','video/mp4')),
  evidence_policy_version text NOT NULL CHECK(length(evidence_policy_version) BETWEEN 1 AND 80),
  started_at timestamptz NOT NULL DEFAULT now(),
  delete_at timestamptz NOT NULL,
  next_index integer NOT NULL DEFAULT 0 CHECK(next_index BETWEEN 0 AND 1024),
  total_bytes bigint NOT NULL DEFAULT 0 CHECK(total_bytes BETWEEN 0 AND 25000000),
  finished boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS evidence_sessions_report ON civic_private.evidence_sessions(report_id);
CREATE INDEX IF NOT EXISTS evidence_sessions_expiry ON civic_private.evidence_sessions(delete_at);
CREATE TABLE IF NOT EXISTS civic_private.evidence_chunks (
  session_id uuid NOT NULL REFERENCES civic_private.evidence_sessions(id) ON DELETE CASCADE,
  index integer NOT NULL CHECK(index BETWEEN 0 AND 1023),
  sha256 bytea NOT NULL CHECK(octet_length(sha256)=32),
  bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 1048576),
  object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 64 AND 160),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id,index)
);

ALTER TABLE civic_private.evidence_sessions OWNER TO ekiti_private_gateway;
ALTER TABLE civic_private.evidence_chunks OWNER TO ekiti_private_gateway;
ALTER TABLE civic_private.evidence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.evidence_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE civic_private.evidence_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.evidence_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_owner_only ON civic_private.evidence_sessions TO ekiti_private_gateway
  USING(true) WITH CHECK(true);
CREATE POLICY evidence_chunk_owner_only ON civic_private.evidence_chunks TO ekiti_private_gateway
  USING(true) WITH CHECK(true);

REVOKE ALL ON civic_private.evidence_sessions, civic_private.evidence_chunks FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON civic_private.evidence_sessions TO ekiti_private_gateway;
GRANT SELECT,INSERT,UPDATE,DELETE ON civic_private.evidence_chunks TO ekiti_private_gateway;

-- The receipt secret itself is NEVER persisted. Verification compares only
-- the digest supplied by the trusted application with the report digest.
CREATE FUNCTION civic_private.start_evidence_session(
  _reference uuid,_digest bytea,_kind text,_mime text,_policy text
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _id uuid;
BEGIN
  IF octet_length(_digest)<>32 OR _kind NOT IN ('Audio','Video')
     OR (_kind='Audio' AND _mime NOT IN ('audio/webm','audio/mp4'))
     OR (_kind='Video' AND _mime NOT IN ('video/webm','video/mp4'))
     OR nullif(_policy,'') IS NULL OR length(_policy)>80 THEN
    RAISE EXCEPTION 'invalid_evidence_session' USING ERRCODE='22023';
  END IF;
  INSERT INTO civic_private.evidence_sessions(report_id,kind,mime_type,evidence_policy_version,delete_at)
    SELECT r.id,_kind,_mime,_policy,LEAST(r.delete_at,now()+interval '24 hours')
      FROM civic_private.reports r
     WHERE r.public_reference=_reference AND r.tracking_secret_digest=_digest
       AND r.delete_at>now() AND r.kind IN ('Issue','Complaint')
    RETURNING id INTO _id;
  IF _id IS NULL THEN RAISE EXCEPTION 'invalid_evidence_session' USING ERRCODE='22023'; END IF;
  RETURN _id;
END $$;
ALTER FUNCTION civic_private.start_evidence_session(uuid,bytea,text,text,text) OWNER TO ekiti_private_gateway;

CREATE FUNCTION civic_private.evidence_session_status(_id uuid,_digest bytea)
RETURNS TABLE(kind text,mime_type text,finished boolean,total_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT s.kind,s.mime_type,s.finished,s.total_bytes
    FROM civic_private.evidence_sessions s
    JOIN civic_private.reports r ON r.id=s.report_id
   WHERE s.id=_id AND r.tracking_secret_digest=_digest
     AND r.delete_at>now() AND s.delete_at>now();
$$;
ALTER FUNCTION civic_private.evidence_session_status(uuid,bytea) OWNER TO ekiti_private_gateway;

CREATE FUNCTION civic_private.evidence_chunk_list(_id uuid,_digest bytea)
RETURNS TABLE(index integer,sha256 bytea,bytes integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT c.index,c.sha256,c.bytes
    FROM civic_private.evidence_chunks c
    JOIN civic_private.evidence_sessions s ON s.id=c.session_id
    JOIN civic_private.reports r ON r.id=s.report_id
   WHERE s.id=_id AND r.tracking_secret_digest=_digest
     AND r.delete_at>now() AND s.delete_at>now()
   ORDER BY c.index LIMIT 1024;
$$;
ALTER FUNCTION civic_private.evidence_chunk_list(uuid,bytea) OWNER TO ekiti_private_gateway;

-- Serializes each session's next index. Duplicate same-index/same-content
-- requests are safe; conflicting bytes and out-of-order writes fail.
CREATE FUNCTION civic_private.ack_evidence_chunk(
  _id uuid,_digest bytea,_index integer,_sha256 bytea,_bytes integer,_object_key text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  _s civic_private.evidence_sessions%ROWTYPE;
  _old_sha bytea;
  _old_bytes integer;
BEGIN
  IF _index NOT BETWEEN 0 AND 1023 OR _bytes NOT BETWEEN 1 AND 1048576
     OR octet_length(_sha256)<>32
     OR _object_key !~ '^private-evidence/v1/[0-9a-f-]{36}/[0-9a-f-]{36}$'
     THEN RAISE EXCEPTION 'invalid_chunk' USING ERRCODE='22023';
  END IF;

  SELECT s.* INTO _s FROM civic_private.evidence_sessions s
    JOIN civic_private.reports r ON r.id=s.report_id
   WHERE s.id=_id AND r.tracking_secret_digest=_digest
     AND r.delete_at>now() AND s.delete_at>now()
   FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_session' USING ERRCODE='22023'; END IF;
  SELECT c.sha256,c.bytes INTO _old_sha,_old_bytes
    FROM civic_private.evidence_chunks c WHERE c.session_id=_id AND c.index=_index;
  IF FOUND THEN
    IF _old_sha=_sha256 AND _old_bytes=_bytes THEN RETURN false; END IF;
    RAISE EXCEPTION 'conflicting_chunk' USING ERRCODE='23505';
  END IF;
  IF _s.finished OR _index<>_s.next_index
     OR (_s.kind='Audio' AND _s.total_bytes+_bytes>15000000)
     OR (_s.kind='Video' AND _s.total_bytes+_bytes>25000000) THEN
    RAISE EXCEPTION 'invalid_chunk_sequence' USING ERRCODE='22023';
  END IF;
  INSERT INTO civic_private.evidence_chunks(session_id,index,sha256,bytes,object_key)
    VALUES(_id,_index,_sha256,_bytes,_object_key);
  UPDATE civic_private.evidence_sessions SET
    next_index=next_index+1,total_bytes=total_bytes+_bytes WHERE id=_id;
  RETURN true;
END $$;
ALTER FUNCTION civic_private.ack_evidence_chunk(uuid,bytea,integer,bytea,integer,text)
  OWNER TO ekiti_private_gateway;

CREATE FUNCTION civic_private.finish_evidence_session(
  _id uuid,_digest bytea,_expected integer
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE _next integer;
BEGIN
  IF _expected NOT BETWEEN 1 AND 1024 THEN RETURN false; END IF;
  SELECT s.next_index INTO _next FROM civic_private.evidence_sessions s
    JOIN civic_private.reports r ON r.id=s.report_id
   WHERE s.id=_id AND r.tracking_secret_digest=_digest
     AND r.delete_at>now() AND s.delete_at>now() FOR UPDATE OF s;
  IF _next IS NULL OR _next<>_expected THEN RETURN false; END IF;
  UPDATE civic_private.evidence_sessions SET finished=true WHERE id=_id;
  RETURN true;
END $$;
ALTER FUNCTION civic_private.finish_evidence_session(uuid,bytea,integer)
  OWNER TO ekiti_private_gateway;

-- API role is NOLOGIN; reviewed operator must provision a distinct,
-- non-public Hyperdrive login and authorize ONLY these functions.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA civic_private FROM PUBLIC;
GRANT USAGE ON SCHEMA civic_private TO ekiti_evidence_api;
GRANT EXECUTE ON FUNCTION civic_private.start_evidence_session(uuid,bytea,text,text,text)
  TO ekiti_evidence_api;
GRANT EXECUTE ON FUNCTION civic_private.evidence_session_status(uuid,bytea)
  TO ekiti_evidence_api;
GRANT EXECUTE ON FUNCTION civic_private.evidence_chunk_list(uuid,bytea)
  TO ekiti_evidence_api;
GRANT EXECUTE ON FUNCTION civic_private.ack_evidence_chunk(uuid,bytea,integer,bytea,integer,text)
  TO ekiti_evidence_api;
GRANT EXECUTE ON FUNCTION civic_private.finish_evidence_session(uuid,bytea,integer)
  TO ekiti_evidence_api;

-- No database read endpoint exposes encrypted R2 keys or plaintext.
-- IMPORTANT: deleting SQL rows does NOT remove R2 ciphertext objects.
-- A verified coordinated storage purge (including orphaned uploads and
-- backups), key rotation, incident handling and reviewer controls are
-- required before setting the release flags. None are implemented here.
