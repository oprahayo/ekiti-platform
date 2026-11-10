# Private intake and tracking backend — Milestone 03

**Status:** Code implemented behind a **default-off safety gate**. The regular Cloudflare staging/production Worker still responds **404** to `POST /api/reports` and `POST /api/tracking`. The private PostgreSQL migration, dedicated login, policy approval, outbound messaging and any real submissions remain **not enabled**.

## Which deployment is affected?

Only `oprahayo/ekiti-platform` (Vite + Cloudflare Worker) is involved. This is not the separate Next.js EkiSignal demo. The existing `HYPERDRIVE` binding remains **read-only** and must never carry private case writes.

## Implemented

- `src/reporting/receipt-crypto.ts`: Generate a unique CSPRNG **256-bit receipt secret** and store only the SHA-256 digest in PostgreSQL. Validate exactly two tracking credentials: a public UUID reference and the private opaque secret.
- `src/reporting/private-case-store.ts`: Use only narrowly allowed PostgreSQL `SECURITY DEFINER` functions; atomic accepted-case event, verified geography, bounded retention, duplicate request refusal, and **return reference/secret only after COMMIT**. All failures roll back and strip SQL/narrative from errors.
- `src/server/private-report-routes.ts`: Server-side consent validation, independent rate limiting, origin and content-type checks, bounded UTF-8 request streaming, no-store responses, generic tracking failures, and a separate `REPORTING_HYPERDRIVE` binding.
- `src/server/worker.ts`: Routes are registered but **fail with 404** unless `REPORTING_ENABLED` is *exactly* `true`; absent a separate DB binding, rate limit, policy or valid retention they refuse intake with 503.
- `db/proposals/0004_reporting_private.sql`: earlier proposed private tables, RLS forced, **not approved or installed**.
- `db/proposals/0006_private_gateway.sql`: new **unapplied proposal** with explicit operator gates, NOLOGIN roles, RLS policies for a NOLOGIN function owner, approved geography checks, restricted SECURITY DEFINER insert/tracking functions, and a separate expired-record purger. No live credentials or live-role membership granted.
- `tests/private-report-api.test.mjs`: Simulated successful commit, rollback, idempotency conflict, wrong location, guessing a secret, disclosure prevention, missing credentials, throttling, cross-origin calls and unavailable feature. The tests use synthetic records and a fake database.

## Private API contract (not enabled)

`POST /api/reports` expects a JSON report with `kind`, `description`, `lgaId`, optional `wardId`, optional `place`, a UUIDv4 `clientRequestId`, `consent=true`, and exactly the **approved** `consentPolicyVersion`. Sensitive extra fields, direct GPS coordinates, email, phone and raw attachments are rejected.

A successful, **committed** private intake would return a UUID `reference`, a **one-time returned secret** and explicit `governmentAcknowledged=false`, `publicationStatus=private_pending_moderation`. The secret cannot be regenerated from the reference or retrieved from the database. A duplicate retry yields a conflict, not another secret. For a public-facing launch, delivery/recovery must be designed before allowing this endpoint.

`POST /api/tracking` expects `{ "reference": "<uuid>", "secret": "<64-lowercase-hex>" }` in the POST body. It returns **only** case events recorded by the independent platform (`intake_accepted`, `under_review`, `needs_information`, `closed`) and `governmentAcknowledged=false`, `publicMapStatus=not_published`. It never returns report narrative, contact details, precise location, media or raw secret. Invalid secret/reference combinations are indistinguishable from missing reports.

**Important:** This is NOT a public submission system, an email/SMS notifier, a government dispatch or a public reports map feed. The guided frontend remains a private draft. No government offices are integrated.

## Why email/SMS and live map are still gated

The user journey requires a **private tracking link sent by email or SMS, not a downloaded receipt**. That cannot safely be launched from this milestone because the consent policy, verified contact ownership, encrypted short-retention contact vault, notification provider, retry/outbox, sender identity, deletion controls, and one-time claim-link redemption do not exist. A public reference is deliberately insufficient for access. It is unsafe to put permanent bearer tracking secrets in links or analytics. A future notification should carry a separately issued **short-lived, single-use claim token** and establish a protected tracking session after use, with validated contact possession. Do not claim delivery without provider evidence.

Likewise, the public Ekiti map must show **only moderated, redacted publication records**, with coarse position and *verified* office response evidence. Private narratives, faces, camera EXIF, exact GPS, contact details and anonymous case identity must never be copied automatically. The public reader has no case table or case feed yet.

## Deployment prerequisites — manual approval required

1. Approve the operating entity, legal/privacy/consent policy, categories for sensitive complaints, a retention schedule, deletion/appeal operations, emergency disclaimer, and authorized moderator team.
2. Provision a **separate disposable private staging PostgreSQL database** with reviewed geography and evaluate proposals `0004` and `0006` **there**, with operator-approved transaction flags. They are not in `db/migrations` and normal staging scripts never apply them. Test the definer function ownership, RLS, idempotency, role permissions, ward/LGA consistency and actual database rollback.
3. Independently create a dedicated **REPORTING_HYPERDRIVE** login with only `ekiti_report_api` membership. Never grant access to `ekiti_location_reader`, `anon`, `authenticated`, or the public directory role. Keep SQL EXECUTE restricted.
4. Add a **separate REPORTING_LIMIT** Cloudflare limiter, approved `REPORTING_POLICY_VERSION` and approved `REPORTING_RETENTION_DAYS` (1–365). Do not set `REPORTING_ENABLED=true` until after security tests, functional receipt notifications, approved privacy controls and the operator's explicit authorization.
5. Schedule and monitor `civic_private.purge_expired_private_reports()` with its **separate** maintenance role. Check backups, log retention, failed deletes, abuse attempts and revocations.
6. Add verified email/SMS contact and claim-link delivery, trusted moderation/office identity, safe public-case projection and full cross-device acceptance/acknowledgement tests using synthetic cases.

## Developer verification

```bash
npm run test:all
npm run staging:check
```

The existing local staging deployment procedure remains unchanged. Deploying this code before activation must leave public reporting and tracking **disabled**. No real case ID or tracking URL may be shown by the front end until private database acceptance and notifications are demonstrably live.
