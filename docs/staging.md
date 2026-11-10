# Cloudflare staging

Run `npm ci && npm run staging:check` to build assets and bundle the Worker using Wrangler dry-run. It uses an isolated staging Worker name, rate-limit namespace and a local placeholder binding. It writes local files only. The base Wrangler config uses JSON syntax so the staging generator can reuse the same runtime flags, routes, headers, asset path and limits without duplicating them.

## Verify the origin locally

Follow the README migrations and pinned imports on a test database. Run the type, unit, PostGIS, import and browser suites from the citizen location guide. Wrangler uses a TCP connection to the local database through the Hyperdrive override. For a running local Worker, `node scripts/smoke-staging.mjs http://127.0.0.1:8787` checks the page, 16 LGAs, 177 ward IDs with known parents, a published Efon interior point, and the expected unmapped ward.

## Authorized live staging

1. Obtain approval for the Cloudflare account, staging deployment and database origin before provisioning or deploying. Use a separate staged database and the restricted location login. Apply migrations and the reviewed imports with a separate owner. Verify coverage and reader grants before connecting the Worker.
2. Configure Hyperdrive with the staging database endpoint, TLS and the restricted login through the account's secure credential flow. Disable query caching to keep boundary withdrawals effective immediately. Keep passwords and API tokens in the secret manager. Local connection overrides belong only in the development shell. [Hyperdrive connection guide](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/) · [Query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)
3. Set STAGING_HYPERDRIVE_ID to the real configuration ID and run `npm run staging:prepare`. This generates the ignored wrangler.staging.local.json. Confirm the target account, Worker name ekiti-platform-staging, namespace 2003 and bindings. Run `npm run build` and `npx wrangler deploy --dry-run --config wrangler.staging.local.json` to inspect the final package.
4. Only after deployment approval, deploy with `npx wrangler deploy --config wrangler.staging.local.json`. Record the version and the returned HTTPS origin. Use the smoke command above with that origin. A successful bundle or a Worker URL alone does not verify database connectivity.
5. Open that origin on a mobile browser. Try list selection, map selection and confirmation, then download and inspect a draft. Check that no report text or coordinates appear in URLs or telemetry. Record the version, time and results. If verification fails, withhold rollout and restore the previous verified staging version when available.

The repository carries no live binding or staging origin. Browser downloads and local Wrangler tests exercise the code path, while live staging verifies account configuration, TLS and connectivity.
