# Ekiti map LGA navigation — milestone (12 November 2026)

## Implemented on existing React + MapLibre + GRID3 stack
- The map remains lazy-loaded only when the visitor explicitly opens it.
- A keyboard-operable search/list exposes all 16 *existing* validated Ekiti LGA
  names, using the current project geography selector. Selecting an LGA
  updates the actual Explore directory LGA filter and moves the map camera
  to that LGA's **boundary-derived bounding extent**. Clearing returns to the
  entire state; manual LGA changes also update the map.
- The camera extents are fixed lightweight reference values computed directly
  from the pinned data/grid3/lga.json polygons, without remote geocoding or
  invented point locations. Source attribution is visible in the map UI.
- Searching an unrecognized name clearly says that town/village search is
  not available yet. This does not falsely claim mapped settlements.
- The map continues to pin **only reviewed, public directory records** with
  reviewed coordinates. Source-confirmed-only examples and private incident
  reports do not become map pins or official cases.
- All 16 source boundary extents are verified in a Node test against the
  actual local GeoJSON. Browser tests exercise map opt-in, keyboard search,
  selection/reset, punctuation aliases, unavailable names, mobile widths and
  dark theme.

## Dataset attribution
Existing source: GRID3 Nigeria Operational LGA Boundaries, 2020,
eHealth Africa / Proxy Logics, CC BY 4.0.
https://grid3.org/geospatial-data-nigeria

## Explicitly not yet done (issue #53)
- Nation-wide 2020 GRID3 named-settlement points download and pinned checksum.
- Spatial clip of exact named points to Ekiti PostGIS polygons and duplicate
  or boundary ambiguity human review.
- Full gazetteer of towns, villages and neighborhoods.
- Ward boundaries and settlement point labels at appropriate map zoom.
- Map pin publication for any private report or unreviewed listing.
- Offline tile basemap, field-verified business geocoding or emergency dispatch.

GRID3 publishes 2020 settlement names under CC BY 4.0 and 2026 settlement
extents v4.1 under CC BY-SA 4.0, which is a **different dataset and license**.
Do not merge or imply town names from shape extents alone.

## Release
Source-only change. Gate merge on both citizen and admin CI, then test a
guest staging deploy on the integration branch via the existing authenticated
operator-only script and exact build manifest smoke tests. Do not update
production main, Supabase schema or private feature switches here.
