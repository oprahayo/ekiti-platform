# Restore reviewed Ekiti public search on staging

Date: 12 November 2026
Scope: **public knowledge and directory readers only**. This is a diagnosis and
release runbook, not permission to change the Supabase production database,
enable real reports, approve listings, or expose private moderation data.

## Observed condition

The live citizen staging preview displayed its homepage, map and sourced
illustrative examples. The live usability audit reported HTTP 503 from:
- `GET /api/search?q=Hotels+near+Ikogosi`
- `GET /api/places?limit=3`
- `GET /api/knowledge?q=Ekiti&limit=3`

`/api/areas` succeeded at the same stage. This is consistent with, but does
**not prove**, a missing or incorrectly granted `civic` public-reader schema.
The Worker intentionally returns a generic 503 without exposing DB internals.

## Exact database contract

The Worker uses its existing `HYPERDRIVE` binding and restricted Postgres
login. These public functions are declared in
`db/migrations/0004_knowledge_directory.sql`:

- `civic.public_knowledge(text,integer)`
- `civic.public_places(text,text,text,integer)`
- `civic.public_place(uuid)`

The migration also introduces source provenance, reviewed knowledge/places,
moderation and claim tables. Pending items remain private. The functions only
return rows passing the documented source and item publication gates.
A deployed frontend and a healthy `geo.location_directory()` do **not**
install or validate these functions.

## Read-only diagnosis using a database owner or metadata viewer

Use the SQL editor of the **staging database linked to this Worker** to run
the following read-only query (or equivalent, using the restricted reader).
Do not disclose the database connection string or passwords:

```sql
SELECT
  to_regprocedure('civic.public_knowledge(text,integer)') IS NOT NULL
    AS knowledge_reader_exists,
  to_regprocedure('civic.public_places(text,text,text,integer)') IS NOT NULL
    AS places_reader_exists,
  to_regprocedure('civic.public_place(uuid)') IS NOT NULL
    AS place_reader_exists,
  to_regprocedure('geo.location_directory()') IS NOT NULL
    AS geographic_directory_exists;
```

A false `civic` column indicates a missing public-reader function in **that**
database. If all are true but HTTP 503 persists, check that the **Worker
Hyperdrive binding points to that same database** and that its restricted
role has `USAGE` on schema `civic` and `EXECUTE` on the three functions.

From an authorized operator environment, with the **same restricted login**
used by the Worker:

```sh
export PUBLIC_READER_DATABASE_URL='postgresql://<restricted-reader-connection-from-secret-manager>'
npm run db:public-search:check
```

The command uses a read-only transaction, tests the three bounded public
reader calls, prints only PASS/FAIL plus SQLSTATE classifications, and
exits nonzero for unavailable schema, missing functions or permission errors.
It never returns result rows or writes database records. Do not commit the
connection string or paste it into chat/issues/logs.

## Repair conditions

1. **Functions missing:** after explicit staging schema and privacy approval,
   apply the existing reviewed `db/migrations/0004_knowledge_directory.sql`
   **once** to that staging database using an authorized database owner.
   It depends on the installed geographic schema, `geo.areas`, and
   `ekiti_location_reader`. It is not an idempotent upgrade for a partially
   installed schema; do not rerun it blindly.
2. **Functions present but permission denied:** verify the migration's
   least-privilege `GRANT USAGE ON SCHEMA civic` and `GRANT EXECUTE`
   statements for the Worker login role. Do not grant direct table access,
   make any table public, disable RLS or use a Supabase service-role key in
   frontend code.
3. **Functions callable locally but staging still returns 503:** compare
   the Cloudflare Hyperdrive target, database and restricted login with the
   tested connection; check Worker logs privately and the release manifest
   without publishing secrets. A successful local migration on a different DB
   cannot fix the connected Worker.
4. **Readers return HTTP 200 with zero records:** that is a legitimate
   empty reviewed directory, not a server outage. Import sources and
   approve only independently checked public records through the separate
   moderation process. The existing linked Ekiti examples stay clearly
   described as external source candidates, not verified listings.

## Release verification

On the protected integration branch, the operator deploy helper can first
run the database readiness probe if `PUBLIC_READER_DATABASE_URL` is set.
The current `scripts/smoke-staging.mjs` now requires HTTP 200 with the
right public response shapes from all three search endpoints as well as
the pre-existing geography, report-safe, and bilingual Ask checks.

```sh
npm run db:public-search:check
bash scripts/deploy-integration-staging.sh
node scripts/smoke-staging.mjs https://ekiti-platform-staging.inekitikete.workers.dev
```

The post-deploy checks **must** pass before declaring public search usable.
Neither a GitHub merge nor this runbook installs the migration or deploys a
Worker. Reporting, evidence, staff access, real agency delivery, accounts
and geo-nearby publishing remain disabled until separately reviewed.
