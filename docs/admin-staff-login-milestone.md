# Admin milestone C — invite-only MFA client and private read-only workspace

**Branch:** `feat/admin-staff-auth-readonly` → depends on draft `feat/admin-private-gateway` (PR #20) → depends on draft Admin UI PR #19.

**Status:** Source implementation and synthetic tests only. **Not deployed. No invitation was sent, no credentials or secrets installed, no SQL applied, no production data viewed.**

## What this milestone adds

- `admin/src/staff-auth.ts` uses the approved HTTPS Supabase Auth issuer with a **public/publishable browser key** for email/password sign-in and an already-enrolled **verified TOTP** factor.
- AAL1 sign-in alone does not grant staff access. The client requests a factor challenge, verifies a six-digit code and requires an AAL2 token before contacting the isolated admin service. The **server** still validates JWT issuer, JWKS signature, expiration, MFA, independent membership and LGA/role restrictions.
- The client checks `GET /admin/api/me` before rendering any private record. A user with valid Supabase credentials but without separately approved staff membership cannot proceed.
- In-memory access tokens only: no localStorage, sessionStorage, cookies, URLs, refresh tokens, analytics or persistence across reloads. Sign-out clears memory even when a remote logout call fails. Short sessions require sign-in again.
- Separate authenticated shell with Cases, Moderation, Routing and Overview tabs, responsive at narrow widths. Cases shows **only the private gateway's allowlisted metadata** and **authorized internal event history**. It does not show narratives, contact details, exact GPS, citizen tracking secrets or media. It does not enable assignment, notes, external government actions or publication.
- Moderation and Routing remain explicitly unavailable until independently reviewed APIs and verified office identities exist. Overview counts only the current authorized page (maximum 20 records), **not** state-wide real-time totals.
- Browser build is **demo-only by default**. The authenticated variant requires an explicitly selected `VITE_ADMIN_MODE=private`; in that mode missing/untrusted configuration **fails closed** and never mounts fictional demo cases.

## Dedicated private build configuration — not yet a deployment recipe

The following values are needed only when a separate, approved staff origin is operated:

```text
VITE_ADMIN_MODE=private
VITE_STAFF_AUTH_URL=https://YOUR-APPROVED-AUTH-ISSUER/auth/v1
VITE_STAFF_PUBLISHABLE_KEY=YOUR-PUBLIC-SUPABASE-PUBLISHABLE-KEY
```

Only the **public/publishable** client key may be present in the frontend build. Never place a service-role key, restricted database URL, worker secret, staff registry credential or JWT signing secret in any Vite variable. The static administrative UI and admin API must be hosted at the **same dedicated HTTPS origin**; the private gateway does not support cross-origin credentialed API calls.

This source does not provision the identity provider, activate the Worker or establish staff memberships. The server-side `ADMIN_API_ENABLED`, `ADMIN_PRIVATE_HYPERDRIVE`, issuer, audience and independent rate limiters are **not** configured here.

## Security and operations gates remaining

1. Confirm the final operator, consent and retention/deletion policy, emergency handling limits and live case legal basis.
2. Complete **invite-only staff provisioning** with an independently approved membership/approval/revocation workflow. Supabase signup is not the grant of staff authority.
3. Configure asymmetric JWT signing (ES256 or RS256), verified issuer JWKS, MFA enrollment/recovery, disabled-account handling and token revocation verification. The existing gateway deliberately rejects symmetric/unsigned/weak tokens.
4. Review least-privilege SQL function owners and production RLS/BYPASSRLS behavior. SQL proposals `0004_reporting_private.sql`, `0006_admin_private.sql`, `0007_admin_repository.sql` on the Admin branch and the newer `0006_private_gateway.sql` on `main` need a **schema reconciliation** before any staging application. Never assume both proposals have been applied.
5. Rebase/merge dependent Admin PRs after reviewing the six merged citizen PRs (#21–#26). The Admin gateway and public-private intake proposals were developed on different branches.
6. Run independent browser tests against a dedicated HTTPS admin origin, mock MFA and no-permission cases, revocation and timeout tests; verify mobile accessibility, CSP and security headers. Then separately authorize staging migration and private Worker deployment.

## Validation

New unit regression suite: `node --experimental-strip-types --test tests/admin-staff-auth.test.mjs`. It is also included in `npm run test:all` via the existing glob. Existing `npm run check:admin`, `npm run build:admin`, private PostGIS tests and demo Playwright suites are unchanged.

**No live case intake, SMS/email notification, official forwarding, public map publication, or Cloudflare deployment is authorized by this work.**
