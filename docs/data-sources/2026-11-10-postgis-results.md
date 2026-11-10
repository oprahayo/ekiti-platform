# Ekiti geographic coverage, 10 November 2026

| Level | Reference names imported | Verified polygons | Resolution source |
|---|---:|---:|---|
| State | 1 | 1 | GRID3 2020 operational state boundary |
| LGA | 16 | 16 | GRID3 2020 operational LGA boundaries |
| Electoral ward | 177 | 0 | INEC registration-area names only |

The GRID3 layer 0 responses contain 1 state and 16 LGA features in native EPSG:4326. All are nonempty valid polygons. Against the independent state layer, PostGIS measured 0 m² uncovered, 0 m² beyond the state and 0 m² of pairwise LGA overlap. These measurements describe agreement within this release. The attached extracts retain the GRID3 uniq_id, lgacode or statecode, and source names. Run scripts/coverage.sql after import to reproduce the totals. [Extracts, attribution and terms](../../data/grid3/README.md)

The INEC Ekiti registration-area directory lists 177 distinct parent/name pairs. The importer preserves each RA spelling, including punctuation, and keys it by the serial number in this exact document. Serial numbers are document references, distinct from polling-unit or official ward codes. The document gives no release date or redistribution license. The importer reads a locally acquired, digest-checked copy. The original PDF and collection-centre locations are excluded from the repository. The state commission and INEC both corroborate the expected total. [INEC directory](https://inecnigeria.org/documents/resources/rac/EKITI.pdf) · [State electoral commission](https://www.ekitistate.gov.ng/executive-council/mdas/ekiti-state-independent-electoral-commission-siec)

The INEC directory uses ADO, GBOYIN and IREPODUN where GRID3 uses Ado-Ekiti, Gbonyin and Irepodun/Ifelodun. The importer explicitly maps these parent labels within the 16-LGA checklist. The 2015 INEC directory uses Gbonyin. The state directory's Ayekire and the About Ekiti page's Aiyekire remain candidate aliases. GRID3 codes and INEC serials are source-specific and must not be joined by ordinal position. [INEC 2015 directory](https://wp1.inecnigeria.org/wp-content/uploads/2019/02/PU_Directory_Revised_January_2015_Ekiti.pdf) · [Earlier alias audit](2026-11-10-ekiti-geography-audit.md)

## Import and coverage checks

Acquire the INEC PDF from the directory URL above. The reviewed version has SHA-256 `7af4fe924412edd4107a3bfc48e405999889a9a637f53d831d6e9fcceb632eba`. Maintainers can supply a matching local copy through `--inec-pdf`. CI retrieves the PDF directly, runs the same parser and import twice, and checks the ordered database rows against a reviewed fingerprint. A publisher revision requires review before changing either fingerprint.

The GRID3 gate checks the expected state and all 16 LGA IDs against their release-specific source record IDs, area kinds and parents. Every staged geometry must match its reviewed input. Quarantine entries from either reviewed GRID3 source, disputed areas and rejected boundaries stop promotion. The allowed uncovered area, area beyond the state and pairwise LGA overlap are each 0 m² for this snapshot. The gate runs before promotion within the import transaction. A failure rolls back the batch including any new quarantine rows, and psql reports the reason. Running scripts/coverage.sql separately rechecks the stored manifest, verification states, quarantine and topology. Electoral wards may still have zero verified polygons.

## Operational wards

The CIESIN v4.0 service returned 174 Ekiti features in EPSG:4326. All passed PostGIS validity checks. Efon has 9 operational features for 10 electoral names. Ekiti South-West has 9 for 11. Counts agree in the other 14 LGAs, but even equal counts can mask different identities. For example, INEC names Efon's wards EFON I through EFON X, while GRID3 uses local names including Idagba/Apare. No official identifier crosswalk was established.

Against the 2020 GRID3 parent boundaries, 136 of 174 features extend beyond their named parent by some amount. The valid ward union leaves 13,337,845 m² of the state uncovered and extends 4,993,077 m² beyond it. Two pairs have positive-area intersections (both under 0.001 m²). The releases differ in vintage and methodology. These measurements do not establish electoral boundary changes. No electoral polygons were promoted. No town or settlement dataset has been verified or imported.

The following reproduces the read-only audit after the GRID3 and INEC imports. The download selects Ekiti from layer 0, with native precision, and the audit checks the recorded digest before loading temporary tables.

```sh
curl -fLsS 'https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_operational_wards_v4_0/FeatureServer/0/query' -G \
  --data-urlencode "where=state='Ekiti'" --data 'outFields=OBJECTID,lga,ward,state&f=geojson&outSR=4326' > /tmp/ekiti-v4.json
python3 scripts/audit_wards.py /tmp/ekiti-v4.json
```

CIESIN, Columbia University (2026), GRID3 NGA – Operational Wards v4.0. New York, Columbia University. Acquired 10 November 2026. Copyright 2026 The Trustees of Columbia University in the City of New York. The three transaction-only test features retain the release's attribution and share-alike terms. [Publisher metadata](https://www.arcgis.com/home/item.html?id=74cf76766bec4481aa03523e0e1fdddc) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
