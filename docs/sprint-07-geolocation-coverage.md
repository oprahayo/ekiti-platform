# Sprint 07 — incident-location precision, verified boundaries and privacy-safe consent

**Status:** Source-only feature proposal based on Sprint 06 branch. **Not merged, not deployed, not authorized for live reporting.**

## Delivered

1. **Separate incident location from device browsing.** The report journey still defaults to the resident selecting one of Ekiti's 16 LGAs, with an optional community/landmark. The previously requested Explore device location is never automatically copied into a report or treated as the location of an incident.
2. **A clear, optional exact-point check** appears within the existing location step (not a new page or dashboard): users may choose either **I am at the incident** and then explicitly press **Check this incident position** to trigger browser permission, or **Check known coordinates** and supply an incident-specific latitude/longitude, limited to valid decimal forms and six places of precision. Neither option is required to finish a report.
3. **A shared explicit-permission helper** is reused by Explore and the incident picker. It requests GPS only following a deliberate click, requires secure context, rejects invalid positions, and sends the point only to the existing first-party `POST /api/resolve` verified PostGIS endpoint, with no URL query, cache or referrer. No map tile or external third-party geocoding services are introduced.
4. **Verified LGA suggestions never auto-populate.** Even for a single matched LGA, a separate **Use suggested LGA** action must confirm. An LGA conflict, multiple boundary candidates, unknown/invalid LGA, or outside-Ekiti point never changes the selected LGA. Manual selection remains available, including for residents outside Ekiti who are reporting something they witnessed there.
5. **Honest precision.** Verified and consistent ward boundaries can provide a **temporary ward suggestion**. Otherwise the UI reports LGA-only or uncertain precision; missing, conflicting or boundary-intersecting ward evidence is never invented. A manually chosen LGA is disclosed as unverified by GPS.
6. **No coordinate persistence.** Exact latitude/longitude and matched ward appear only in the open incident-position component's volatile memory. They are never included in saved draft JSON, submission models, links, device location context, analytics, publicly visible location or reporter tracking. On leaving the step/reloading, the point is lost. An explicitly saved draft contains only the chosen LGA and the resident-entered community, without a verified-boundary claim on restoration.
7. **Safeguards.** Exact-point checks are disabled for drafts involving children, vulnerable people or retaliation concerns. Permission denial, browser unavailability, network failure, outside-scope and unclear boundary matching are clearly differentiated from user error. No silent submission or location-dependent requirement is introduced.
8. **Privacy disclosure.** The `/privacy` page explains that the browser sends coordinates transiently to the first-party boundary endpoint after an explicit action, that infrastructure may still process a request, and that no future live collection is authorized.

## Existing backend reused

- `src/server/worker.ts` already implements a separate, rate-limited, same-origin `POST /api/resolve` route that accepts a confirmed coordinate pair and resolves it using PostGIS (verified `geo.location_candidates`).
- `src/geo/resolve.ts` already distinguishes matched, ambiguous, unmapped and outside-scope LGAs/wards and detects hierarchical conflict or boundary uncertainty. Sprint 07 uses that verified response; it **does not** introduce new geography tables, new boundaries, write roles, private GPS columns, or migrations.
- The existing permanent privacy/release gates from Sprints 04–06 remain unchanged; all real reporting and evidence endpoints stay default-off.

## Automated checks

- `tests/sprint-07-incident-location.test.mjs`: explicit consent, denied/unavailable GPS, secure transport properties, bad coordinates, partial ward precision, LGA conflicts, outside-scope/ambiguous cases and unknown IDs.
- `tests/browser/sprint-07-incident-location.spec.ts`: no resolver network call until an explicit check, verified suggestion + explicit confirmation, manual fallback, cross-device draft privacy and restore, outside coverage, ambiguous boundary, on-scene permission gating, safeguarding restrictions, and 280px mobile accessibility.
- Previous citizen homepage and report conversation regression, private reporting disabled-route checks, CI-only/PostGIS source and secure evidence tests remain part of the pipeline.

## Limitations and future gates

- The UI checks incident points, **not legal proof** that an event happened there. Neither a resident-confirmed suggestion nor a typed coordinate may be represented as independently verified incident evidence.
- Most ward boundaries may be missing or unverified; a verified LGA does not guarantee a verified ward, municipality or street-level result.
- The user-facing location step has an optional coordinate check, not a full interactive street map; a future map picker needs independently reviewed map tile privacy, quality and accessibility.
- Cloudflare/ISP/network operators may still receive transient network data. **No claim of complete non-processing or anonymous GPS traffic** is made; production access-log retention requires review.
- No geospatial SQL migration, Supabase changes, upload, database write, Cloudflare deploy or live report activation occurred.

**Next:** Sprint 08 — Explore and Category Search. Detailed location-aware distance rankings may only be introduced for verifiably geocoded reviewed public place records; no location-based fabrication.
