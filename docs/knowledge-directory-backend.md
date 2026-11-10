# Ekiti knowledge + directory backend — milestone foundation

Status: implemented in GitHub, **not applied to Supabase or deployed**.

## What is ready

- Schema `civic` with reviewed publisher sources, short cited knowledge summaries (English and optionally Yoruba), moderated places with optional contact/coordinates, private moderation queue and owner-claim requests.
- Public read functions are **SECURITY DEFINER** with bounded results and explicit `approved`/`published` gates. Existing `ekiti_location_reader` can call only read functions; it has no access to source, article, listing, claim or review tables.
- URLs: `GET /api/knowledge?q=bridge&limit=10`, `GET /api/places?category=Hotels&lga=ido-osi&q=guest&limit=20`, `GET /api/places/:uuid`. Parameterized read-only SQL and per-IP rate limits. Only approved records and reviewed coordinates/photos appear.
- The free and allowlisted metadata collector `node --experimental-strip-types scripts/collect-ekiti-feed-cli.mjs` writes a **local pending-review JSON file** to `data/review/` (never uploads or auto-approves). This fetches only official government RSS headlines, not full article bodies. It does not send any user questions to publishers.

## How information moves safely

1. Publisher/source is registered with canonical HTTPS origin, license/usage note and review status.
2. Allowlisted headlines/datasets are fetched with bounded time, bytes and daily quotas according to each publisher's policy; records enter review queue with URL, date, publisher, SHA fingerprint.
3. A reviewer checks accuracy and source terms, creates an original short summary, date, framing (`source_claim`, `independently_verified`, `allegation`, `opinion`) and optional Yoruba version.
4. Only after a human explicitly approves the content does it appear in public search; a government achievement claim stays attributed as that government's claim, not proof.
5. Community corrections and business owner claims are **private requests requiring authenticated moderation**; there is no public submission endpoint in this milestone.
6. Business listings do not automatically display phone numbers, photo assets or map directions without review and appropriate rights. Claims and imported entries stay independent—sourcing a place does not assert that its owner signed up.
7. For owner-supported location, a future authenticated flow must request precise GPS separately, confirm device permission, check LGA with PostGIS, and attach a provenance record. Exact GPS is not derived from unsourced web text.

## Source registry to review next

- Ekiti State Government official press-release category and RSS feed — official publication only.
- Ekiti MDAs directory and 2026 finance/budget publications, including English/Yoruba citizens' budgets.
- INEC verified 16-LGA and 177-ward naming reference (ward boundaries are not verified).
- Nigeria EMIS and National Bureau of Statistics public datasets, only with publication-year qualifiers.
- Business directories only after evaluating robots.txt, copyright, licensing and permitted reproduction.

The collector is **not a general crawler**. Adding an external source requires a reviewed allowlist and respect for site terms. Do not scrape personal information, store private conversations as public knowledge or reuse unlicensed photographs.

## Zero-paid-API model

Runs on existing Cloudflare Worker + Supabase PostgreSQL/PostGIS Free tiers, within rate, storage and bandwidth quotas. No OpenAI API, paid token or hosted inference is called. Retrieval and citation are not equivalent to arbitrary general-purpose generative AI.

## Before activation

- Approve the database migration in `db/migrations/0004_knowledge_directory.sql`, backup and apply it only to an isolated staging Supabase project; do not change the existing role/password or run unrelated migrations.
- Review publisher licenses, article/photograph rights, owner verification, claim abuse protection and deletion/correction controls.
- Seed **reviewed** source metadata, then review candidate articles and business records; do not populate any sample business as a real listing.
- Re-run GitHub CI (unit, PostGIS permissions and browser checks). Confirm SQL functions work as `ekiti_location_reader`. Later connect approved records to Explore, with sample fixtures still clearly labeled until replaced.
- Add scheduled collection/monitoring and authenticated reviewer/claim service in a separate, tested milestone.

No public claim intake, user credentials, content auto-publication or production deployment is performed by this PR.
