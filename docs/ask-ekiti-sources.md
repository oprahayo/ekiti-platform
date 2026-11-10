# Ask Ekiti — source-first conversational service

Status: **implemented in staging code, not a general-purpose LLM**.
Updated: 10 November 2026.

## Product direction

Home: **Welcome to Ekiti Civic** / **Your mobile gateway to Ekiti State**, a compact animated Ask bar and the existing Report/Explore rows. One-tap dark/light theme. Language switch **English / Yorùbá**. Independent, text-first service. The lowercase wordmark colors the final i dot red without copying the protected state seal.

Ask: conversation-style question/answer, direct citations with publisher and publication date, text-to-speech playback, opt-in browser speech recognition in `en-NG` or `yo-NG`. Messages are kept in page memory rather than written to a reporting database. The server handles bounded `POST /api/ask` only.

No paid key, LLM API, or generative model is installed. A deterministic, reviewed-source retrieval service answers only supported topics and says when there is no verified answer. **A free source search is not equivalent to ChatGPT-like unrestricted reasoning.** Even self-hosted open-weight models have compute, maintenance, bandwidth and abuse-control costs. We should validate usefulness of factual, cited answers first, then separately evaluate small local models or genuinely sustainable inference grants before describing the experience as general AI.

## Source inventory and access policy

| Priority | Resource | Evidence available | Refresh and ingestion |
|---|---|---|---|
| 1 | [Ekiti official press releases](https://www.ekitistate.gov.ng/archives/category/press-releases) | Dated official releases, e.g. 3 Nov 2026 advisers appointment | Try the [official WordPress feed](https://www.ekitistate.gov.ng/feed/) and category feed on **news questions only**, allowlist exact hostname and HTTPS, 2.8s budget each and 160KB maximum; cache successful or unsuccessful checks in the Worker isolate for 15 minutes. If unavailable, show the dated fallback and an explicit freshness warning |
| 1 | [Ekiti ministries and agency directory](https://www.ekitistate.gov.ng/mdas-directory) | Official MDA list, email contact addresses and office links | Curated reviewed facts; recheck monthly. Do not invent telephone numbers, emergency lines or opening times |
| 1 | [Ekiti Finance & Budget](https://www.ekitistate.gov.ng/finance-budget) | Citizens budgets in **English and Yoruba**, quarterly implementation reports, approvals and audit reports | Structured publication links; extract figures only from the exact published report with a cited page and date; review new releases monthly |
| 1 | [Ekiti government overview](https://www.ekitistate.gov.ng/) | State administration, ministries, culture and tourism references | Curated summary; recheck monthly |
| 1 | [INEC administrative source](https://inecnigeria.org/documents/resources/rac/EKITI.pdf) | Election/reference ward names already reviewed in the project | Exact-file SHA and canonical local crosswalk; keep 16 LGAs and 177 ward names, **do not invent ward boundaries** |
| 2 | [Federal education public dashboard](https://emis.education.gov.ng/) | Education dashboards and public census references | Review links and specific indicators; no broad scrape or unsupported school status |
| 2 | [Nigeria NBS](https://www.nigerianstat.gov.ng/) | Published statistical datasets and surveys | Manual provenance checks, data-year labels, method notes and state filters before any numeric answer |
| Evaluation only | [Ekiti Bureau of Statistics StatCloud](https://www.ekitistate.gov.ng/ekiti-state-bureau-of-statistics-statcloud) | State statistics portal claims and downloadable datasets | **Do not** import unverified dashboard numbers without corroborating dataset files and sampling methods |
| Future, conditional | [Nigeria NiMet API](https://nimet.gov.ng/weatherapi.php) | Weather data feeds | Requires API key; do **not** claim it is a free keyless source or put its credentials into client code |

All sources remain attributed to their publishers. An official government claim is *a claim by that publisher*, not independent confirmation. For breaking/contested news, later pair with an independent reporting source with its date and publisher; distinguish allegations from facts. Respect robots.txt, usage terms, rate limits, copyrights and image/data licenses. No arbitrary internet crawling from citizen chat inputs and no downloading entire websites for one query. Never embed remote page HTML in the chat; only plain text and safe outbound links.

### Two-language strategy

- Answers and interface are in selected English or Yorùbá; curated Yoruba templates exist only for supported topics. Original English news headlines stay in English rather than being inaccurately machine translated.
- Browser speech recognition sets `en-NG` / `yo-NG`; speech recognition may send voice data to the browser provider and Yoruba support varies by device.
- Browser speech synthesis plays the actual response only when initiated by the user. For Yorùbá, require an available `yo` voice; if absent, say so rather than play incomprehensible English pronunciation.
- Future optional specialized Yoruba providers (e.g. Naija Speech) may offer a free API key, but still require an external account, reliability review, rate limit, privacy assessment and explicit approval. They are **not** a production dependency.

## Current answer limits

**Implemented topics:** official news recency, LGAs/ward provenance, state budgets, MDA/Works contact reference, health and education agency directories, and tourism information. Unknown, commercial, precise-nearby, political predictions and claims about events occurring *today* without a dated update are declined with source guidance. News RSS access may fail or be blocked by the publisher; a fallback clearly states this. No model can answer arbitrary chat or maintain genuine multi-turn reasoning in this version.

**Not implemented:** unrestricted AI inference, crawling all Nigerian sites, automatic translation of every fetched page, verified local club/hotel opening times, location-aware nearby businesses, user accounts, report submissions, or a continuously indexed national data warehouse.

## Privacy and security

The endpoint is same-origin, rate-limited, POST-only and no-store. Request bodies are byte-bounded and contain only question + language. Queries are not stored in Supabase, sent to search companies or logged intentionally by this code. Cloudflare/network infrastructure may retain operational logs according to account settings; review those before public launch. Source URLs are fixed and allowlisted; no user-supplied URLs are fetched. No credentials, paid tokens or third-party model keys are required.

Future ingestion should run as a scheduled, audited task (daily press-release metadata; monthly MDA and budget documents) with deduplication by canonical URL/hash, per-publisher licensing, source publication time, retrieval time, corrections, deletion and a monitoring dashboard. Build this separately from live conversations and test it against malformed feeds, poisoned sources, stale records, attribution failure and false freshness.

## Release gate

Run `npm run test:all`, `npm run staging:check`, browser tests against PostGIS and source responses, then smoke-test staging after deployment. Verify Yoruba copy with native speakers, real Android and iOS microphone support and available TTS voices. Do not call this a fully autonomous AI assistant until an actual evaluated inference system is integrated.
