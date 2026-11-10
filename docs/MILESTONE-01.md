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

## Current starter status

- [x] Domain resolution contract and deterministic reconciliation tests
- [x] SQL migration for geo tables, verified geometry candidates, quarantine
- [x] Provisional name checklist for 16 LGAs (not certified)
- [ ] Authoritative ward reference list
- [ ] Legal/geographic source inventory and license audit
- [ ] Verified boundary imports and PostGIS integration tests
- [ ] Full HTTP endpoint, rate limits and permissions
- [ ] Location picker / optional map UI
- [ ] Deployment / staging validation

No application should claim geographic coverage is complete until the boundary audit proves it.
