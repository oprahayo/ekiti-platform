# Sprint 14 — Clean operations dashboard, Ekiti maps and restrained alerts

**Status:** source-only draft, stacked after Sprint 13. **No live private reporting, emergency dispatch, agency acknowledgements, alerts, or database migration.**

## Motivation

The earlier demo admin console has too many competing status panels and dense surfaces. Sprint 14 is a layout and navigation refinement focused on the actual workflows: what requires review, where issues appear at the **LGA aggregation level**, and how to drill into the case list. The demo and the real private staff workspace remain **separate**; only the demo Overview receives the new public-safe map and alert visualization. A sensitive production intake map must follow independently reviewed access and data-retention policy.

## Free Ekiti map technology

The repository already bundles **MapLibre GL JS**, a free/open-source mapping engine, so Leaflet is not needed as a second dependency. We reuse its pinned GRID3 LGA polygons in `data/grid3/lga.json`. A custom no-tiles vector style renders all 16 local government boundaries, including labels and a choropleth; no Google Maps token, third-party raster tile service, browser GPS or location permission.

- **Admin operations preview**: `admin/src/EkitiOpsMap.tsx` plots **LGA-wide fictional case counts**, not incident coordinates. Its 16 keyboard-accessible LGA buttons and map polygons open the existing sample case search for that LGA. Colors are count bands (zero, one, two+), not severity or an inferred outbreak/incident zone. Boundaries are sourced from GRID3 / eHealth Africa and Proxy Logics (2020), CC BY 4.0, and attribution is visible.
- **Citizen business directory**: `src/app/EkitiDirectoryMap.tsx` is loaded only after the user opens the map. The same LGA map allows manual LGA filtering. Only **already reviewed and valid public directory listing coordinates** from `/api/places` are plotted; unreviewed, illustrative and ungeocoded business examples are never pinned. The directory preview retains its honest empty state. Every marker label uses text, not unsafe HTML.
- **Emergency reporting**: the existing `src/web/map.ts` already uses MapLibre and verified Ekiti polygons for a voluntarily selected incident position. It remains a separate private workflow; selected coordinates are not published on the directory or admin demo map. No automatic GPS request or live emergency location feed is introduced.
- **Roadmap public incident projection** remains **NOT implemented** in this refinement. Publishing redacted reports on a public map first requires explicit publication approval, precision degradation by sensitivity, complete removal of identifying narrative/evidence/coordinates and end-to-end moderation security tests.

The choice to avoid shared `tile.openstreetmap.org` raster tiles in this release also avoids needing a tile provider/API key and the usage limits/caching/attribution requirements of external map tiles. If a proper street basemap is needed later, use a provider or self-hosted tiles with a reviewed license, request policy and reasonable caching, without uploading sensitive point data to third parties.

## Tailored notification and sound behavior

`admin/src/OpsAlerts.tsx` derives only sample alerts from the **in-memory fictional** case queue. Staff can limit visible alerts by sample LGA and/or high-priority status; marking an item read only affects local React state. The header shows the sample number requiring attention.

The original, synthesized two-tone chime is **off by default** and must be enabled plus explicitly started with a separate Test chime click. It does not autoplay, ring continuously, ask for browser Notifications permission, subscribe for push alerts, send SMS/email, request tracking permissions, or persist consent. The feature must not be described as real emergency monitoring.

A real notifications system would require a separately reviewed event source, verified recipient consent/preferences, severity triage, duplication control, quiet hours (with safety exceptions), reliable retries, delivery receipts, on-call escalation process, user identity and emergency-response governance. None are implemented here; no real staff or government agency receives an alert.

## Dashboard design

- Clearer one-level four-section navigation (Cases, Moderation, Routing, Overview) and smaller top-bar alert shortcut.
- A focused top-of-Overview two-column region for **Needs attention + Ekiti LGA map**; on mobile it collapses to a single column.
- Lighter surfaces, fewer visual borders, readable metadata, less decorative density, responsive map/table layouts and 280px mobile accessibility.
- Existing case management semantics, signed staff login boundary, moderation flow, browser history and platform-vs-government disclosures are unchanged.

## Verification

- `tests/admin-browser/ops-map-alerts.spec.ts`: map/16-LGA selections, notification filtering, no audio context until direct opt-in, correct case list after map selection, 280px width, visual review.
- `tests/browser/sprint-14-ekiti-map.spec.ts`: directory map open on demand, no illustrative business markers, no OSM/Google tile requests, no exact private incident points, 320px responsiveness.
- Existing independent admin PostGIS, MFA and citizen regression suites remain in the branch. Nothing in this sprint turns on a guarded database proposal or worker private feature flag.

## Preview and release restrictions

The current static staging demo can be upgraded only after the branch is reviewed, the release source is deliberately integrated, and an authorized Cloudflare deploy with its exact Git SHA completes. The existing automated deployment workflow cannot deploy without the owner's Cloudflare API token; do not claim a new map is live merely because tests pass.

**No government office notification, emergency alert, real staff push or signed case-assignment workflow exists.** This is an improved safe frontend foundation.

## Follow-up integration from alternate Sprint 14 draft

- Map LGA selections now use strict normalized area equality and a visible Clear area control, not general keyword search.
- Filtered alert read flags remain intact as operators change LGA or priority selections.
- The voluntary incident-location step now includes a MapLibre boundary map point picker. Selection is local; the first-party resolver is contacted only after Check. Exact positions are not published or dispatched.
- The citizen browser suite includes a check that opening and closing the map does not request location resolution.

This remains a source-only preview. No private database, real notifications, or Cloudflare deployment was activated by these commits.
