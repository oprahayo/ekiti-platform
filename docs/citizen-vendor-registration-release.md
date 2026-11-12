# Citizen registration and directory listing vertical slice — release handoff

**Scope:** Search-first homepage + personal citizen/vendor dashboard + private listing drafts and authenticated moderation-submission RPC proposal.

## Verified implementation in this branch
- Homepage directs search queries into reviewed Ekiti directory filters, rather than a static card/link.
- A guest can enter a business/service name, select one of 16 verified LGA labels, choose a service category, describe the service, preview, save/reopen/delete a **browser-tab-only** draft.
- Personal profile hosts My Listings workspace: local draft counts, statuses of server-confirmed moderated submissions when configured, and permitted withdrawal. Other existing report history, saved places, reviews and claims remain unchanged.
- Auth server client already supports Supabase passwordless email-code signup/recovery; this branch adds typed guarded authenticated directory RPC operations. It never adds browser-accessible service-role secrets or local-password authentication.
- Proposal `db/proposals/0015_directory_submissions.sql` creates a private **unpublished** author-owned submission queue and secure RPCs `civic_submit_directory_listing`, `civic_my_directory_submissions`, `civic_withdraw_directory_submission`. It requires an explicitly gated migration and independently moderated publication.
- Browser and disposable PostGIS tests have been added. Confirm their actual CI results before marking this deployable.

## What a deployment of this code does today
**Guest-only staging:** functional reviewed-directory search and browser-tab listing drafts/dashboard. The existing `scripts/deploy-integration-staging.sh` deliberately sets `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` to empty and never deploys the private SQL. Therefore users **cannot register real accounts or submit a public business listing** on that staging release. The submission UI reports that limitation instead of fabricating a confirmation.

## Separate opt-in launch of real registration and submissions
1. Connect/verify the existing Supabase project (currently known project reference `tmifxomfsbatgshgwjpb`) and its **public publishable** key. Never expose `service_role` or private database passwords to Vite, GitHub source or chat.
2. Approve inEkiti Official's legally responsible data controller, contact, versioned privacy notice, retention/deletion policy, abuse controls, directory moderation staff and opt-in terms for stored email and business descriptions.
3. Configure **Supabase Auth** verified email-code OTP (avoid email magic-link-only template if the UI asks for numeric code); allowlisted redirects and adequate email delivery quotas; test registration, passwordless sign-in, logout, session expiry and recovery on real devices.
4. Run proposal migration in an isolated staging database **only after approved**, verify audit/RLS grants and production policy review. The proposal has no public-publication path and must not make unverified businesses searchable.
5. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` plus `VITE_DIRECTORY_SUBMISSIONS_ENABLED=true` **only for a dedicated reviewed auth pilot**. Do not bypass the guest-only integration script's explicit fail-safe overrides; publish on a separate restricted, carefully named pilot target until all conditions pass.
6. Deploy restricted moderation workflow to allow a verified reviewer to inspect and approve/reject with logged source provenance and explicit safe publication into `civic.places`. Test owner-specific lists and revocation. Do not let a user's pending listing appear publicly.
7. Confirm live smoke tests, rollback switches, privacy request deletion workflow and correct build manifest before giving users an activation announcement.

## Role separation
- Citizen/vendor dashboard: optional verified personal account; saved places, draft reports, authored listings/reviews/claims.
- inEkiti operator dashboard: independently authenticated MFA staff, moderation/triage with auditable actions.
- Government agency dashboard: **separate** verified per-office identity, restricted geography and incident access, real message receipt/read events; no unauthenticated agency accounts, and no private evidence on public maps.

Refs: operational activation #42; product scope #44; agency dashboard #47; preliminary private SQL compatibility PR #43. This handoff is documentation, not a claim of running signup services.
