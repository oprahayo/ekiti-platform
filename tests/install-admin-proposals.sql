-- Disposable CI database only. Do not reuse against any connected project.
-- Each gated proposal contains its own terminating COMMIT.
BEGIN;
SET LOCAL ekiti.report_policy_approved = 'yes';
\i db/proposals/0004_reporting_private.sql

BEGIN;
SET LOCAL ekiti.admin_policy_approved = 'yes';
\i db/proposals/0006_admin_private.sql
