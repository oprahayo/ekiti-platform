# Sprint 08 — Explore, verified filters, and optional real nearby distances

**Status:** Source-only feature on a stacked draft branch. It is **not merged, deployed, populated or approved** for live location requests. Base branch is Sprint 07 (#32); previous draft Sprints 03–06 remain unmerged.

## What changed

- **Preserved existing Experience:** 24 illustrated Explore category tiles, text search, compact three-column mobile layout, manual 16-LGA filter, the existing **Near me** LGA-only action, sample-record disclaimers, and reviewed listing details remain intact.
- **Clarified two different concepts:** the existing **Near me** button chooses the verified LGA for browsing but is **not a proximity ranking**. A separate **Find verified places near me** button requests device GPS only after an explicit user click and shows actual distance-sorted listings when separately enabled.
- **Radius and source attribution:** residents can select **5, 10, 25 or 50 km**. Results are ordered by PostGIS spherical straight-line distance **before** any 20-result limit; they display an approximate kilometre distance and publisher/source link. Nothing is labelled driving distance, opening hours, or nearest by estimated travel time.
- **Verified-publication-only predicate:** `db/proposals/0011_public_nearby.sql` proposes a new read-only `civic.public_places_nearby` SECURITY DEFINER function. To qualify, each place must be **published**, have an **approved source**, a verified Ekiti LGA, a separately reviewed coordinate pair, and its reviewed point must physically fall **within a verified polygon of the same LGA**. Unreviewed, pending, mismatched, and ungeocoded entries cannot be ranked as nearby.
- **Filter integrity:** optional reviewed category (Health, Schools, Offices, Hotels, Other), LGA, text query and radius are bound SQL parameters. Unknown fine-grained trade categories (such as plumbers) are deliberately marked **unclassified** and the nearby button disabled: unrelated coarse `Other` businesses must not be presented as vetted plumbers.
- **Coverage safety:** the backend first checks the resident's explicitly provided point through the existing verified Ekiti PostGIS resolver. Outside-state, unknown, disputed or ambiguous LGA evidence returns no nearby ranking and suggests manual browsing. Residents outside Ekiti can still manually search its businesses.
- **Privacy:** coordinates are read only following an explicit click, sent in a size-limited **same-origin POST JSON body**, never in a query string or return payload, and never saved in localStorage, sessionStorage, the report drafts or analytics. A click uses no-store/no-referrer request flags. Server and transport infrastructure can still process transient request metadata; it is *not* claimed to be perfectly anonymous.
- **Default-off release lock:** `/api/places/nearby` returns `404` unless both `NEARBY_DIRECTORY_ENABLED === 'true'` and `NEARBY_DIRECTORY_REVIEWED === 'true'` are independently set. The new SQL proposal is intentionally outside normal migrations and staging prepare. Even setting the flags before function provisioning results in 503, not fabricated results.
- **Fail-closed frontend:** the client rejects results without `reviewedOnly: true`, independently validates each listing's stable ID, LGA/category, HTTPS source and non-negative monotone distance within the selected radius, and never displays unsafe, unsorted or mismatched payloads. Permission denial, unsupported categories, outside-Ekiti and empty coverage are explained honestly. On changing category/LGA/query/radius, an in-progress lookup is invalidated and previous proximity results are cleared.

## Code and tests

- `src/server/nearby-places.ts`: bounded validated request contract and parameterized query.
- `src/server/worker.ts`: private coordinate POST route with exact-origin and explicit feature flags, rate limit, verified coverage check and no-store response.
- `db/proposals/0011_public_nearby.sql`: guarded public read-only function; **do not run in production**.
- `src/app/nearby-directory.ts`: opt-in device-location transport and strict reviewed-result validation.
- `src/app/NearbyDirectorySearch.tsx`, `src/app/ExploreDirectory.tsx`, `src/app/styles.css`: accessible nearby action and verified-distance result list.
- `src/app/ReportPrivacy.tsx`: explains the optional directory GPS action separately from incident reporting.
- `tests/sprint-08-nearby.test.mjs`: validation, parameterization, disabled route, privacy and integrity failures.
- `tests/nearby-postgis.mjs`: transaction-rolled-back, disposable PostGIS test for reviewed/source/coordinate inclusion, exclusion, distance ordering and RLS grants.
- `tests/browser/sprint-08-nearby.spec.ts`: explicit permission, reviewed entries, radius/category/LGA changes, outside-Ekiti, unclassified trades and 280px mobile.

## Release gates, not completed

1. Review the true legal/operator/privacy basis for processing exact short-lived device coordinates and the public disclosure/log retention; approve the location feature separately from live reporting and evidence.
2. Independently review `0011_public_nearby.sql` against the actual Supabase project schema and approved PostGIS schema; explicitly apply to isolated staging first. Never overwrite existing proposals, run unrelated migrations or grant raw table read access.
3. Publish enough *real* businesses with independently verified sources, LGA, and coordinate evidence for meaningful nearby search. A green CI result on **fictional fixtures** is not real coverage.
4. Provision and independently approve deployment configuration, rate limits and rollback; only then deliberately enable the two nearby-specific flags. Do not enable reporting/evidence or admin.
5. Perform mobile field tests, accuracy review at LGA borders, no-persist/log review, negative security tests and accessibility sign-off.

**Next:** Sprint 09 — civic knowledge / question answering and official source validation (per 26-sprint roadmap). Do not conflate source-only feature code with a launched directory.
