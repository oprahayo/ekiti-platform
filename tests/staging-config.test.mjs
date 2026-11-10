import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));

function runGenerator(args = [], id = '') {
  const root = mkdtempSync(join(tmpdir(), 'ekiti-staging-test-'));
  const script = join(root, 'scripts', 'prepare-staging.mjs');
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(join(project, 'scripts', 'prepare-staging.mjs'), script);
  copyFileSync(join(project, 'wrangler.jsonc'), join(root, 'wrangler.jsonc'));
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, STAGING_HYPERDRIVE_ID: id },
  });
  return {
    result,
    path: join(root, args.includes('--dry-run') ? 'wrangler.dry-run.local.json' : 'wrangler.staging.local.json'),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('dry-run has isolated staging name, namespace, and placeholder binding', () => {
  const task = runGenerator(['--dry-run']);
  try {
    assert.equal(task.result.status, 0, task.result.stderr);
    const config = JSON.parse(readFileSync(task.path, 'utf8'));
    assert.equal(config.name, 'ekiti-platform-staging');
    assert.equal(config.hyperdrive[0].binding, 'HYPERDRIVE');
    assert.equal(config.hyperdrive[0].id, '0'.repeat(32));
    assert.equal(config.ratelimits[0].namespace_id, '2003');
    assert.equal(config.assets.directory, './dist');
  } finally { task.cleanup(); }
});

test('a missing, placeholder, or malformed live Hyperdrive ID cannot generate staging config', () => {
  for (const id of ['', '0'.repeat(32), 'not-a-hyperdrive-id']) {
    const task = runGenerator([], id);
    try {
      assert.notEqual(task.result.status, 0);
      assert.equal(existsSync(task.path), false);
    } finally { task.cleanup(); }
  }
});

test('an approved-format binding produces a separate ignored live staging config', () => {
  const id = '1234567890abcdef1234567890abcdef';
  const task = runGenerator([], id);
  try {
    assert.equal(task.result.status, 0, task.result.stderr);
    const config = JSON.parse(readFileSync(task.path, 'utf8'));
    assert.equal(config.hyperdrive[0].id, id);
    assert.equal(config.name, 'ekiti-platform-staging');
  } finally { task.cleanup(); }
});

test('unknown arguments fail closed without writing a config', () => {
  const task = runGenerator(['--unexpected'], '1234567890abcdef1234567890abcdef');
  try {
    assert.notEqual(task.result.status, 0);
    assert.equal(existsSync(task.path), false);
  } finally { task.cleanup(); }
});
