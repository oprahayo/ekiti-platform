import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--dry-run')) {
  throw new Error('Usage: node scripts/prepare-staging.mjs [--dry-run]');
}
const dryRun = args[0] === '--dry-run';
const id = dryRun ? '0'.repeat(32) : process.env.STAGING_HYPERDRIVE_ID;
if (!dryRun && (!id || !/^[0-9a-f]{32}$/i.test(id) || /^0+$/.test(id))) {
  throw new Error('Supply the 32-character ID of the approved staging Hyperdrive binding.');
}
const root = new URL('../', import.meta.url);
const config = JSON.parse(readFileSync(new URL('wrangler.jsonc', root), 'utf8'));
if (config.hyperdrive?.length !== 1 || config.hyperdrive[0].binding !== 'HYPERDRIVE'
  || config.ratelimits?.length !== 1 || config.ratelimits[0].name !== 'LOCATION_LIMIT'
  || config.assets?.directory !== './dist') {
  throw new Error('Unexpected base Wrangler bindings; review the staging generator before use.');
}
config.name = 'ekiti-platform-staging';
config.hyperdrive[0].id = id;
config.ratelimits[0].namespace_id = '2003';
// Explicitly keep unapproved private services inert in preview even if the
// remote staging Worker previously carried an old variable. A deploy alone
// is not legal/security approval for live reports, evidence or proximity.
config.vars={
  ...(config.vars || {}),
  REPORTING_ENABLED:'false',
  EVIDENCE_ENABLED:'false',
  NEARBY_DIRECTORY_ENABLED:'false',
  NEARBY_DIRECTORY_REVIEWED:'false',
  // Public, user-initiated, rate-limited Wikimedia discovery. No private input.
  EXTERNAL_WEB_SEARCH_ENABLED:'true',
};
const path = fileURLToPath(
  new URL(dryRun ? 'wrangler.dry-run.local.json' : 'wrangler.staging.local.json', root),
);
writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log('Prepared ' + path);
