# Ekiti Civic — Map-led agency operations design reference

**Design decision:** Owner supplied `code.html`, `DESIGN.md` and desktop screenshot of the Logistics Pro map + table dashboard on 11 Nov 2026. This document translates the *visual language* into an Ekiti-specific operating workspace without copying its shipping product semantics.

## Adaptation in this change

- Pale desktop sidebar, strong black selected destination, desktop header with a functional case search field, alert shortcut and demo status.
- Interactive **MapLibre** state map left, not a static Chicago image. It uses the repository's reviewed GRID3 16 LGA polygons and deliberately **never plots sample private case coordinates**. Existing source attribution and clickable 16-LGA list are preserved.
- Two purposeful signals right of map: **open platform cases** and **internal escalations**; both are calculated from in-memory fictional cases. No fabricated percentages, emergency response time, delivery receipts or official acknowledgements.
- Wide, scannable reports table below map: case label/reference, LGA, priority, independent-platform status, unverified agency receipt and a real navigation action that opens the selected sample case.
- Functional search, native area/queue selectors, filter reset, table row navigation and existing in-memory platform-only actions, private/no-production disclosures, alert filters and opt-in sound test.
- Natural mobile layout: sidebar becomes four bottom destinations, map and signals stack, tables can horizontally scroll within their own region, keyboard/touch accessible controls. Automated 280/1440px checks added.
- Reused existing routing/moderation modules and existing security boundaries. The dedicated authenticated staff workspace is **not** replaced by a demo.

## Before this can become a real emergency/agency dashboard

1. Reconcile private citizen/admin SQL roles and put report/evidence services behind verified operator, consent and retention processes. The public guest Worker must not have unrestricted case reads.
2. Serve **role-scoped private GeoJSON** only from an independently authenticated, MFA-protected agency API after mandatory verified jurisdiction and approval. Exact incident coordinates, sensitive evidence and reporter identities require need-to-know limits, explicit access audits, minimum accuracy and expiry. The public map remains generalized and moderated.
3. Agency accounts must map to an **independently verified office registry** and allowable category/LGA/ward jurisdiction; never trust browser-supplied scope or a mock select.
4. True incident stream requires event transport or bounded polling, visible last-updated/offline indicators, replay/deduplication, alert consent and on-call escalation. Render **verified** timestamps, not invented 'live' badges.
5. Office action buttons must call an authorized server transaction recording who **delivered**, **read**, **acknowledged**, **requested information**, or **updated** the case with proof, timestamp and audit, with irreversible distinctions. A platform action alone cannot imply agency receipt.
6. Evidence should be virus-scanned, encrypted and restricted; automatic public pin or media disclosure is forbidden. Emergency display must not be marketed as actual dispatch until an agency is connected.

## Implementation reality

This PR modifies only the publicly accessible **fictional admin demo** and its browser tests. Its publication to `ekiti-admin-demo-staging` is a preview and does not enable any private intake or office account. The owner can later approve an authenticated pilot following #42, #43 and the search-first product contract #45. MapLibre remains an existing free/open-source map engine; a Leaflet-only requirement should be handled via a deliberate migration with equivalent keyboard, geometry and security tests, not by adding a second mapping library merely for branding.
