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

## Development status

**Milestone 01 starter — not a deployed service.** Current files provide the domain-level geographic resolution contract and tests, a PostgreSQL/PostGIS migration, starter LGA names for audit, security guidance and developer workflows. No verified Ekiti boundary geometries or citizen reports are loaded. The geographic resolver will remain explicitly partial until verified boundaries are imported and tested.

## Local development

Requirements: Node.js 22.16 or later, npm, and PostgreSQL 16 with PostGIS for database integration.

```bash
npm install
npm test
npm run check
```

For PostGIS (after creating a blank development database and installing PostGIS):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_geography.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seeds/0001_ekiti_lgas.sql
```

`DATABASE_URL` belongs in your local environment or secret manager, **never** in Git. The seed contains a provisional 16-LGA name list for reconciliation; it contains **no invented ward polygons, coordinates or report data**. Validate the name records against authoritative sources before production use.

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
