# Citizen location interface

## Local development

Use the database setup and digest-checked INEC import in the README. Apply migration 0003 for the directory function. As the owner, create a separate login with a password from your secret manager and grant it membership in ekiti_location_reader. The login needs database CONNECT and only the privileges supplied by that role. Use a TCP connection for local Hyperdrive.

Set CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE in the shell to the restricted login's PostgreSQL URI. Keep the owner connection in DATABASE_URL for migrations and import tests only. Build the static assets and start the local Workers runtime:

```sh
npm ci
npm run build
npm run dev -- --ip 127.0.0.1 --port 8787
```

Open http://127.0.0.1:8787. Rebuild after editing the client. Wrangler reloads Worker changes. The local Hyperdrive override points to your running PostGIS database, so a populated directory and successful boundary lookup exercise the real backend.

## Selection and privacy

The initial page loads HTML, CSS, a small client module and the verified reference directory. Search filters the native LGA and ward selectors. Selecting another LGA clears its dependent ward. Town suggestions appear only for verified settlement rows with the chosen LGA as parent. The current dataset has none, so the field accepts a self-described place. Manual selections stay in page memory.

Opening the map downloads MapLibre, its worker and the attributed 2020 GRID3 LGA snapshot from the same origin. Pan, zoom and tap to propose a pin. The map displays the reference geography while the live database decides the match. Coordinate entry provides a keyboard and no-WebGL alternative. Device GPS is requested only by its button. Neither moving a pin nor receiving GPS sends the position to the API. Confirming the point checks the LGA. An existing manual selection survives a conflicting result. Border and outside-state outcomes remain visible. Electoral ward choices always come from the citizen.

## Worker contract and staging

GET /api/areas returns the verified Ekiti directory as id, name, kind and parentId rows. POST /api/resolve accepts a JSON body with numeric latitude and longitude and confirmed set to true. The response contains per-level evidence and status from the existing resolver. Input is limited to 512 bytes, with geographic range validation before a connection is opened. Unsupported methods, cross-site browser requests and excess requests receive 405, 403 and 429 respectively. Database outages return 503. API responses use no-store. The application does not log positions, persist a report, or contact an agency.

Before staging, set the Hyperdrive ID in wrangler.jsonc to the real binding for a TLS-enabled restricted reader. Disable Hyperdrive query caching. Keep origin credentials within Hyperdrive and keep request-body logging disabled. The rate-limit binding applies 60 API requests per minute per connecting IP per Cloudflare location. Static assets and API routes share one origin. Review the namespace ID and origin reachability for the target account. Verify the binding and permissions in staging before enabling public traffic. [Database transport ADR](adr/0002-worker-postgres-transport.md)

## Verification

Run npm run test:all, npm run test:postgis and python3 tests/import_checks.py against the imported test database. To run the mobile Chromium suite with the local Hyperdrive override set:

```sh
npm run build
npx playwright install chromium
npm run test:browser
```

Playwright starts Wrangler when needed. The suite covers list filtering and keyboard input, mobile overflow, lazy map loading, GPS confirmation, a real Efon interior match, manual ward retention, outside-state points and lookup failures. CI uses a fresh PostGIS database and a dedicated reader login. No live Cloudflare account is required for the tests.
