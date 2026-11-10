# Geographic source audit — 2026-11-10

**Issue:** #1  
**State:** preliminary inventory; NOT approved for production or geometry import.

## Findings

1. Ekiti State Independent Electoral Commission (EKSIEC) documents **16 LGAs and 177 electoral wards**. It does not, on the reviewed page, supply a downloadable, reconciled ward polygon file or a ready-to-import full ward name list.
   - https://www.ekitistate.gov.ng/executive-council/mdas/ekiti-state-independent-electoral-commission-siec

2. The state's LGA/LCDA directory labels one LGA **AYEKIRE**, while our provisional seed uses **Gbonyin**. Its About Ekiti page uses **Aiyekire**. All three strings must be treated as **candidate aliases pending record reconciliation**, not silently overwritten in geospatial joins.
   - https://www.ekitistate.gov.ng/about-ekiti/local-government
   - https://www.ekitistate.gov.ng/about-ekiti
   - Our provisional file: `db/seeds/0001_ekiti_lgas.sql`

3. GRID3's official Nigeria data page lists **Operational Wards v4.0 (October 2026)**, **Operational LGA Boundaries (December 2020)**, and **Operational State Boundaries (December 2020)**.
   - https://grid3.org/geospatial-data-nigeria
   - https://data.grid3.org/datasets/GRID3::grid3-nga-operational-wards-v4-0/about

4. GRID3 Operational Wards v3.0 explicitly covers **24 states, excluding Ekiti**. Therefore v3.0 must not be mistaken for adequate current Ekiti ward coverage. GRID3 v4.0 Ekiti polygon coverage remains **UNVERIFIED until the actual dataset is downloaded and counted**.
   - https://www.arcgis.com/home/item.html?id=45cd2ef592094d12aca43113a90a6054
   - https://data.grid3.org/

5. Earlier GRID3 Nigeria ward-boundary data advertised **countrywide** operational wards under **CC BY 4.0**. This is a fallback candidate only. The 2026 v3.0 dataset uses **CC BY-SA 4.0**; permissions for v4.0 must be read from its *own* metadata rather than inferred.
   - https://www.arcgis.com/home/item.html?id=8ae3ea88e5874ba49008265235000d10
   - https://www.arcgis.com/home/item.html?id=45cd2ef592094d12aca43113a90a6054

## Import gates — do not skip

- [ ] Obtain full current official ward name/code reference and verify all 177 with parent LGAs.
- [ ] Download GRID3 v4.0 archive; inspect actual Ekiti records, schema, CRS, license, and release date.
- [ ] Compare old and new LGA names (Ayekire/Aiyekire/Gbonyin), preserve aliases, and document the effective source.
- [ ] Audit polygon validity, topology, overlaps, gaps, coverage and mismatched parent LGAs.
- [ ] Check each source's redistribution rules and attribution.
- [ ] Import as `unverified` until data quality gates pass; never guess ward from approximate place names.
- [ ] Publish a reproducible coverage summary: name completeness is distinct from geometry completeness.

## Decision now

The project may proceed with the **16-LGA draft list and exploratory dataset downloads** while keeping spatial results provisional. No ward boundary count, successful ward lookup, or full geographic coverage is claimed yet.
