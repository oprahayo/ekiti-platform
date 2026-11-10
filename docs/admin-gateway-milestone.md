# Administrative milestone — gated private API candidate

**Branch:** `feat/admin-private-gateway` (stacked on draft admin UI PR #19). **Never deployed.**

## Implemented

`src/server/admin-gateway.ts` exports a standalone `createAdminGateway()` request handler. The existing public Worker **never imports or mounts it** and still answers 404 for `/api/admin/*` and `/admin/api/*`.

The new API offers a genuinely testable security boundary (using disposable, generated JWT signing keys and a fake private repository in CI). It requires a feature gate plus **all** independent dependencies before it returns any case information:

- Pinned HTTPS admin origin and strict same-origin writes; no cookie auth, CORS sharing or tokens in URLs.
- Valid issuer-signed, scoped, short-lived AAL2 JWT; server-fetched active staff membership. No browser-provided roles or privilege claims.
- Per-identity rate limiting through a required edge/service limiter, separate from public location limits.
- `GET /admin/api/me`: role and authorized area metadata only.
- `GET /admin/api/cases?lga=...&limit=1..25`: narrowly bounded metadata list, filtered by independent staff LGA grants, with **second-pass enforcement** even if the repository returns an unauthorized row. Every repository read receives the verified actor UUID, and its database implementation must perform a second, independent staff-membership/LGA check rather than trusting web-supplied scopes.
- `GET /admin/api/cases/:uuid`: case metadata, only for authorized members and areas; unauthorized case IDs return the same 404 as nonexistent ones.
- `GET /admin/api/cases/:uuid/events`: up to 50 platform events, excluding private report narratives, GPS, contact information and tracking secrets; access logged through a required audit hook.
- `POST /admin/api/cases/:uuid/notes`: strictly bounded (1.5 KB) note with version check and UUIDv4 idempotency ID. The private repository contract requires **a single transaction** covering revision check, note event creation, audit entry and replay lookup. Only internal platform notes are possible; there are no government delivery, receipt, viewed or response endpoints.
- Explicit allowlisting of every returned field. Database errors return a generic 503 with no private content; rate limiting and policy failures use generic structured responses.

## Deliberate limits

This is a **working, isolated handler with tests**, not a launch-ready staff system. No approved private repository or production staff invitation process has been connected. The SQL proposal for anonymous citizen reports is gated on unresolved data-protection and retention decisions. There is no verified government-office registry; this API cannot dispatch or imply official handling.

The handler does not accept phone numbers, citizen identity, precise coordinates, private bearer tracking secrets, photos or narrative text. The current in-memory UI continues to use fictional `DEMO-` cases, independently of these candidate routes.

### Required before production or public staging

1. Approve privacy purpose, exact independent operator, lawful basis, data minimization, disclosure and automatic deletion/withdrawal workflow.
2. Review and implement the **private, role-scoped database repository** with least-privilege credentials separate from the location reader. Enforce permitted LGAs in SQL, reject suspended staff, and execute note and audit operations atomically.
3. Provision invite-only staff registration and an independently controlled AAL2/MFA identity provider with a pinned JWKS resolver, rotation and revocation.
4. Adopt explicit activity/audit retention, logging exclusions, rate limits, backups and kill switch; verify revocations and JWT rotation.
5. Implement stable cursor pagination and localized triage status definitions, with office routing based on verified directory evidence.
6. Test database transactions, concurrency, 409 conflict handling and idempotent retries against disposable Postgres before any gated staging migration.
7. Only then plan a separate admin Worker origin and permission-checked UI integration; never expose privileged service tokens in Vite variables.

## Validation

```bash
npm run test:all
npm run build:admin
npm run test:admin:browser
```

Run the isolated gateway contract tests with:
```bash
node --experimental-strip-types --test tests/admin-gateway.test.mjs
```

All persistence in current gateway tests is in an ephemeral in-memory repository and never enters Supabase.


## Database proposal (not a migration)

`db/proposals/0006_admin_private.sql` documents disabled-by-default staff memberships, role/approval constraints, private read-audit metadata, UUID-backed internal event IDs, revision-controlled notes and idempotency markers. It refuses to run without an explicit review gate, **grants nothing to the public or current location-reader roles**, and is not loaded by any production deployment. In CI only, `tests/install-admin-proposals.sql` deliberately applies both private proposals to the disposable PostGIS database to check forced RLS and default-deny privileges; all test staff data is rolled back.

The proposal does **not** yet create a privileged repository RPC or grant an admin login access. Server-side SQL must independently verify staff identity, membership status and authorized LGAs for every read/write; a separate database authorization and retention review is a hard launch gate.
