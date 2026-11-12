# Sprint 12 — Admin identity, MFA boundaries and restricted staff lifecycle

**Status: stacked draft source and a guarded SQL proposal. Not installed, not deployed, no real invitations, no staff created.** This work deliberately extends the previously completed **admin branch stack**:

1. PR #19 `feat/admin-operations-console` — fictional staff workspace, isolated admin-security primitives
2. PR #20 `feat/admin-private-gateway` — standalone **default-off** gateway, restricted repository
3. PR #27 `feat/admin-staff-auth-readonly` — invite-only Supabase Auth TOTP/AAL2 sign-in, in-memory JWT, approved read-only staff UI
4. **Sprint 12**, `feat/sprint-12-admin-identity-lifecycle` — dual-control invitations, scope review, automatic expiry/revocation and audit

**This branch does not descend from Sprint 11 PR #36.** The public-citizen stack is a separate draft chain, and both contain conflicting historical private SQL proposal numbers and partially diverged private schema. Do not merge them together or deploy any admin proposal until a separate, independently reviewed schema reconciliation is completed.

## Existing admin identity controls reused

- The private Staff UI already signs in with password and verified TOTP, obtaining `aal2`. It keeps tokens in process memory and only contacts the isolated `/admin/api/me` after MFA.
- The independent admin gateway already validates issuer-pinned asymmetrically signed JWTs and short expiry, checks an active server-backed membership on **every** request, and enforces role and LGA restrictions for every case read and audit operation. It does not trust roles in the JWT or in client metadata.
- The public citizen Worker still answers 404 to admin routes. No deployment or identity provider is connected.
- The existing project refuses to treat platform actions as government office acknowledgements, and staff without scope cannot read private cases.

## New proposal — two-person, reviewed LGA staff onboarding

`db/proposals/admin_0008_staff_lifecycle.sql` is a **proposal**, not an automatic migration. It fails installation unless a privileged disposable transaction explicitly sets `ekiti.staff_lifecycle_reviewed=yes`. An additional independently controlled, initially **disabled** `civic_private.staff_lifecycle_release` gate requires a privileged operator review ID and approval timestamp. The NOLOGIN operator role cannot change the release table.

After a reviewed external staff onboarding procedure has independently verified operator identity and MFA, a privileged service may use the following tightly scoped functions. They are **not HTTP endpoints** and are **not callable by the citizen browser, the existing admin API credential, or Supabase authenticated/anonymous roles**.

- `civic_private.staff_lifecycle_propose(actor,target,role,lgas,expiry)`: a separately approved and currently active platform administrator proposes a **pending** assignment for a known existing Supabase Auth user. Allowed roles are `case_manager`, `moderator`, `directory_reviewer`, `auditor`. The role must have independently **verified Ekiti LGAs** (unless auditor, whose LGA list must be empty); duplicate, unknown and unverified LGAs fail. A proposal is not a grant. Duration must exceed 1 hour and cannot exceed 90 days. Existing memberships cannot be overwritten or silently escalated.
- `civic_private.staff_lifecycle_approve(second_admin,proposal)`: a **different** independently approved active platform administrator must approve the still-pending proposal within 24 hours. The second person cannot be its proposer or target. A transactional row lock, current LGA revalidation, current proposer revalidation and new membership uniqueness protect the grant. The membership remains bound to the original approved scope and expiry.
- `civic_private.staff_lifecycle_revoke(admin,target,reason)`: an independent platform administrator immediately sets a lower-privileged membership to inactive with an expired timestamp. Supported reasons are `offboarding`, `security_incident`, `role_review`. The next independent gateway membership lookup will refuse access, even if the former staff member still possesses a previously issued, otherwise valid short-lived JWT.

All proposal, approval and revocation events create minimal audit entries with actor ID, target ID, allowed action/reason, and timestamp. Approval and audit insertion occur atomically: if audit fails, no active membership can be committed. Raw case details, tracking secrets, email, phone and GPS are not copied to the audit.

**Explicit exclusions:** creating the first trusted platform administrator, elevating to platform admin, assigning any government officer, new live office verification, public staff self-signup, email invite delivery, MFA reset/recovery, active staff editing, and live admin endpoint activation. Those require separate operator/legal reviews and dedicated identity operations; a valid email or AAL2 JWT alone cannot bootstrap staff privileges. The functions accept UUIDs from a **trusted offline caller** only: UUIDs do not authenticate a user, so exposing these functions behind a browser API would be unsafe.

## Tests and audit boundaries

`tests/admin-staff-lifecycle-postgis.mjs` is run after the existing `0004`, `0006_admin_private`, and `0007_admin_repository` proposals have been installed **only on disposable CI PostGIS**. It uses an explicit review setting and rolls back all lifecycle changes. Tests verify:

- The proposal refuses ungated execution and the installed release switch remains disabled.
- Public visitors, Supabase authenticated users and the already-existing `ekiti_admin_rpc` have no permission to create/approve/revoke staff or read lifecycle tables.
- Only verified LGAs and non-privileged roles can be proposed; no self-approval, duplicated scope, overlong grant or overwrite.
- Two distinct approved administrators must authorize the same pending request.
- Revocation invalidates the next independently scoped read; platform-admin revocation is unavailable in this ordinary workflow.
- A forced audit failure rolls back the attempted membership grant in the same database transaction.

The existing `npm run test:all`, independent PostGIS repository tests, `npm run build:admin`, public-citizen browser tests and admin Playwright tests stay in CI.

## Why main and your staging Worker do not show Sprint 12

`git switch main && git pull --ff-only origin main` fetches **only merged work**, not this or other draft sprint branches. Your `wrangler deploy` command then deploys the stale `main` source. More importantly, **Sprint 12 is admin-only backend source**; it cannot visibly enable staff or cause a new citizen homepage without explicit authorization. No source-only draft branch is a new deployment.

To **review admin source locally without deploying**:

```bash
cd ~/ekiti-platform
git fetch origin
git switch --track origin/feat/sprint-12-admin-identity-lifecycle
# If the local tracking branch already exists:
# git switch feat/sprint-12-admin-identity-lifecycle
npm ci
npm run test:all
npm run build:admin
npm run dev:admin
```

`dev:admin` serves the existing isolated **fictional administrative demo**. It does **not** turn on an authenticated private staff workspace, provision real users or show private cases. Live private mode requires a reviewed HTTPS identity provider, configured Supabase Auth, verified MFA, separate gateway and database approval that are intentionally unavailable. **Do not set `VITE_ADMIN_MODE=private` simply to bypass release checks.**

For the **citizen** sprint work through Sprint 11, switch instead to `feat/sprint-11-private-case-timeline`; its distinct branch contains the citizen features but live secure report functions remain default-off.

## Later release gates

Before any merge or deployment: reconcile the admin and citizen schema proposals; validate the exact production PostgreSQL RLS/owner privileges, independently provision real staff identities with verified MFA, deploy a separate protected operator identity and trustworthy audit chain, plan a documented break-glass/recovery procedure, enforce invitation notifications and expiration, and test account suspension/revocation against actual JWKS and Supabase sessions. Never grant `ekiti_staff_lifecycle_operator` to the existing admin API connection, citizen service or any untrusted browser path.

**Next:** Sprint 13 — Admin permissions and office/LGA authorization integration. Keep real office acknowledgement closed until verified government-office registry and signed dispatch evidence exist.
