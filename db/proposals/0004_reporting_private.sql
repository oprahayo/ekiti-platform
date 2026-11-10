-- PROPOSAL ONLY. NOT AN APPROVED OR AUTOMATIC MIGRATION.
-- Do NOT run in Supabase until the public intake privacy/retention policy,
-- moderation operations, secure backend role and deletion job are approved.
-- A deliberate transaction-level opt-in must be set by the future migration runner:
--   BEGIN; SET LOCAL ekiti.report_policy_approved = 'yes';
--   \i db/proposals/0004_reporting_private.sql   (psql) 
-- Note: psql \i in a transaction is not suitable for the SQL Editor.
-- This file intentionally never grants the Worker access to write.

BEGIN;
DO $$
BEGIN
  IF current_setting('ekiti.report_policy_approved', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Report intake storage is NOT approved. See docs/reporting-governance.md';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS civic_private;
REVOKE ALL ON SCHEMA civic_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS civic_private.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  request_fingerprint bytea NOT NULL CHECK (octet_length(request_fingerprint) = 32),
  tracking_secret_digest bytea NOT NULL UNIQUE CHECK (octet_length(tracking_secret_digest) = 32),
  kind text NOT NULL CHECK (kind IN ('Complaint','Commendation','Issue')),
  description text NOT NULL CHECK (length(description) BETWEEN 20 AND 4000),
  lga_id text NOT NULL REFERENCES geo.areas(id),
  ward_id text REFERENCES geo.areas(id),
  place text NOT NULL DEFAULT '' CHECK (length(place) <= 160),
  consent_policy_version text NOT NULL CHECK (length(consent_policy_version) BETWEEN 1 AND 80),
  received_at timestamptz NOT NULL DEFAULT now(),
  delete_at timestamptz NOT NULL,
  CONSTRAINT report_retention_in_future CHECK (delete_at > received_at)
);
CREATE INDEX IF NOT EXISTS private_reports_delete_at ON civic_private.reports(delete_at);

-- Reports intentionally do NOT store direct contact data, device coordinates,
-- IP addresses, or uploaded evidence in this first schema.
-- The narrative itself may still contain identifying or sensitive data.

CREATE TABLE IF NOT EXISTS civic_private.case_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES civic_private.reports(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('intake_accepted','under_review','needs_information','closed')),
  actor_kind text NOT NULL CHECK (actor_kind IN ('system','moderator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  explanation text NOT NULL DEFAULT '' CHECK (length(explanation) <= 500)
);
CREATE INDEX IF NOT EXISTS private_events_report_order ON civic_private.case_events(report_id, id);

ALTER TABLE civic_private.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.reports FORCE ROW LEVEL SECURITY;
ALTER TABLE civic_private.case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.case_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA civic_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA civic_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA civic_private FROM PUBLIC;

-- No INSERT/SELECT/UPDATE/DELETE or EXECUTE grants are made to anon,
-- authenticated, ekiti_location_reader or the current Hyperdrive login.
-- A separate, narrowly scoped SECURITY DEFINER gateway is future work,
-- gated on retention enforcement, tests, public consent and moderation.
COMMIT;
