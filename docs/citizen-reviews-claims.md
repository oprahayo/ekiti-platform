# Citizen accounts, business claims and moderated reviews — milestone 06

**Status:** Code and guarded SQL proposal; **not active on Cloudflare staging or live Supabase**. UI continues to support guests and offline private drafts. No automatic identity verification or review publishing is implied.

## Working architecture

- **Citizen sign-in:** optional Supabase Auth email OTP (6-digit code); the signup dialog appears only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured in a trusted build. Email goes directly to the configured Supabase project's Auth service only after an explicit user request. No passwords, Nigerian NIN, passports, national IDs, phone numbers, location or face photos are collected by this UI.
- **Security:** Supabase Auth validates user identity and signs access JWTs. Authenticated reviews, claims and own-account activity use the project's **PostgREST `public.civic_*` RPCs**; the current Cloudflare Worker keeps the existing read-only Hyperdrive role and never gains data-writing permissions. Authentication credentials are not sent to the app's general Ask endpoint.
- **Session:** access + refresh tokens are kept in browser **sessionStorage, scoped to this tab**, checked against `/auth/v1/user`, refreshed as necessary and cleared on logout or failed verification. Session storage is script-readable and is not equivalent to an HttpOnly cookie; enforce CSP, dependency audits and script hygiene. Closing the browser tab will usually clear the session, but browsers may restore a tab.
- **Reviews:** users can continue saving private local drafts. With a configured verified email session, a review can be submitted to a **pending moderation queue** (one review per account per published listing; re-editing returns it to pending). The public `GET /api/places/:uuid/reviews` endpoint exposes only moderator-published text, dates, star scores and a computed aggregate. No author email/id, pending text, claimed ownership proof or moderator notes are exposed.
- **Claims:** a signed-in user may submit a 30–700 character claim explanation about a published, currently unclaimed business. The request remains private and pending until independent verification; it does not grant ownership or access to manage the listing. **Do not upload identity documents here.**
- **Profile:** connected accounts can view their own private review and claim statuses, while guests see locally saved places and unpublished drafts. Email verification is **not** proof of Ekiti residency or real-world business ownership.
- **About & Contact:** stays a native pop-up, not a separate screen. Project affiliation remains explicitly independent.

## Database proposal

`db/proposals/0005_citizen_reviews_claims.sql` adds:
- `civic.reviews` and `civic.claim_intents`, with author IDs referencing Supabase `auth.users`, RLS and no direct table privileges for anonymous or authenticated clients.
- `civic.public_reviews` and `civic.public_rating_summary` read gateways for the existing `ekiti_location_reader`, filtered by reviewed publisher, published listing and moderated review status.
- `public.civic_submit_review`, `public.civic_request_claim`, `public.civic_my_reviews`, `public.civic_my_claims` callable by the **authenticated** Supabase PostgREST role only. All use `auth.uid()`, not a caller-supplied user ID.
- No photo uploads, ownership grants, email records or real report integration.

**Not a migration:** The SQL must not be applied automatically. It deliberately fails unless a privileged operator first starts a transaction and sets `SET LOCAL ekiti.citizen_policy_approved='yes';` after approval. GitHub CI has its own disposable test-only auth schema and explicit opt-in, never a live database credential.

## Activation checklist — approval required

1. Approve and publish privacy/retention/deletion policy for email-based accounts, review content and ownership explanations; define moderation and appeal/correction responsibilities.
2. Configure Supabase Auth email OTP with a proper six-digit `{{ .Token }}` email template, verified email delivery (within Free limits), allowed site origins, rate limits and abuse protections. Do not enable SMS/KYC by default.
3. Review the proposal, backup staging, run the opt-in SQL in the **staging** project through a privileged migration operator, and test raw table isolation with the authenticated and anonymous roles.
4. Set **public** build variables `VITE_SUPABASE_URL` to the HTTPS hosted project URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to a project publishable key. Never put a service_role, `sb_secret_`, database connection string or JWT signing secret into Vite variables, Git, the client or browser console.
5. Test OTP delivery and session refresh on iPhone/Android; verify submitted reviews stay **pending**, unsigned guests cannot send reviews/claims, public ratings are calculated only from moderator-published entries, and a reviewed claim is processed only through an approved admin process.
6. Deploy only after approval, smoke-test HTTPS staging, review CSP against script injection and the browser storage threat model, then separately approve production.

## Local checks

```sh
npm ci
npm run test:all
npm run staging:check
npm run test:browser
```

CI additionally bootstraps disposable Supabase-like Auth roles (test fixtures only), tests the SQL proposal in isolated PostGIS, verifies pending item privacy and cross-account access, and runs the existing reporting/geographic regression suite.

The platform is still zero paid-AI-API; Supabase and Cloudflare Free tiers have strict limits. Review moderation, email OTP delivery and owner verification need real operational staffing; do not call these workflows autonomous or unlimited.
