-- Sprint 13: ADMIN-ONLY, REVIEW-ONLY intake queue and proposal workflow.
-- Separate from citizen intake/office verification. NEVER a live migration.
-- Only disposable CI: BEGIN; SET LOCAL ekiti.admin_intake_reviewed='yes';
-- execute SQL; ROLLBACK. No office acknowledgements, evidence or dispatch.
DO $$
BEGIN
  IF current_setting('ekiti.admin_intake_reviewed',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Admin intake requires independent safeguarding review';
  END IF;
  IF to_regprocedure('civic_private.admin_rpc_membership(uuid)') IS NULL OR
     to_regclass('civic_private.staff_memberships') IS NULL THEN
    RAISE EXCEPTION 'Reviewed private admin repository is required';
  END IF;
END $$;

-- Operator retains ownership and exclusively controls the release flag.
CREATE TABLE civic_private.admin_intake_release (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
  enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  review_id text CHECK(review_id IS NULL OR length(review_id) BETWEEN 8 AND 160),
  CHECK(NOT enabled OR (approved_at IS NOT NULL AND review_id IS NOT NULL))
);
INSERT INTO civic_private.admin_intake_release(singleton,enabled)
  VALUES(true,false);
ALTER TABLE civic_private.admin_intake_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.admin_intake_release FORCE ROW LEVEL SECURITY;
REVOKE ALL ON civic_private.admin_intake_release FROM PUBLIC,anon,authenticated,ekiti_admin_rpc;

-- This queue is a suggestion-only handoff to a FUTURE independent operator
-- review. Never changes case status, category, assigned staff, jurisdiction,
-- public visibility or a government office's knowledge.
CREATE TABLE civic_private.admin_intake_review_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES civic_private.reports(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN
    ('safeguarding_review','possible_duplicate','assignment_review')),
  target_lga_id text REFERENCES geo.areas(id),
  expected_revision bigint NOT NULL CHECK(expected_revision>=1),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK(status='pending'),
  UNIQUE(report_id,kind),
  CHECK ((kind='assignment_review')=(target_lga_id IS NOT NULL))
);
CREATE TABLE civic_private.admin_intake_review_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES civic_private.admin_intake_review_proposals(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  report_id uuid NOT NULL REFERENCES civic_private.reports(id) ON DELETE CASCADE,
  action text NOT NULL CHECK(action='proposed_only'),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_intake_proposals_recent
  ON civic_private.admin_intake_review_proposals(created_at DESC);
ALTER TABLE civic_private.admin_intake_review_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.admin_intake_review_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE civic_private.admin_intake_review_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.admin_intake_review_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON civic_private.admin_intake_review_proposals,
  civic_private.admin_intake_review_audit FROM PUBLIC,anon,authenticated,ekiti_admin_rpc,
  ekiti_location_reader;

-- Every query rechecks current staff membership and scope *inside SQL*.
-- The public citizen app has no route, service-role login or view into this.
CREATE FUNCTION civic_private.admin_rpc_intake_cases(
  _actor uuid,_lga text,_kind text,_state text,_limit integer
) RETURNS TABLE(
  id uuid,public_reference uuid,kind text,lga_id text,current_state text,
  revision bigint,received_at timestamptz,updated_at timestamptz,
  evidence_access text
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF _actor IS NULL OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 25 OR
     (_lga IS NOT NULL AND _lga !~ '^[a-z0-9][a-z0-9-]{1,63}$') OR
     (_kind IS NOT NULL AND _kind NOT IN('Issue','Complaint','Commendation')) OR
     (_state IS NOT NULL AND _state NOT IN
       ('intake_accepted','under_review','needs_information','closed')) THEN
    RAISE EXCEPTION 'Invalid intake filters';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM civic_private.admin_intake_release
    WHERE singleton AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
  THEN RETURN; END IF;
  RETURN QUERY
    SELECT r.id,r.public_reference,r.kind,r.lga_id,
      coalesce(e.kind,'intake_accepted')::text,r.revision,
      r.received_at,coalesce(e.created_at,r.received_at),
      'blocked_pending_safeguarding'::text
    FROM civic_private.reports r
    JOIN civic_private.staff_memberships m
      ON m.user_id=_actor AND m.active
      AND (m.expires_at IS NULL OR m.expires_at>now())
      AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
      AND m.role IN('platform_admin','case_manager','moderator')
      AND (m.role='platform_admin' OR r.lga_id=ANY(m.allowed_lga_ids))
    JOIN geo.areas g ON g.id=r.lga_id
      AND g.area_kind='lga' AND g.verification_state='verified'
    LEFT JOIN LATERAL(
      SELECT ev.kind,ev.created_at FROM civic_private.case_events ev
      WHERE ev.report_id=r.id AND ev.kind IN
        ('intake_accepted','under_review','needs_information','closed')
      ORDER BY ev.id DESC LIMIT 1
    ) e ON true
    WHERE r.delete_at>now()
      AND (_lga IS NULL OR r.lga_id=_lga)
      AND (_kind IS NULL OR r.kind=_kind)
      AND (_state IS NULL OR coalesce(e.kind,'intake_accepted')=_state)
    ORDER BY r.received_at DESC,r.id DESC
    LIMIT _limit;
END $$;

CREATE FUNCTION civic_private.admin_rpc_intake_propose(
  _actor uuid,_case uuid,_kind text,_target_lga text,_revision bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE r civic_private.reports%ROWTYPE;
  staff_role text;staff_lgas text[];
  result_id uuid;prior civic_private.admin_intake_review_proposals%ROWTYPE;
BEGIN
  IF _actor IS NULL OR _case IS NULL OR _revision IS NULL OR _revision<1 OR
    _kind IS NULL OR
    _kind NOT IN('safeguarding_review','possible_duplicate','assignment_review') OR
    (_kind='assignment_review')<>(_target_lga IS NOT NULL) OR
    (_target_lga IS NOT NULL AND _target_lga !~ '^[a-z0-9][a-z0-9-]{1,63}$')
  THEN RETURN jsonb_build_object('result','not_available'); END IF;
  IF NOT EXISTS(SELECT 1 FROM civic_private.admin_intake_release
    WHERE singleton AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
  THEN RETURN jsonb_build_object('result','not_available'); END IF;

  SELECT m.role,m.allowed_lga_ids INTO staff_role,staff_lgas
    FROM civic_private.staff_memberships m
    WHERE m.user_id=_actor AND m.active AND
      (m.expires_at IS NULL OR m.expires_at>now()) AND
      m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL AND
      m.role IN('platform_admin','case_manager','moderator');
  IF staff_role IS NULL OR
     (_kind='assignment_review' AND staff_role='moderator')
  THEN RETURN jsonb_build_object('result','not_available'); END IF;

  SELECT * INTO r FROM civic_private.reports
    WHERE id=_case AND delete_at>now() FOR UPDATE;
  IF NOT FOUND OR
     (staff_role<>'platform_admin' AND NOT r.lga_id=ANY(staff_lgas)) OR
     NOT EXISTS(SELECT 1 FROM geo.areas a
       WHERE a.id=r.lga_id AND a.area_kind='lga'
         AND a.verification_state='verified')
  THEN RETURN jsonb_build_object('result','not_available'); END IF;
  IF r.revision<>_revision THEN
    RETURN jsonb_build_object('result','conflict'); END IF;

  -- Even an administrator may not propose unverified or fictitious office
  -- destinations. The only possible proposal target is a VERIFIED Ekiti LGA.
  IF _target_lga IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM geo.areas a WHERE a.id=_target_lga AND
      a.area_kind='lga' AND a.verification_state='verified' AND
      (staff_role='platform_admin' OR _target_lga=ANY(staff_lgas))
  ) THEN RETURN jsonb_build_object('result','not_available'); END IF;

  SELECT * INTO prior FROM civic_private.admin_intake_review_proposals
    WHERE report_id=_case AND kind=_kind FOR UPDATE;
  IF FOUND THEN
    RETURN CASE WHEN prior.actor_id=_actor AND prior.expected_revision=_revision
      AND prior.target_lga_id IS NOT DISTINCT FROM _target_lga
      THEN jsonb_build_object('result','replayed','proposalId',prior.id)
      ELSE jsonb_build_object('result','conflict') END;
  END IF;

  INSERT INTO civic_private.admin_intake_review_proposals(
    report_id,actor_id,kind,target_lga_id,expected_revision
  ) VALUES(_case,_actor,_kind,_target_lga,_revision)
  RETURNING id INTO result_id;
  -- Audit persistence is part of the same transaction. Failure rolls back
  -- the proposal; nothing updates the report or sends any notifications.
  INSERT INTO civic_private.admin_intake_review_audit(
    proposal_id,actor_id,report_id,action
  ) VALUES(result_id,_actor,_case,'proposed_only');
  RETURN jsonb_build_object('result','queued','proposalId',result_id);
END $$;

REVOKE ALL ON FUNCTION civic_private.admin_rpc_intake_cases(uuid,text,text,text,integer)
  FROM PUBLIC,anon,authenticated,ekiti_location_reader;
REVOKE ALL ON FUNCTION civic_private.admin_rpc_intake_propose(uuid,uuid,text,text,bigint)
  FROM PUBLIC,anon,authenticated,ekiti_location_reader;
GRANT EXECUTE ON FUNCTION civic_private.admin_rpc_intake_cases(uuid,text,text,text,integer)
  TO ekiti_admin_rpc;
GRANT EXECUTE ON FUNCTION civic_private.admin_rpc_intake_propose(uuid,uuid,text,text,bigint)
  TO ekiti_admin_rpc;

-- IMPORTANT: The existing ekiti_admin_rpc principal is currently a NOLOGIN
-- integration-test role. Real staging/production bindings are NOT configured.
-- Actual evidence retrieval, sensitive narrative, government-office routing
-- and duplicate merges are deliberately absent from this sprint.
