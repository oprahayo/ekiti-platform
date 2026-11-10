# Milestone 01 — Geographic foundation

This is an engineering milestone, **not** a working civic report intake site.

## Scope

1. Audit authoritative 16-LGA and 177-ward name records and import them with stable IDs and provenance.
2. Inventory, license-check, validate and import geographic boundaries. Record any coverage gaps.
3. Resolve incident coordinates to levels independently; expose conflicts, ambiguity and unmapped levels.
4. Keep device location optional and distinct from incident location.
5. Build a mobile-first searchable list picker, then an optional progressively loaded map.
6. Implement verified RPC access via server-only credentials and proper permissions.
7. Automated unit tests, real PostGIS integration tests, and accessible browser checks.
8. Document no-official-affiliation notice and privacy requirements before public intake.

## Implementation status

- [x] Domain resolution contract and deterministic reconciliation tests
- [x] SQL migration for geo tables, verified geometry candidates, quarantine
- [x] Provisional name checklist for 16 LGAs (not certified)
- [x] Optional local INEC import, required in CI. Verify the 177 registration-area names and their 16 LGA parents from the pinned official PDF
- [x] Audit the GRID3 state, LGA and operational ward releases and record license terms
- [x] Verified state and LGA imports, restricted server resolver and PostGIS integration tests
- [ ] Verified electoral ward geometry and operational-to-electoral crosswalk
- [x] Read-only Worker area and resolution endpoints, rate limits and reader permissions
- [x] Mobile-first location picker, optional GPS and MapLibre boundary map with browser checks
- [ ] Deployment / staging validation

The picker keeps a manual selection visible when ward geometry is unavailable or a border match is ambiguous. Device GPS requires separate incident confirmation.

No application should claim geographic coverage is complete until the boundary audit proves it.
