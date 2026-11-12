# GRID3 named settlements — review-only source import

Date: 12 November 2026
Status: importer implemented and tested in source. The raw Ekiti snapshot
has NOT yet been downloaded, pinned, approved, or displayed by this PR.

This milestone extends issue #53 without replacing the existing MapLibre
16-LGA map. No data is injected into the citizen app, public search, private
case tables, staff views, Supabase, Cloudflare or the public directory.

## Source and license

Official GRID3 source:
- Item: https://www.arcgis.com/home/item.html?id=73d8522d1c4d4c75be6c10fa790c685c
- Layer: https://services3.arcgis.com/BU6Aadhn6tbBEdyk/ArcGIS/rest/services/Settlements_in_Nigeria/FeatureServer/0
- Source item ID: 73d8522d1c4d4c75be6c10fa790c685c
- Dataset: GRID3 NGA – Settlement Names, 2020 data, released March 2021;
  NOT GRID3 Settlement Extents v4.1 (2026).
- License: CC BY 4.0.
- Attribution: eHealth Africa, Proxy Logics, and Oak Ridge National Laboratory
  (ORNL). 2020. Settlement Points in Nigeria. GRID3.
  https://grid3.gov.ng/
- Official metadata: https://www.arcgis.com/sharing/rest/content/items/73d8522d1c4d4c75be6c10fa790c685c/info/metadata/metadata.xml?format=default&output=html
- Existing clipped LGA polygons: data/grid3/lga.json, same verified
  state/LGA geography used throughout the platform.

The layer declares FID, set_id, set_name, set_altnam, lganame, lgacode,
statename and point coordinates in WGS84; 1,000-feature pagination uses its
supported query endpoint (limit is 2,000). Only allowlisted fields are read.

## Operator procedure on an internet-connected machine

1. On the integration branch or an approved data-processing branch, run:

       npm run data:settlements:fetch

   The script uses the fixed official HTTPS layer and only the Ekiti state
   filter. It checks a count first, pages in FID order, requires exact
   records/page and rejects changing pages or duplicate FIDs. It writes a
   source-filtered raw GeoJSON and download manifest exclusively beneath
   git-ignored data/review/grid3-settlements/.

2. Review the printed SHA-256 and the downloaded manifest. Pin that hash in
   a documented data-review approval/PR, recording the exact source snapshot
   and review decision. Do not commit private drafts, unreviewed raw
   personnel fields, or silently replace an existing snapshot.

3. With the reviewed SHA:

       npm run data:settlements:prepare -- --sha256 <64-hex-digest>

   This verifies the complete raw-file SHA and manifest before the
   deterministic offline clipping. A changed source produces a hard error.

4. Inspect the review-only output files:
   - candidate-points.review-only.geojson
   - quarantine.review-only.json
   - audit.review-only.json

   The audit includes source count, accepted/rejected counts, exact 16-LGA
   coverage, duplicate-name collision groups, attribution, date, snapshot
   digest and explicit publicationAllowed:false.

5. Geographic reviewers must resolve source/geography discrepancies,
   boundary points and repeated names per LGA. A human-reviewed separate
   publication transformation, source pinning and database review process
   are required before any marker becomes publicly accessible. Such
   publication tooling is NOT part of this milestone.

## Data safety

- No bounding-box assignment. Actual GeoJSON polygon containment
  (including hole and edge checks) is required. Any point on an LGA boundary,
  outside all Ekiti polygons, inside multiple polygons or inconsistent with
  source LGA/state metadata goes to quarantine.
- Raw editor, timestamp and administrative personnel fields are not
  included in candidate output. Names and aliases are length-bounded,
  stripped of control characters and tagged pending-human-review.
- Duplicate object IDs, empty names, invalid coordinates and same-name
  collisions within one LGA are quarantined without guessing identity.
- If local polygons change unexpectedly or a full source snapshot lacks
  candidates in any of the 16 LGAs, preparation fails closed.
- Not every hamlet or town necessarily appears in the 2020 named-point data.
  Do not claim full coverage or substitute 2026 settlement extents
  (a different licensed product) as names.
- No new frontend requests, GPS access, third-party map tiles, automatic
  government acknowledgment, case pins or authentication changes.

## Automated checks

npm run test:all runs tests for the actual 16 GRID3 LGA polygons,
polygon holes/borders, metadata mismatches, invalid states, name collisions
and source-data sanitization.

This PR is source-only. npm run staging:check and existing CI should
still pass; no staging/prod deploy, live database migration or data release
is authorized by this importer.
