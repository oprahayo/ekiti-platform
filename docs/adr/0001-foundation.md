# ADR-0001 — Modular foundation and geographic trust

**Status:** Accepted as implementation baseline; deployed behavior remains unverified.

- One TypeScript application, React Router intended for the full user interface after core geography contracts are tested.
- PostgreSQL/PostGIS stores audited administrative geometries and provenance.
- Geometry matching must be deterministic and use only validated verified polygons.
- Database operations will be through narrowly granted server-side functions.
- Browser may request optional device GPS access but must confirm incident location independently.
- Public safety and government-office status must not be guessed by models.
- First project phase is an internal pilot: no fake chat assistant or official case handling.
- Use pre-existing public community channels (@inekitiofficial), while product name remains undecided.
