-- ISOLATED POSTGIS CI database only; refuse accidental use elsewhere.
-- The gated file contains its own BEGIN/COMMIT and is never in deployment.
BEGIN;
SET LOCAL ekiti.admin_repository_approved='yes';
\i db/proposals/0007_admin_repository.sql
