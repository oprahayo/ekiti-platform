-- Disposable PostGIS/Supabase-emulation CI only.
BEGIN;
SET LOCAL ekiti.directory_policy_approved = 'yes';
\i db/proposals/0015_directory_submissions.sql
COMMIT;
