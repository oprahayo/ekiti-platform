# Ekiti Civic Intelligence Platform

> **Working technical name:** `ekiti-platform`. The public-facing product name has not been approved.

Open-source civic infrastructure for Ekiti State, Nigeria: trustworthy local information, business and places discovery, citizen reporting, report tracking, and privacy-safe public data.

**Independent civic project. Not a government service.** The project does not presently receive reports on behalf of Ekiti State government agencies or dispatch emergency services.

## Agreed product decisions

- One unified text search and conversation experience, with a dedicated **Explore Ekiti** places-and-business directory and map.
- Text chat with **push-to-talk** voice as the initial target; advanced live voice later.
- Geographic intelligence grounded in validated administrative data, not LLM-generated ward names.
- Reporting and public accountability, with evidence-based statuses; do not display fabricated delivery, view or resolution events.
- Mobile-first, low-data mode and accessible non-map location selection.
- Carefully reviewed public data and API access; never expose private or restricted reports.

## Existing community presence

The project team has provided existing social channels: [Instagram @inekitiofficial](https://www.instagram.com/inekitiofficial) and [TikTok @inekitiofficial](https://www.tiktok.com/@inekitiofficial). Their existence does not settle the software's final public brand. A contact email has been provided privately; confirm publication before adding it to this public repository.

## Ask Ekiti — source-backed English/Yoruba chat

The mobile interface now includes a central Ask experience, English/Yorùbá language switching, a one-tap light/dark toggle, source citations, live official press-release RSS lookup with dated fallback, optional voice recognition and browser text-to-speech playback. No paid AI token or LLM API is required. The answers are curated/extractive and **cannot answer arbitrary questions like a full generative model**. If a topic is unsupported or recent information is unverified, the app says so. Browser-supported Yoruba voice recognition and speech playback vary by device.

[View the researched source registry, usage limits and news freshness policy](docs/ask-ekiti-sources.md).

## First-launch conversational UI

The current launch UI candidate lets residents **talk with Ekiti Civic**, not work through consecutive reporting forms. The assistant asks what happened, which LGA is involved, and for extra details; it reviews the response for corrections and offers a private text download. **Nothing is submitted and no tracking reference is issued.** Reports are stored only in device localStorage for draft recovery, so clear them on shared devices. The Track tab provides an explicitly fictional example. Chat can direct a hotel or clinic request to Explore category/LGA filters, but business listings there are **illustrative**, not verified services. Real data ingestion, approved report intake, moderation and owner claims are separate backend work.

[Read the first-launch UX, testing and release guardrails](docs/conversational-launch-ui.md).

## Explore Ekiti — illustrated Yellow Pages

Explore now uses a reference-inspired **three-column grid of 24 illustrated service categories**, including all 12 trades in the supplied inspiration plus Ekiti hotels, restaurants, hospitals, schools, nightlife, public offices, markets and tourism. Categories use original black-outline icons with yellow accents, searchable service terms and LGA filtering. Business results remain plain rows. Only approved database entries can be presented as reviewed listings; the existing samples are explicitly fictitious, and map links require reviewed coordinates.

[Explore design, accessibility and directory activation notes](docs/explore-category-grid.md).

## Citizen accounts, ratings and business claims (launch-gated)

The Yellow Pages profile now supports real **moderated review feeds and rating summaries** from an opt-in database proposal, plus optional **Supabase email OTP sign-in** for sending reviews and business ownership requests. Citizen activity stays private; reviews and claims remain pending until independently moderated. The default deployment remains **guest-only** until Auth, privacy and the proposed schema are separately approved and configured. No personal identity documents or passwords are collected.

[See the implementation, privacy safeguards, configuration and explicit activation checklist](docs/citizen-reviews-claims.md).

## Unified staging preview (Sprints 03–12)

The citizen and administrative draft branches are now combined in
`integration/staging-citizen-admin-sprints-03-12` **without changing `main`**.
The user-facing citizen app can be previewed at the existing staging Worker.
The independent admin dashboard is a separate **fictional-only static demo**.
Private reports, accounts, evidence, messaging, reviewed nearby results, and
real staff authentication remain disabled; no live migrations are applied.

See [the staging integration and safe two-Worker deployment runbook](docs/staging-integration-release.md).
Do not deploy from `main` expecting draft changes to appear.

## Development status

The PostGIS resolver accepts citizen-confirmed incident coordinates. The audited GRID3 snapshot covers all 16 LGAs. The INEC reference import contains 177 electoral ward names. Electoral ward polygons await a verified crosswalk, so the current snapshot returns an unmapped ward for an in-state point. [Read the audit and measured coverage](docs/data-sources/2026-11-10-postgis-results.md).

[GitHub Actions checks](https://github.com/oprahayo/ekiti-platform/actions/workflows/tests.yml)

## Local development

Use Node.js 22.16+, npm, Python 3, psql, PostgreSQL 16 and PostGIS. For the optional INEC name import, install Poppler (pdftotext). Set DATABASE_URL to a blank development database created from template0. Run migrations as its owner with permission to install PostGIS and create the NOLOGIN reader role. On an existing database, apply the missing migrations in numeric order.

```sh
npm ci
npm run test:all
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/migrations/0001_geography.sql -f db/migrations/0002_location.sql -f db/migrations/0003_location_directory.sql -f db/seeds/0001_ekiti_lgas.sql
python3 scripts/import_geo.py
curl -fLsS https://inecnigeria.org/documents/resources/rac/EKITI.pdf -o /tmp/ekiti-rac.pdf
python3 scripts/import_geo.py --inec-pdf /tmp/ekiti-rac.pdf
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/coverage.sql
npm run test:postgis
python3 tests/import_checks.py
```

Imports check the exact reviewed input hashes and run in one transaction. Tests use the imported state/LGA snapshot and roll back their writes. CI downloads the official PDF into runner temporary storage, checks its pinned SHA-256, imports it twice, then checks a fingerprint of all 177 stored serial/name/parent mappings and all 16 parents. A missing or changed source fails CI. The PDF is not redistributed.

Grant ekiti_location_reader to a dedicated backend login with no existing table or schema-write privileges. Use its connection pool with the server entry point resolveIncidentLocation(db, latitude, longitude) in src/server/location.ts. Its database call accepts coordinates in latitude, longitude order. The RPC returns verified candidates, source IDs and edge flags. The server reports per-level status, hierarchy consistency and whether confirmation is required. Exact borders and overlapping matches require confirmation. Keep DATABASE_URL in the server environment. The planned Worker transport uses [Hyperdrive and a restricted origin login](docs/adr/0002-worker-postgres-transport.md).

## Citizen location interface

The mobile-first selector reads the verified area directory through the Worker. Citizens can select an LGA and ward, describe a town or landmark, and optionally confirm a GPS or map position for a PostGIS lookup. [Run the interface and browser checks](docs/citizen-location.md).

## Private report drafts and staging

Open **Prepare a report draft** below the location selector to download a complaint, commendation or issue as a text file. Drafts use the current area labels and boundary evidence. Downloading sends no report to the platform. [Next milestone](docs/MILESTONE-02.md) · [Module and routing decision](docs/adr/0003-platform-modules.md) · [Staging preparation and smoke checks](docs/staging.md)

## Milestone 02 intake foundation (not activated)

A consent-gated, anonymous report input contract and a proposed private report schema are prepared in GitHub. **They are not connected to a live Worker endpoint and the schema has not been applied to Supabase.** Current reports still download privately to the device; no submissions or tracking numbers are issued. See [reporting governance decisions](docs/reporting-governance.md) and [Milestone 02](docs/MILESTONE-02.md).

## Milestone 01 completion criteria

1. Verified 16-LGA and 177-ward names and source metadata imported.
2. Candidate boundary datasets licensed and audited (coverage, validity, gaps, overlaps, projection).
3. Verified geometries imported, with unresolved wards explicitly marked unmapped.
4. Location resolver tested against known, border, overlap and unmapped cases.
5. List-first, map-optional location picker that accepts a citizen-confirmed incident location.
6. No fabricated government-office delivery or officer-view information.

Read [Milestone 01](docs/MILESTONE-01.md), [architecture decision](docs/adr/0001-foundation.md), and [contribution guidance](CONTRIBUTING.md).

## Licensing

**License selection pending.** No open-source license has been granted by this repository yet. Decide on a license (e.g. MIT or Apache-2.0) before soliciting third-party code contributions. Third-party geographic datasets retain their own licenses and attribution requirements.
