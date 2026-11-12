-- PROPOSAL ONLY. NEVER APPLY TO THE LIVE SUPABASE PROJECT.
-- Requires a separately approved private reporting proposal (0004), consent,
-- retention/deletion job, independent operator and authorized staff policy.
-- Only CI's disposable database may deliberately opt in using a LOCAL setting:
-- BEGIN; SET LOCAL ekiti.admin_policy_approved='yes';
-- \i db/proposals/0006_admin_private.sql
-- Public/citizen/location reader roles receive NO private privileges.
BEGIN;
DO $$
BEGIN
  IF current_setting('ekiti.admin_policy_approved', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Private admin schema not approved. See docs/admin-gateway-milestone.md';
  END IF;
  IF to_regclass('civic_private.reports') IS NULL OR
     to_regclass('civic_private.case_events') IS NULL THEN
    RAISE EXCEPTION 'Approved private report schema must be installed first';
  END IF;
END $$;

-- A revision is the optimistic-concurrency guard used by the private note RPC.
-- Existing event IDs remain internal, with separately generated UUID identifiers
-- for controlled API responses.
ALTER TABLE civic_private.reports
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1
    CHECK (revision >= 1);
ALTER TABLE civic_private.case_events
  ADD COLUMN IF NOT EXISTS event_uuid uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS private_case_event_uuid
  ON civic_private.case_events(event_uuid);

-- Extension to the earlier guarded proposed enum CHECK. "internal_note" is
-- platform moderation only; it never represents government acknowledgement.
ALTER TABLE civic_private.case_events
  DROP CONSTRAINT IF EXISTS case_events_kind_check;
ALTER TABLE civic_private.case_events
  ADD CONSTRAINT case_events_kind_check
    CHECK (kind IN ('intake_accepted','under_review','needs_information','closed','internal_note'));

-- Staff invitations are created only by an independently audited operator.
-- The default state is disabled. Approval and disabling/revocation are required
-- server workflows; no citizen JWT role automatically receives a membership.
CREATE TABLE IF NOT EXISTS civic_private.staff_memberships (
  user_id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN
    ('platform_admin','case_manager','moderator','directory_reviewer','government_officer','auditor')),
  active boolean NOT NULL DEFAULT false,
  allowed_lga_ids text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (cardinality(allowed_lga_ids) <= 16),
  verified_office_id text,
  expires_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT active OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK (approved_by IS NULL OR approved_by <> user_id),
  -- Government/agency login cannot be activated by this proposal: there
  -- is no verified office registry or delivery evidence yet.
  CHECK (role <> 'government_officer' OR (NOT active AND verified_office_id IS NULL))
);

-- Minimal operational audit: no raw narrative, IP, token or exact position.
-- Audit retention and deletion require approval before this is activated.
CREATE TABLE IF NOT EXISTS civic_private.admin_access_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN
    ('case_list','case_read','event_read','internal_note')),
  report_id uuid REFERENCES civic_private.reports(id) ON DELETE CASCADE,
  lga_id text REFERENCES geo.areas(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_access_actor_time
  ON civic_private.admin_access_audit(actor_id,recorded_at DESC);

-- Server repository must lock a report row and store an internal note event,
-- audit row, idempotency marker and new report revision in ONE transaction.
-- A request fingerprint allows conflicting reuse of a request UUID to fail.
CREATE TABLE IF NOT EXISTS civic_private.admin_note_requests (
  request_id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES civic_private.reports(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  request_digest bytea NOT NULL CHECK (octet_length(request_digest)=32),
  event_id bigint NOT NULL UNIQUE REFERENCES civic_private.case_events(id) ON DELETE CASCADE,
  expected_revision bigint NOT NULL CHECK (expected_revision >= 1),
  committed_revision bigint NOT NULL CHECK (committed_revision >= 2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_note_report_recent
  ON civic_private.admin_note_requests(report_id,created_at DESC);

ALTER TABLE civic_private.staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.staff_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE civic_private.admin_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.admin_access_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE civic_private.admin_note_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.admin_note_requests FORCE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA civic_private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA civic_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA civic_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA civic_private FROM PUBLIC,anon,authenticated;

-- Deliberately NO grants to ekiti_location_reader, anon, authenticated,
-- current Hyperdrive credentials or any generic app role.
-- Separately reviewed private SECURITY DEFINER RPCs with server-verified actor
-- and LGA checks are still required before use.
COMMIT;
