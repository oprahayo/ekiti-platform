# Ekiti Civic — Admin UX, location maps and opt-in alerts

**Status:** source-only feature branch, stacked on Sprint 13 PR #39. **Not deployed, merged or enabled as a live report/alert service.**

## Why MapLibre rather than introducing Leaflet

The repository already contains `maplibre-gl` and the audited GRID3-derived Ekiti GeoJSON for its 16 LGAs at `data/grid3/lga.json`. Both are free/open source. We reuse this existing map infrastructure and source geometry, rather than adding a second rendering engine or relying on free-but-capacity-limited OpenStreetMap raster tile servers.

- The source `src/web/map.ts` draws an Ekiti boundary vector style locally, with LGA names, navigation/zoom and attribution. It makes **no OSM/external tile or geocoder requests**. The existing GRID3 map-credit note remains visible.
- `/map` is a new citizen-facing Ekiti atlas with two layers: source-reviewed directory pins (upon an explicit search action) and a privacy-protected public report layer (empty until approved projections exist).
- `/explore` now links to the atlas and its expandable map can plot only geocoded and reviewed entries from the existing `reviewedOnly:true` public API, never fictional demo businesses. A separate strict parser excludes invalid IDs, unknown LGAs, absent/outside-range coordinates and entries without reviewer/publisher evidence.
- The incident location step of the existing conversational `/report` experience now offers **Choose on Ekiti map**, alongside the current manual LGA, verified coordinates and opt-in on-scene GPS routes. Map clicks live only in component memory, do not trigger the resolver until **Check this incident point**, do not save raw coordinates into browser storage, do not publish pins, and do not send/dispatch emergencies. Existing safeguarding risk flags disable all exact-point methods including this one.
- Published reports are **not created** here: no private incidents, protected identities, GPS, attachments, homes, wards or fictional locations can be shown in a public map. Redaction, generalization, consent and explicit moderator approval must be implemented before a live public projection.

For future streets/road basemaps, a separately approved tile host/provider is required. OSM's community tile server is not a guaranteed free production service and has attribution, caching and no-prefetch rules; do not fetch tiles in bulk or silently add external location trackers.

## Administrative interface redesign

The fictional, separated `admin/src/AdminApp.tsx` workspace is still useful as a mobile-first prototyping surface but its previous dark, dense, nested layout was overly heavy. Changes in this branch:

- A restrained light sidebar with four main sections, compact header and larger, calmer white content surfaces. Navigation, case detail, moderation and routing logic remain intact; no invented live operations.
- Per-LGA queue filtering complements the existing queue status and free-text search. LGA filters in the **fictional demo** operate only on known sample cases. Real staff intake from Sprint 13 still enforces the independently reviewed LGA scope **in SQL** and has not been enabled.
- Overview adds a collapsible reference map of Ekiti's LGA boundaries, without synthetic report markers.
- Instead of another dashboard or a dozen new navigation items, a small **Alerts** control in the header opens one focused notification inbox. Alerts derive exclusively from fictional in-memory sample cases; they can be filtered by priority and LGA. They never report real incident arrivals, dispatch, verified office acknowledgement, or a government response.
- **Sound off by default.** Staff can opt in per tab and set 0–100% volume, with a manual preview of an original synthesized two-/three-note chime. No copyrighted ringtone files, continuous ringing, aggressive background audio, or playback upon page load. A demo case action can chime only while staff sound is enabled.
- Desktop browser notifications require a second explicit click and permission via the browser's UI. They are limited to a generic demonstration message from a direct demo action and are **not push, SMS, email, a real-time event source, or reliable background delivery**. Mobile browsers differ. No sensitive case narrative is placed in system notification text, URLs, logs or browser storage.
- Controls are responsive down to 280px and include labels, keyboard-accessible buttons/selects, reduced-motion compatibility, and explicit demo/independent-platform disclosure.

## Tests

- `tests/ekiti-map-public.test.mjs`: strict source and geographic review validation; excludes absent coordinates, unknown area and preview fixtures.
- `tests/admin-alerts.test.mjs`: sample-only alert categorization, excluding closed cases and no automatic audio without a browser or user-controlled volume.
- `tests/browser/sprint-14-ekiti-atlas.spec.ts`: no private-case or geolocation lookup when viewing the map, deliberate reviewed-place search, map-layer privacy labels, exact-point selection requiring confirmation, narrow mobile viewport.
- `tests/admin-browser/alerts.spec.ts`: sound defaults off, alert/LGA/priority filters, preview volume, desktop permission guard, four-tab mobile navigation, per-LGA case display and on-demand map.

The original separate citizen and admin CI workflows remain unchanged; no additional database schema or live Worker route is introduced.

## Production prerequisites

This is **not yet a real-time civic alert system**. Before live notification delivery:
1. Reconcile and approve the private citizen/admin database proposals and independent operator roles.
2. Create verified, authenticated staff destinations and an event-ingestion/notification outbox, with idempotent event IDs, TTLs, audited status and consent/role/LGA-specific subscriptions. Do not fan out private events to unauthorized staff.
3. Add quiet hours, escalation policy, retries, opt-out, incident severity review, secure Web Push/service worker (if wanted), delivery-state evidence, tamper-resistant alert audit, incident retention and accessibility safeguards.
4. Validate actual content moderation, publication consent, reduced location precision and verified business geo-coordinates before any map pin becomes public.

**Staging:** current `ekiti-platform-staging` and `ekiti-admin-demo-staging` Workers still use the previously verified integrated release. The features in this branch **will not appear there until an independently verified safe preview deployment**. The default-off private backend switches are unchanged.
