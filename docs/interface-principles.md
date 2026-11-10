# Interface principles — Ekiti Civic (independent)

This decision applies to the public-facing interface until explicitly revised.

1. **Mobile is the default.** Author the narrow screen first. The initial view must answer what works today and let someone begin the primary task. Test 280, 320, 360, 375, 390 and 428px widths before desktop enhancements.
2. **Prefer content over containers.** Do not default to cards, colorful chips, badges, stacked status pills, circular illustrations, hero art, or floating dashboard statistics. Use typography, alignment, whitespace and quiet dividing rules. Business/place directories should begin as scannable rows and a purposeful map, not card grids.
3. **One clear primary action.** Visible actions must work, never be theatrical placeholders. Prefer a short title, a sentence, and an actionable control.
4. **Independent identity.** Never use the official Ekiti State Government seal/logo without appropriate authorization or imply an official government relationship. Colors may reference the public landscape motifs (vegetation green, sunrise gold, water blue, earth/ribbon red), with accessible contrast, but the brand is original.
5. **Accessible, resilient forms.** Use native elements, keyboard navigation, labels, 44px minimum tap targets and visible focus. Choose native selects for 16 LGAs and per-LGA ward lists; don't force a filter input paired with every selector. Provide readable errors and retry paths.
6. **Progressive disclosure.** Keep optional GPS, coordinates, large maps and advanced options behind a clear invitation. No location request without consent; never send the chosen point before explicit confirmation.
7. **Truth over demos.** The staging report tool currently downloads a private local text file only. Do not claim that it submits complaints, notifies agencies, generates case IDs or tracks cases. When those capabilities exist, they require real backend receipts and authoritative events.
8. **Low-data by default.** Avoid external font requests and initial interactive-map JS. Review map bundle weight, minimize round trips and test slow network conditions.
9. **Trust and safety.** Be clear about government independence and about personal data, retention and sharing. Don't use personal data in UI samples.
10. **Release gates.** Each major UI change gets source review, multi-viewport Chromium interaction checks, keyboard/focus checks, accessibility review and a real-device validation plan. CI green is required before merge. Physical Android/iPhone reviews are still needed before production.

Design audit baseline: [10 November 2026](ux-audit-2026-11-10.md).
