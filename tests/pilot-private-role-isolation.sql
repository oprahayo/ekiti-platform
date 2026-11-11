-- Disposable CI only. Never run against production or a shared staging database.
-- This is an intentionally narrow joint-role proof, not release authorization.
DO $checks$
DECLARE public_access boolean;
BEGIN
  IF to_regclass('civic_private.reports') IS NULL
     OR to_regclass('civic_private.staff_memberships') IS NULL
     OR to_regclass('civic_private.admin_access_audit') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='civic_private' AND p.proname='accept_private_report'
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='civic_private' AND p.proname='admin_rpc_membership'
     ) THEN
    RAISE EXCEPTION 'Citizen and admin private proposals were not installed together';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='civic_private' AND c.relkind IN ('r','p')
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'Private tables must have enforced row-level security';
  END IF;

  IF has_schema_privilege('anon','civic_private','USAGE')
     OR has_schema_privilege('authenticated','civic_private','USAGE')
     OR has_table_privilege('anon','civic_private.reports','SELECT')
     OR has_table_privilege('authenticated','civic_private.reports','SELECT')
     OR has_table_privilege('ekiti_report_api','civic_private.staff_memberships','SELECT') THEN
    RAISE EXCEPTION 'Private schema or staff table exposed to public/citizen/report roles';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='civic_private'
      AND (has_function_privilege('anon',p.oid,'EXECUTE')
        OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
  ) THEN
    RAISE EXCEPTION 'A private function has an anonymous or authenticated EXECUTE grant';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='civic_private' AND p.proname LIKE 'admin_rpc_%'
      AND has_function_privilege('ekiti_report_api',p.oid,'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Citizen report gateway can execute an admin RPC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='civic_private'
      AND p.proname IN ('accept_private_report','track_private_report','purge_expired_private_reports')
      AND has_function_privilege('ekiti_admin_rpc',p.oid,'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Admin RPC can execute a citizen private-report API';
  END IF;

  RAISE NOTICE 'PASS: combined private proposal schema and citizen/admin role separation';
END
$checks$;
