// Run manually: node --experimental-strip-types scripts/collect-ekiti-feed-cli.mjs
// Writes metadata for human review. Never connects to Supabase or publishes records.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { collectCandidates } from './collect-ekiti-feed.mjs';

const destination = resolve('data', 'review', 'ekiti-official-pending.json');
const result = await collectCandidates();
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(result, null, 2) + '\n', { flag: 'w', mode: 0o600 });
console.log(JSON.stringify({
  path: destination,
  received: result.candidates.length,
  status: result.status,
  action: 'REVIEW REQUIRED: no content published or database updated',
}));
