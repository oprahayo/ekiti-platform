# Ekiti extracts of GRID3 operational boundaries

eHealth Africa and Proxy Logics (2020), Nigeria Operational State Boundaries and Nigeria Operational Local Government Area Boundaries, Geo-Referenced Infrastructure and Demographic Data for Development (GRID3). Both extracts retain the [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).

Acquired 2026-11-10 from the [state item](https://www.arcgis.com/home/item.html?id=c41532b720504f4799fe20438b7e3b7f) and [LGA item](https://www.arcgis.com/home/item.html?id=2bb616a49ee84f409427cc2143787113). Changes consist of selecting Ekiti features and identification fields, and requesting GeoJSON in EPSG:4326. The services' native CRS is EPSG:4326.

To reproduce, query layer 0 of the item’s FeatureServer at /query with where=statename='Ekiti', f=geojson, outSR=4326 and outFields=statename,statecode,uniq_id (state) or lganame,lgacode,statename,uniq_id (LGA). The importer pins the reviewed responses by SHA-256.
