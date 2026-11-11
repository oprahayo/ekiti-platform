# Ekiti Civic — Revised delivery roadmap (11 November 2026)

> **Product target updated later on 11 November 2026:** The [search-first product contract](search-first-product-contract.md) supersedes older visual assumptions in this historical sprint roadmap. Continue the delivered backend foundations; deliver a unified public search, independently responsive desktop/mobile UI, vetted service directory, intelligent geo-resolution, media reporting, moderated public incident map and verified office action logs. Old category-first/homepage and routine LGA/questionnaire designs are **not final acceptance criteria**. Sprint numbering below is historical planning, not evidence of release readiness.


**Repository:** `oprahayo/ekiti-platform` (React/Vite + Cloudflare Worker + private PostGIS proposals). This is not the separate Next.js EkiSignal demonstration.

**Product goal:** Bridge the communication gap between Ekiti residents and the right public offices. Make residents' voices count, with traceable private reporting and reviewed public accountability. Do not create a generic chatbot or social-media forum.

## Changes agreed after Sprint 01 review

1. **Keep the existing header completely unchanged.** Home opens with only “Welcome to Ekiti Civic” and “Your mobile gateway to Ekiti State.” The heading and subtitle sit close together; there is a clear gap before “What would you like to do?”
2. **Five small, icon-led actions**: Report an issue, Give feedback, Ask about Ekiti, Explore Ekiti, Post a listing. Remove “Community post” and the unauthorised forum concept, including its route. No social feed, comments, likes, followers or post creation without a separate product decision.
3. **Report is a conversational guide, not a second dashboard.** No decorative “E” avatar, duplicate title, “step-by-step private preview” banner or redundant Start Over header. Show a brief welcome message, context-aware options, text capture and clear privacy status.
4. **Engagement**: brief typing animation, gentle send/receive sound only after explicit enablement, reduced-motion and mute preferences. Emergency guidance must not be artificially delayed. Never describe a rules-driven workflow as sentient or a human conversation.
5. **Camera/audio/video**: residents can choose text, photo, video or audio; offer record-on-device or upload for video/audio. The current working browser recorder captures chunks **only in volatile local memory**. It does not preserve early chunks on the server, persist across tab crashes or dispatch emergencies.
6. **Location**: on first home visit, display a *clear, optional* “Use my location” request. Never call browser geolocation before a click. Only after consent, send coordinates to the existing `/api/resolve` verified boundary service, and match Ekiti LGA/ward if unambiguous. Store **no GPS coordinates** in sessionStorage/localStorage. If outside Ekiti, denied, ambiguous or unavailable, explain coverage and allow manual browsing. Never assume current GPS is the incident location.
7. **Explore**: drop Yellow Pages/book-branding language; use simple “Browse Categories” with compact tiles and search/Near Me on one row. Hide LGA selector under a manual override. Location filter is not an accurate nearest-distance search; only verified listings can be published.

## Revised 26-sprint sequence

