-- Sprint 12: REVIEW-ONLY, OPERATOR-ONLY dual-control staff lifecycle.
-- Standalone ADMIN stack (PR #19 -> #20 -> #27), NOT citizen Sprint 11.
-- Never run in production or combine with the citizen proposal named 0006.
-- CI only: BEGIN; SET LOCAL ekiti.staff_lifecycle_reviewed='yes';
--          execute this proposal; ROLLBACK.
DO $$
BEGIN
  IF current_setting('ekiti.staff_lifecycle_reviewed',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Admin staff lifecycle awaits operator and security approval';
  END IF;
  IF to_regclass('civic_private.staff_memberships') IS NULL OR
     to_regprocedure('civic_private.admin_rpc_membership(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Private admin repository must be independently reviewed first';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ekiti_staff_lifecycle_operator') THEN
    CREATE ROLE ekiti_staff_lifecycle_operator NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Privileged migration operator retains table ownership. SECURITY DEFINER
-- functions and the NOLOGIN caller receive SELECT only; neither can flip it.
CREATE TABLE civic_private.staff_lifecycle_release (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
  enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  review_id text,
  CHECK (NOT enabled OR (approved_at IS NOT NULL AND
    review_id IS NOT NULL AND length(review_id) BETWEEN 8 AND 160))
);
INSERT INTO civic_private.staff_lifecycle_release(singleton,enabled) VALUES(true,false);
ALTER TABLE civic_private.staff_lifecycle_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.staff_lifecycle_release FORCE ROW LEVEL SECURITY;

-- A draft is not a Supabase Auth invitation and grants NO staff privileges.
-- Platform-admin and government-officer onboarding is strictly excluded.
CREATE TABLE civic_private.staff_invitation_proposals(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('case_manager','moderator','directory_reviewer','auditor')),
  allowed_lga_ids text[] NOT NULL,
  access_expires_at timestamptz NOT NULL,
  proposed_by uuid NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  approval_deadline timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN('pending','approved','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  CHECK(cardinality(allowed_lga_ids)<=16),
  CHECK(user_id<>proposed_by),
  CHECK(approved_by IS NULL OR (approved_by<>proposed_by AND approved_by<>user_id)),
  CHECK((status='approved')=(approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX staff_one_pending_invitation
  ON civic_private.staff_invitation_proposals(user_id) WHERE status='pending';

CREATE TABLE civic_private.staff_lifecycle_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL CHECK(action IN('proposed','approved','revoked')),
  actor_id uuid NOT NULL,
  target_id uuid NOT NULL,
  proposal_id uuid,
  prior_role text,
  new_role text,
  reason text NOT NULL CHECK(reason IN
    ('new_assignment','approved_scope','offboarding','security_incident','role_review')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_lifecycle_audit_recent
  ON civic_private.staff_lifecycle_audit(created_at DESC,id DESC);

ALTER TABLE civic_private.staff_invitation_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.staff_invitation_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE civic_private.staff_lifecycle_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_private.staff_lifecycle_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON civic_private.staff_lifecycle_release,
  civic_private.staff_invitation_proposals,civic_private.staff_lifecycle_audit
  FROM PUBLIC,anon,authenticated,ekiti_location_reader,ekiti_admin_rpc,
    ekiti_staff_lifecycle_operator;

-- No public routes, no caller-controlled JWK, no browser actor ID.
-- The offline caller must verify the operator's independent AAL2 identity,
-- map that to an actor UUID, and obtain a separate approver's MFA proof.
-- Passing a UUID by itself is NOT authentication; do not expose these RPCs
-- from the existing Admin Worker or any user-facing API.
CREATE FUNCTION civic_private.staff_operator_authorized(_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
  SELECT _actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM civic_private.staff_memberships m
    WHERE m.user_id=_actor AND m.role='platform_admin'
      AND m.active AND m.approved_by IS NOT NULL AND m.approved_at IS NOT NULL
      AND (m.expires_at IS NULL OR m.expires_at>now())
  );
$$;

CREATE FUNCTION civic_private.staff_scope_reviewed(_role text,_lgas text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE n integer;
BEGIN
  IF _role NOT IN ('case_manager','moderator','directory_reviewer','auditor')
    OR _lgas IS NULL OR cardinality(_lgas)>16 THEN RETURN false; END IF;
  n:=cardinality(_lgas);
  IF (_role='auditor' AND n<>0) OR (_role<>'auditor' AND n=0) THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM unnest(_lgas) AS x(id)
      WHERE x.id IS NULL OR x.id !~ '^[a-z0-9][a-z0-9-]{1,63}$')
    OR n<>(SELECT count(DISTINCT id) FROM unnest(_lgas) AS x(id))
    OR EXISTS(SELECT 1 FROM unnest(_lgas) AS x(id)
      LEFT JOIN geo.areas a ON a.id=x.id
      WHERE a.id IS NULL OR a.area_kind<>'lga'
        OR a.verification_state<>'verified')
  THEN RETURN false; END IF;
  RETURN true;
END $$;

CREATE FUNCTION civic_private.staff_lifecycle_propose(
  _actor uuid,_target uuid,_role text,_lgas text[],_expires timestamptz
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE proposed uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM civic_private.staff_lifecycle_release
      WHERE singleton AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
    OR NOT civic_private.staff_operator_authorized(_actor)
    OR _actor=_target OR _target IS NULL
    OR NOT civic_private.staff_scope_reviewed(_role,_lgas)
    OR _expires IS NULL OR _expires<=now()+interval '1 hour'
    OR _expires>now()+interval '90 days'
    OR EXISTS(SELECT 1 FROM civic_private.staff_memberships WHERE user_id=_target)
  THEN RETURN NULL; END IF;
  INSERT INTO civic_private.staff_invitation_proposals(
    user_id,role,allowed_lga_ids,access_expires_at,proposed_by
  ) VALUES (_target,_role,_lgas,_expires,_actor)
  ON CONFLICT DO NOTHING RETURNING id INTO proposed;
  IF proposed IS NOT NULL THEN
    INSERT INTO civic_private.staff_lifecycle_audit(
      action,actor_id,target_id,proposal_id,new_role,reason
    ) VALUES('proposed',_actor,_target,proposed,_role,'new_assignment');
  END IF;
  RETURN proposed;
END $$;

CREATE FUNCTION civic_private.staff_lifecycle_approve(_approver uuid,_proposal uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE invite civic_private.staff_invitation_proposals%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM civic_private.staff_lifecycle_release
      WHERE singleton AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
    OR NOT civic_private.staff_operator_authorized(_approver)
    OR _proposal IS NULL THEN RETURN false; END IF;
  SELECT * INTO invite FROM civic_private.staff_invitation_proposals
    WHERE id=_proposal FOR UPDATE;
  IF NOT FOUND OR invite.status<>'pending' OR invite.approval_deadline<=now()
    OR invite.access_expires_at<=now() OR _approver=invite.proposed_by
    OR _approver=invite.user_id OR
    NOT civic_private.staff_operator_authorized(invite.proposed_by)
    OR NOT civic_private.staff_scope_reviewed(invite.role,invite.allowed_lga_ids)
    OR EXISTS(SELECT 1 FROM civic_private.staff_memberships
      WHERE user_id=invite.user_id)
  THEN RETURN false; END IF;
  -- Atomically approve, create the restricted membership and append audit.
  -- Any audit insert error rolls back the entire approval.
  INSERT INTO civic_private.staff_memberships(
    user_id,role,active,allowed_lga_ids,verified_office_id,
    expires_at,approved_by,approved_at
  ) VALUES (
    invite.user_id,invite.role,true,invite.allowed_lga_ids,NULL,
    invite.access_expires_at,_approver,now()
  );
  UPDATE civic_private.staff_invitation_proposals
    SET status='approved',approved_by=_approver,approved_at=now()
    WHERE id=_proposal;
  INSERT INTO civic_private.staff_lifecycle_audit(
    action,actor_id,target_id,proposal_id,new_role,reason
  ) VALUES('approved',_approver,invite.user_id,_proposal,invite.role,'approved_scope');
  RETURN true;
END $$;

CREATE FUNCTION civic_private.staff_lifecycle_revoke(
  _actor uuid,_target uuid,_reason text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE prior text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM civic_private.staff_lifecycle_release
      WHERE singleton AND enabled AND approved_at IS NOT NULL AND review_id IS NOT NULL)
    OR NOT civic_private.staff_operator_authorized(_actor)
    OR _target IS NULL OR _target=_actor
    OR _reason NOT IN('offboarding','security_incident','role_review')
  THEN RETURN false; END IF;
  SELECT role INTO prior FROM civic_private.staff_memberships
    WHERE user_id=_target AND active
      AND role IN ('case_manager','moderator','directory_reviewer','auditor')
    FOR UPDATE;
  IF prior IS NULL THEN RETURN false; END IF;
  UPDATE civic_private.staff_memberships
    SET active=false,expires_at=now(),updated_at=now()
    WHERE user_id=_target;
  INSERT INTO civic_private.staff_lifecycle_audit(
    action,actor_id,target_id,prior_role,reason
  ) VALUES('revoked',_actor,_target,prior,_reason);
  RETURN true;
END $$;

-- Functions are restricted to an isolated operator role only.
-- No direct staff table grants or live service binding are supplied.
REVOKE ALL ON FUNCTION civic_private.staff_operator_authorized(uuid) FROM PUBLIC,anon,authenticated,ekiti_admin_rpc;
REVOKE ALL ON FUNCTION civic_private.staff_scope_reviewed(text,text[]) FROM PUBLIC,anon,authenticated,ekiti_admin_rpc;
REVOKE ALL ON FUNCTION civic_private.staff_lifecycle_propose(uuid,uuid,text,text[],timestamptz) FROM PUBLIC,anon,authenticated,ekiti_admin_rpc;
REVOKE ALL ON FUNCTION civic_private.staff_lifecycle_approve(uuid,uuid) FROM PUBLIC,anon,authenticated,ekiti_admin_rpc;
REVOKE ALL ON FUNCTION civic_private.staff_lifecycle_revoke(uuid,uuid,text) FROM PUBLIC,anon,authenticated,ekiti_admin_rpc;
GRANT USAGE ON SCHEMA civic_private TO ekiti_staff_lifecycle_operator;
GRANT EXECUTE ON FUNCTION civic_private.staff_lifecycle_propose(uuid,uuid,text,text[],timestamptz) TO ekiti_staff_lifecycle_operator;
GRANT EXECUTE ON FUNCTION civic_private.staff_lifecycle_approve(uuid,uuid) TO ekiti_staff_lifecycle_operator;
GRANT EXECUTE ON FUNCTION civic_private.staff_lifecycle_revoke(uuid,uuid,text) TO ekiti_staff_lifecycle_operator;

-- Existing admin read gateway remains default-off and separate.
-- The operator role is NOLOGIN, with no DB/table write access. The first
-- platform administrator must be provisioned by an independently audited,
-- out-of-band operator process; this proposal cannot bootstrap one.
