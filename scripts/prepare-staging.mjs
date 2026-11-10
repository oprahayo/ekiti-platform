import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dryRun = process.argv[2] === '--dry-run';
const id = dryRun ? '0'.repeat(32) : process.env.STAGING_HYPERDRIVE_ID;
if (!dryRun && (!id || !/^[0-9a-f]{32}$/i.test(id) || /^0+$/.test(id))) {
  throw new Error('Supply the 32-character ID of the approved staging Hyperdrive binding.');
}
const root = new URL('../', import.meta.url);
const config = JSON.parse(readFileSync(new URL('wrangler.jsonc', root), 'utf8'));
config.name = 'ekiti-platform-staging';
config.hyperdrive[0].id = id;
config.ratelimits[0].namespace_id = '2003';
const path = fileURLToPath(
  new URL(dryRun ? 'wrangler.dry-run.local.json' : 'wrangler.staging.local.json', root),
);
writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log('Prepared ' + path);