| Sprint | Scope | Release evidence / dependency |
|---|---|---|
| **01 — Civic gateway refinement** | Five icon buttons, close-centred heading, header unchanged, compact Explore, optional location consent, minimal report chat | Responsive layout, permission, outside-coverage and accessibility tests |
| **02 — Trustworthy conversation engine** | Componentized question/answer state machine, editable backtracking, delayed responses, sound settings, offline draft recovery and multilingual templates | No duplicate answers, no accidental data loss, emergency guidance immediate |
| **03 — Detailed incident taxonomy** | Emergency/security/sanitation/water/roads/health/electricity and feedback subcategories, clear triage questions, potential duplicate prompts | Privacy-preserving category mapping and human review of high-risk reports |
| **04 — Privacy, consent and safeguarding** | Operator identity, independent-service disclosure, consent/retention policy, vulnerable person reporting, reporting threats, moderation controls | Written approval and retention/deletion verification *before any live intake* |
| **05 — Secure incident intake** | Dedicated private gateway, rate limiting, case ownership, verified location, idempotency, trustworthy one-time server reference and receipt secret | Cross-device committed case with no public leakage; gateway activated only after review |
| **06 — Reliable emergency evidence recording** | Live MediaRecorder capture, upload individual encrypted/authenticated chunks as recorded, per-chunk server acknowledgement, resume/retry, durable object storage, interrupted-session recovery and evidence access controls | Confirm **server-persisted chunks** during active recording; losing network must show unsaved segment warning. No “saved” status until server ACK |
| **07 — Geolocation and coverage** | Reusable opt-in GPS consent, verified boundary matching, incident point selection separate from device position, county/LGA/ward precision handling and override | Correct outside-Ekiti and boundary/ambiguous cases; never expose sensitive exact coordinates |
| **08 — Explore and category search** | Compact directory, reviewed locations, distances only where verified geocoded places exist, verified filters and manual LGA fallback | True nearby ranking backed by verified place geometry; clear empty/outside states |
| **09 — Citizen authentication** | Optional verified email/phone OTP, private account recovery, guest access and linked report history | Login/logout/recovery across devices; session security review |
| **10 — Verified SMS/email case links** | Contact verification, outbox/retry, short-lived one-time claim token and private tracking session | Delivered claim-link evidence, secure expiry/recovery; no downloadable receipt |
| **11 — My Reports / tracking** | Case timeline and contact-safe notifications, revisions, duplicates, status distinction | Resident sees same private case across devices without leaking identity |
| **12 — Admin identity and MFA** | Protected role-based admin login, invite-only staff accounts, LGA and office scopes and auditor logs | Default deny and least privilege proven in real database tests |
| **13 — Admin intake dashboard** | Queue, filters, evidence inspection, sensitive review, duplication handling and assignment proposals | No public data before explicit approval |
| **14 — Public map projection** | Moderated report titles/summaries, approximate locations, state map, filters, public statuses | Only redacted, deliberately approved reports appear publicly |
| **15 — Office registry and verification** | Verified Ekiti offices, ministries, wards and jurisdiction ownership | Evidence-backed office identity and responsibility |
| **16 — Routing and acknowledgement** | Suggested dispatch, secure delivery, verified receipt, reassignment and escalation | Suggested != delivered != viewed != acknowledged |
| **17 — Government handler portal** | Restricted official queue, timelines, official responses, attachments and decisions | Recorded actor, timestamps and office identity |
| **18 — Public case accountability** | Overdue clocks, verified resolution notes, reopen/appeal, public progress history and export | Status sourced from real auditable events |
| **19 — Business submission** | Moderated listings, claims, address review, categories and location | No automatically public unverified business |
| **20 — Directory ownership and reviews** | Verified owner claims, customer reviews, moderation, corrections and business management | Anti-fraud, review source verification, appeal process |
| **21 — Verified civic notices (not a forum)** | Publish approved agency notices and public-safety service information; no free-form social posting | Verified provenance, dates, correction/retraction trail |
| **22 — Ask about Ekiti** | Grounded civic Q&A in English/Yoruba, public service directory retrieval, traceable sources and uncertainty | No hallucinated official claims; citations and no unsupported decision-making |
| **23 — Transparency and recognition** | Public operating metrics, credible contribution recognition, verified donor reporting | Audited numerator/denominator, no fictional government scores |
| **24 — PWA/offline** | Reliable drafts, conflict handling, outage recovery, low-bandwidth flows and push preferences | Multi-device consistency and honest network/recording states |
| **25 — Accessibility, privacy and security review** | Accessibility, testing, external pentest, retention/deletion, recovery, backups and load | Vulnerabilities closed and data destruction verified |
| **26 — Controlled Ekiti pilot** | Single LGA/partner office pilot, operator training, support escalation, phased coverage expansion | Real office acknowledgement and public outcomes proven before 16-LGA launch |

## Hard gates and boundaries

- The current `src/server/private-report-routes.ts` remains **default-off**. Neither that API nor existing `db/proposals` should be activated against the live Supabase project without separate explicit operator approval.
- **Continuous live evidence saving** cannot be simulated by holding MediaRecorder chunks in memory. Build a private upload session, authorize and persist each chunk, verify acknowledgement, encrypt and restrict raw evidence, recover across connection drops, then run interrupted-device tests. Until this is operational, the citizen UI must clearly say recording is local-only and **not for emergency dispatch**.
- **Geo matching**: user location is optional and may not match the location of a report. The app can auto-filter Explore by confirmed LGA, but must not publish exact device or household location. A denied or outside-state user can still browse Ekiti and report something witnessed there.
- **No forum / social media** in this roadmap. The Community Post route is removed in Sprint 01 refinement and is not considered a planned feature.
- **No invented government participation**: platform intake, suggested handler, dispatch, verified office receipt, viewed, official response, resolved and publicly approved are separate auditable states.
- **Deployments**: merging GitHub PRs does not publish to Cloudflare. The approved local `staging:prepare`, Wrangler deployment and smoke-test workflow is still required. Do not change live Supabase, Wrangler secrets or stage deployments without authorisation.

## Next sprint criterion

Proceed to Sprint 02 only when Sprint 01 refinement passes typecheck, unit/privacy checks, disposable PostGIS, and Chromium mobile screenshots at 280px, 390px and desktop; then merge the verified PR. A staging deployment is a separate step.
