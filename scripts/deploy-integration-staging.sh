#!/usr/bin/env bash
# Safe, reproducible staging preview of the unified citizen + fictional admin build.
# Never called by CI or a public endpoint. Run by an operator with an existing
# authenticated Wrangler CLI on their OWN machine.
set -euo pipefail
cd "$(dirname "$0")/.."

expected="integration/staging-citizen-admin-sprints-03-12"
actual="$(git symbolic-ref --short HEAD)"
if [[ "$actual" != "$expected" ]]; then
  echo "Refusing: checkout $expected (current: $actual)." >&2
  exit 2
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Refusing: commit or stash tracked local changes before deployment.' >&2
  exit 2
fi
if [[ ! "${STAGING_HYPERDRIVE_ID:-}" =~ ^[a-fA-F0-9]{32}$ ]] ||
  [[ "$STAGING_HYPERDRIVE_ID" =~ ^0+$ ]]; then
  echo 'Refusing: STAGING_HYPERDRIVE_ID must be your reviewed 32-hex staging binding.' >&2
  exit 2
fi

# Force a GUEST-ONLY preview build, even if a local .env or environment variable
# previously tried to turn on unapproved sensitive account/report features.
export VITE_SUPABASE_URL=''
export VITE_SUPABASE_PUBLISHABLE_KEY=''
export VITE_CITIZEN_SMS_OTP_ENABLED='false'
export VITE_CITIZEN_REPORT_LINKING_ENABLED='false'
export VITE_CITIZEN_CASE_LINKS_ENABLED='false'
export VITE_CITIZEN_TIMELINE_ENABLED='false'
export VITE_ADMIN_MODE='demo'
export VITE_STAFF_AUTH_URL=''
export VITE_STAFF_PUBLISHABLE_KEY=''

echo 'Running both projects’ types and unit tests'
npm ci
npm run test:all

echo 'Checking citizen staging Worker and frontend without deployment'
npm run staging:check

# Optional but recommended: test existing public DB readers BEFORE uploading.
# The connection string stays in the operator's environment, never in source.
if [[ -n "${PUBLIC_READER_DATABASE_URL:-}" ]]; then
  echo 'Checking reviewed public search readers with the restricted DB login'
  npm run db:public-search:check
else
  echo 'Public-reader preflight skipped: set PUBLIC_READER_DATABASE_URL to detect missing civic SQL before deployment.' >&2
fi
node scripts/stamp-staging.mjs citizen

echo 'Building and checking separate fictional-only admin demo'
npm run build:admin
node scripts/stamp-staging.mjs admin-demo
npx wrangler deploy --config wrangler.admin-demo.staging.jsonc --dry-run --outdir .wrangler/admin-staging-check

echo 'Preparing public preview Worker with private features explicitly disabled'
node scripts/prepare-staging.mjs

# Deployment is limited to the two known staging Worker names.
# No production routes, DB migrations, feature-gate approvals or case writes.
npx wrangler deploy --config wrangler.staging.local.json
node scripts/smoke-staging.mjs "${CITIZEN_STAGING_URL:-https://ekiti-platform-staging.inekitikete.workers.dev}" "$(git rev-parse HEAD)"

npx wrangler deploy --config wrangler.admin-demo.staging.jsonc
node scripts/smoke-admin-demo.mjs "${ADMIN_DEMO_STAGING_URL:-https://ekiti-admin-demo-staging.inekitikete.workers.dev}" "$(git rev-parse HEAD)"

echo 'Staging preview deployed and smoke-tested (guest citizen app + fictional admin demo).'
echo 'Private case submission, accounts, messages, proximity and staff operations remain disabled.'
