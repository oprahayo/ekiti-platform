# Sprint 05 — secure private incident intake (source-only gates, no launch)

**Status: implementation proposal. Not merged, not deployed, not authorized to accept real reports.**
Stacked after Sprint 04, which itself depends on draft Sprint 03. The live Cloudflare Worker must continue returning `404` for `POST /api/reports` and `POST /api/tracking` without an explicit operator-approved release.

## Existing foundations from previous milestones

- `src/reporting/intake-contract.ts` rejects unexpected properties, contact, raw GPS, unapproved/mismatched consent policy, oversized descriptions, invalid typed locations and request IDs.
- `src/reporting/private-case-store.ts` uses a dedicated, separate PostgreSQL writer, calls a restricted SECURITY DEFINER routine, validates geographic linkage in SQL and issues a real reference + random 256-bit receipt secret **only after COMMIT**. The raw secret never enters SQL; only its digest can be stored.
- The same committed report can be accessed from another device **only when its reference and private receipt secret are supplied together to POST /api/tracking**. No tracking secret belongs in a URL, cookies, analytics or logs. Tracking returns a limited platform timeline with no narrative, contact, exact location or receipt secret.
- Request UUIDs are database-unique. A retried request with a previously committed UUID must receive a safe `409`, **not a second receipt nor a fabricated replacement secret**. A connection lost after COMMIT can leave the user unable to retrieve the one-time secret: an approved recovery design is required before live intake.
- The existing SQL proposals, PostGIS RLS tests and signed-off moderation are not deployed to production.

## Changes in this sprint

### Independent release lock

`src/reporting/intake-release.ts` now assesses all prerequisites. The backend still refuses intake with `404` unless `REPORTING_ENABLED === 'true'`. Even if this first flag is set accidentally, the handler rejects with `503` until **all** of the following settings are present and valid:

- `REPORTING_BOUND_ORIGIN`: a single canonical HTTPS origin with no path/query/user info.
- `REPORTING_OPERATOR_ID` and `REPORTING_RELEASE_APPROVAL_ID`: operator and reviewed release identifiers.
- `REPORTING_RETENTION_JOB_VERIFIED === 'true'`: explicit claim that an actual automatic deletion and recovery process has been independently verified.
- `REPORTING_POLICY_VERSION`: an approved and published consent notice version.
- `REPORTING_RETENTION_DAYS`: an integer from 1 through 365, backed by a real, verified deletion workflow.
- `REPORTING_HYPERDRIVE`: dedicated restricted private connection.
- **Two independently provisioned quotas** `REPORTING_LIMIT` and `REPORTING_TRACK_LIMIT`; they must not be the same binding.

**These flags are checkable prerequisites, not proof of compliance.** None have been approved or configured on the deployed environment. In particular the retention-job confirmation must **not** be set to true until actual deletion is demonstrably operational.

### Bound browser requests and anti-abuse

The proposed handler accepts POST only from the exact pinned HTTPS origin and requires a matching `Origin` header. It rejects `Sec-Fetch-Site` values other than `same-origin` (or omitted), unexpected methods and any query/hash token. Separate rate-limit bindings and namespaced keys (`intake:` and `tracking:`) prevent repeated tracking guesses from draining the intake quota. Request bodies remain small and strictly decoded. Both routes use `no-store`, `no-referrer`, `nosniff` and noindex response headers. Origin checks are defense in depth, not authentication; the private secret protects tracking.

### Public interface remains inactive

No new citizen Submit button, claim link, live report number, government routing, evidence upload, public map projection, email/SMS message, or server collection was switched on. The resident can continue the existing private draft flow, and the unconfigured Worker keeps responding 404.

## Verification

- `tests/sprint-05-intake-gates.test.mjs`: every absent governance/binding switch denies access before any DB connection, origin/host mismatch blocks, incorrect safety flags fail, rate limits are independent and do not key on private content.
- `tests/private-report-api.test.mjs`: existing atomic acceptance/rollback/duplicate/geography/private timeline tests updated to use explicit **test-only** release configuration.
- `tests/browser/sprint-05-intake-offline.spec.ts`: citizen draft completion does not POST an incident or mint a reference; both supposed private endpoints return 404 under the normal unconfigured Worker.
- Existing disposable PostGIS transaction/RLS tests and unrelated directory/homepage/browser regressions must remain green.

## Cannot release until Sprint 04 decisions are approved and proven

1. Identify and legally verify the actual independent operator/controller, contact details and public privacy notice under relevant applicable law; approve separate live-server processing consent language.
2. Implement, audit and **actually test** retention/deletion of records, case events, backups, attachments, tracking digests and relevant request metadata. A schema `delete_at` field or toggled config flag alone is insufficient.
3. Establish trained authorized moderators, sensitive-case redaction, child and retaliation safety handling, correction/deletion rights and secure reporting abuse response.
4. Review the private schema/roles and migrations against existing main/admin proposal numbering and prove no public read access. Apply only to explicitly approved isolated staging first.
5. Provide a trustworthy one-time receipt recovery or lost-response procedure with appropriate privacy guarantees. Do not misrepresent a `409` idempotency response as recovery.
6. Explicitly approve a narrow deployment plan with independent secrets and rate-limit resources, negative security tests, rollback and post-deploy smoke tests.

Until then: **do not set any live release flags, import the SQL into production, merge to main or deploy Cloudflare**. No public report is accepted by this source-only sprint.
