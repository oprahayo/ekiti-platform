-- Disposable CI ONLY. This opt-in is never used in deployment scripts.
BEGIN;
SET LOCAL ekiti.citizen_policy_approved = 'yes';
\i db/proposals/0005_citizen_reviews_claims.sql
COMMIT;
