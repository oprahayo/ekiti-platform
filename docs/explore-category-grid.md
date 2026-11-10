# Explore Ekiti — illustrated Yellow Pages categories

Status: UI implemented and tested in GitHub. Cloudflare staging is a **separate deployment**; the production directory is **not populated or activated**.

## Reference and intent

The owner supplied a phone screenshot showing a centered pin mark, a friendly "Browse Categories" heading, one large search input, and a three-column grid with thick illustrated trade pictograms. The new Explore screen follows that interaction and layout while retaining the independent Ekiti Civic logo, red i-dot identity, one-tap dark/light mode, and mobile bottom navigation. These are new original inline SVG icons, not copies of the reference artwork or external image files.

The page has **24 category tiles** in three columns, including all twelve trades in the visual reference (plumbers, hairdressers, carpenters/joiners, electricians, cleaners, painters, locksmiths, movers, gardeners, mechanics, builders, roofers). Twelve additional Ekiti-specific categories include hotels, restaurants, hospitals, schools, nightlife, public offices, transport, markets, tourism, agriculture, banking, and more services. Each category has an illustrated black-outline pictogram and yellow accents.

## Behavior

- Users can search for a category by common terms, e.g., "plumber" or "school"; clicking a category reveals the appropriate results section and a clearly labeled way back to all categories.
- An LGA selector covers all 16 verified Ekiti LGAs. Search and category state survive navigation between tabs; conversational Ask can open "Hotels" preselected in Ido/Osi.
- Initial loading displays the category grid only. Business database requests begin when a category, search query or LGA filter is selected.
- The existing read-only `GET /api/places` and `GET /api/places/:uuid` endpoints supply only reviewed, published listings **after the previously prepared SQL migration is approved and applied**. Currently unsupported fine-grained trade categories show an honest empty state rather than displaying unrelated records from the broad `Other` category.
- Existing fictitious place fixtures appear **only** in an explicitly marked "Sample layout preview · Not verified", never as recommended real hotels, schools or clinics.
- A reviewed place detail can display its independently attributed source and available contact information. A Google Maps directions link exists only if the backend returned reviewed latitude and longitude. No invented pins, distance, travel time or "open now" claims.
- Optional LGA map stays lazy-loaded and is not confused with real business locations. Listing registration, owner claims, images and reviews remain separate moderation/authentication milestones.

## Design guardrails

- **Three columns across all phone widths**, with touch targets at least 44px. Tile dimensions adapt at 280, 320, 360, 375, 390, 428 and wider widths.
- Original inline SVG drawings, local CSS only; no remote fonts, stock imagery, API keys, or paid image/icon licensing.
- Responsive 2-line category names, readable contrast and visible keyboard focus. Reduced-motion setting is honored.
- No visual category grid on the Home/Ask screen. The grid belongs exclusively inside Explore; results continue using scannable text rows.
- No automated publication of unverified imports, duplicate business claims or contact information obtained without permission.

## Release checks

```sh
npm ci
npm run test:all
npm run staging:check
npm run test:browser
```

Browser tests cover 24 unique icon tiles, first-row three-column geometry, responsive overflow/tap targets, typeahead-style filtering, LGA preservation, Ask-to-directory routing, intentionally empty categories, unavailable-directory fallbacks, reviewed-place source links, verified-coordinate-only Google Maps directions, and dark/light rendering.

**Do not run `db/migrations/0004_knowledge_directory.sql` on Supabase without explicit review and approval.** The new UI is safe to publish before listings are activated, but must communicate that the directory has not been populated.
