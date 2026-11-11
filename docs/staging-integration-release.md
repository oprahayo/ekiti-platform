# Ekiti integrated staging preview — Citizen Sprints 03–11 and Admin Sprint 12

**Branch:** `integration/staging-citizen-admin-sprints-03-12` (source-only; not `main`).

This integrates the complete **citizen draft stack** (PRs #28–36, Sprints 03–11) with the complete **isolated admin draft stack** (PRs #19, #20, #27, #37, including Sprint 12). The merge commit preserves both parent histories without overwriting citizen backend/worker code with the admin fork.

## What can safely appear at staging

1. **Citizen preview:** latest homepage and conversation/report-draft UI, privacy/safeguarding copy, manual incident-LGA selection, optional verified location suggestion, Explore category search, My Reports guest-only explanation, and the one-time claim UI's **explicit disabled** state. Existing Ask English/Yoruba, public directory and verified PostGIS resolver continue to operate. No private incident is submitted to an office.
2. **Admin preview:** the existing fictional-only, local-data administrative dashboard, published separately as a **static assets-only** Worker named `ekiti-admin-demo-staging`. It contains no real cases, password/MFA provider, citizen data, administrative API, Supabase bindings or staff credentials. All actions remain synthetic and labelled as examples.
3. **Backend source retained but NOT activated:** signed staff JWT/MFA gateway, dual-approval staff proposals, private report receipts, private evidence, citizen OTP, account-bound report claims, provider-independent SMS/email delivery interfaces, private case timelines and reviewed GPS directory search. These cannot operate solely from publishing a frontend; the requisite approved roles/tables/data/providers/release switches are deliberately absent.

**Do not equate a successful preview deployment with approved citizen intake, emergency response, private contact collection, office delivery or government acknowledgement.**

## Why the old `main` commands did not update anything

`git switch main && git pull --ff-only origin main` checks out only **merged** code. All the recent sprint work was stored in draft PRs, so the old deploy command simply rebuilt the original `main`. This integration branch explicitly includes both draft histories; it does not itself merge `main` or remove the original drafts.

## Operator deployment (from the computer with your Cloudflare Wrangler login)

```bash
cd ~/ekiti-platform
git fetch origin
git switch integration/staging-citizen-admin-sprints-03-12 2>/dev/null || \
  git switch --track origin/integration/staging-citizen-admin-sprints-03-12
git pull --ff-only origin integration/staging-citizen-admin-sprints-03-12

# ID already used for your EXISTING staging Hyperdrive binding; not a password.
export STAGING_HYPERDRIVE_ID=312d8dc4d1494bc2856606899c8313a8

bash scripts/deploy-integration-staging.sh
```

The single reviewed script:

**Version verification:** before upload it writes a public, secret-free
`/staging-build.json` manifest to each Vite output with the exact Git SHA,
integration branch and build type. Both post-deployment smoke tests compare
that manifest with the local `git rev-parse HEAD` value, and **fail** if a
stale `main` deployment remains at either URL. You can open
`https://ekiti-platform-staging.inekitikete.workers.dev/staging-build.json`
after successful deployment to verify the same SHA yourself.
- Refuses any branch except the integration branch or a dirty tracked working tree.
- Explicitly overrides any local Vite account/private mode settings with guest-only, no real staff Auth.
- Runs `npm ci`, both TypeScript checks, all unit tests, citizen staging Worker dry-run and independent admin build/dry-run.
- Generates `wrangler.staging.local.json` with the approved **staging-only Hyperdrive ID** and private `REPORTING_ENABLED`, `EVIDENCE_ENABLED`, `NEARBY_DIRECTORY_ENABLED` and `NEARBY_DIRECTORY_REVIEWED` set to **false**.
- Deploys the same two fixed **staging** Worker names, never a production/custom domain, production database, real admin credentials or recipient messaging provider.
- Smoke-tests the citizen Worker against known public geographical reference data and Ask, then verifies the admin demo serves same-origin static JS.

Expected URLs **only after** Wrangler confirms deployment:

- Citizen: `https://ekiti-platform-staging.inekitikete.workers.dev`
- Fictional admin demo: `https://ekiti-admin-demo-staging.inekitikete.workers.dev`

If the second account's workers.dev subdomain differs, set `ADMIN_DEMO_STAGING_URL` appropriately. Do not use the admin demo as a private staff login or public live operations tool.

## CI and SQL collision isolation

The root `.github/workflows/tests.yml` continues the citizen's isolated test path. A **new separate** `.github/workflows/admin-tests.yml` runs admin SQL security checks in a second fresh PostGIS runner/container: the admin `0006_admin_private.sql` and citizen `0006_private_gateway.sql` are *both proposals* and must not be installed together in the same unreviewed database. The integration merge only combines **source**; it **does not reconcile and deploy both database schemas**.

Before live features can be activated, review and reconcile the two sets of private tables, functions, RLS/role grants, consent and retention policies; build a new approved migration sequence on an isolated staging DB; run cross-branch end-to-end tests; complete real verified source ingestion and separate operator review. No `db/proposals/` file is applied by the preview script.

## What the user will still not see

- Real private case submission, server-generated case receipts or citizen-government tracking: **disabled**.
- Real photo/video/evidence uploads: **disabled**.
- Private account logins, SMS/email delivery, linked history or report notifications: **disabled**.
- True nearby-business distance results: **disabled** until verified public geocoded listings and operator review.
- Authentic MFA staff sign-in and staff-management controls: **not deployed**; the admin Worker is a static fictional demo.

This is intentionally a public-safe **feature preview**, not full production availability.
