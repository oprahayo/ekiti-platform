# Source-backed Ekiti discovery examples (staging source milestone)

Date: 12 November 2026

## Problem addressed
The 3 source-linked examples added to Explore in PR #59 were not visible in
the main search result page. Their data was duplicated in a single page and
matching did not handle queries such as "hotels in Ikogosi".

## Implementation
- The tiny static catalog lives in src/app/sourced-examples.ts, and both
  Explore and unified /search use the same local matcher. No network request
  is necessary to display known source links.
- Six named public institutions/operators have explicit HTTPS source URLs,
  locality, broad category, original-source provenance and a 2026-11-12 site
  check date. They are intentionally source-confirmed-only.
- The results component uses simple accessible search rows and source links.
  It appears after reviewed SQL results and remains clearly labeled when the
  reviewed search API is unavailable. Matching reviewed entries suppress
  duplicate examples in search.
- Category and LGA filtering work in Explore. Named locality, category and
  institution queries work in unified search without pretending this is a
  comprehensive index.
- The local matcher rejects personal-looking email/phone queries and report
  narratives; it never calls a third party or publishes the user query.
- No sample is returned as an API reviewed record, has verified GPS, populates
  a map pin, receives a claimed-owner badge or changes the PostGIS review state.
- Existing fictional UI fixtures remain separate, as do private citizen
  reports, account records and government acknowledgements.

## Source evidence checked on 2026-11-12
- Federal Teaching Hospital, Ido-Ekiti — https://fethi.gov.ng/
- Ekiti State University Teaching Hospital — https://www.eksuth.org.ng/
- Ekiti State University — https://eksu.edu.ng/
- Federal University Oye-Ekiti — https://fuoye.edu.ng/
- Federal Polytechnic, Ado-Ekiti — https://fedpolyado.edu.ng/
- Ikogosi Warm Springs Resort — https://www.ikogosiresort.com/

Checking a website is not equivalent to legal identity, present operating
status, precise geocoding, business ownership or independent Ekiti Civic
verification. No such claims are made. A source could subsequently change.

## Future data promotion (not implemented)
An authorized reviewer must establish provenance, business identity and
location, consent where applicable, freshness and correction pathway, then
use the existing reviewed-directory moderation process to publish a record.
Only that separately approved PostGIS record may participate in reviewedOnly
results or verified nearby maps. Candidate metadata must not bypass
private moderation.

## Tests / release controls
- npm run test:all runs matching and provenance unit tests.
- npm run test:browser checks source links, review separation, deduplication,
  filters, offline state, mobile widths and dark appearance.
- CI must pass; stage on the integration branch only and verify the exact
  staging commit via existing smoke scripts after an authenticated Wrangler
  deploy. No production merge, DB migration or private reporting.
