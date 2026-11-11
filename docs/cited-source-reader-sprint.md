# Search and conversation refinement — staging source implementation

## UX
- Inner header uses one flexible pill form and a genuinely borderless native search input. This fixes the extra inner rectangle caused by the higher-specificity global input rules, without altering the global controls.
- Report conversation shows current step, an unobtrusive progress line, responsive message entrances, tactile choice feedback and existing optional, user-enabled sounds. Motion disabled under `prefers-reduced-motion`.
- The tracking demo explains how case tracking would work, with a short, clearly local-only simulated typing state. It still never searches or confirms a real report.
- Nine original SVG product illustrations (eight in the launcher plus a web icon) retain a shared geometric language, local assets only, and theme-dependent colors.

## Reviewed-first sourced search
1. Existing `GET /api/search` results are still rendered above the external section in the **All results** tab.
2. The user may explicitly click **Read sources & explain**. This calls `GET /api/web-answer?q=...&lang=en|yo` with no case text or other private data. It uses the same query restrictions as the existing external search (no e-mail, phone or obvious incident narrative); has strict method/origin/length checks, uses the existing rate limiter, returns `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
3. The Worker first reads published **public** Ekiti Civic knowledge/business data through the existing guarded `searchReviewedEkiti` reader. Failed public DB search is treated as unavailable and does not produce fictional records.
4. It discovers up to eight references using optional Brave Search or the no-key Wikimedia search. At most three civic citations, then four external citations, are deduplicated by exact HTTPS URL.
5. It makes at most two **short, robots-aware** public HTML page retrieval attempts per click, and only for a fixed set of approved hosts (Ekiti government, Wikipedia, Premium Times, Channels TV, TheCable), with no redirects, direct IP targets, custom ports, credentials, query-string tracking URLs, script execution or media download. A failed robots check means no page reading. The rest are attributed provider snippets, not full-page crawls. Site owner terms and current API permissions must be reviewed before wider rollout.
6. The default response shows short original-source excerpts as such and displays numbered clickable citations, with Ekiti Civic material first. It explicitly says this is not generative AI.
7. An optional OpenAI Responses API branch can generate **up to three short claims** in English or Yoruba from the limited source excerpts. It requires **all** `GROUNDED_AI_ENABLED=true`, a Worker secret `OPENAI_API_KEY`, and an explicitly configured `SEARCH_ANSWER_MODEL`. `store:false`, `tools:[]`, structured JSON claims and strict citation-ID validation are used. Invalid, unavailable or uncited model responses fall back to source excerpts. This remains disabled in the guest staging generator; no secret is needed for the default path.

## Controls and limitations
- Source snippets and even linked model claims can be inaccurate. This is a constrained, public-information tool; it does not independently fact-check every statement, guarantee complete crawling, offer Google’s index, or produce verified real-time updates.
- Do not access paywalled, private/social account, user report, live GPS, government dispatch, moderation, staff or account data through this path.
- A public web model call will send the clicked **public** search term and selected public excerpts to the selected configured provider. Product copy must keep the opt-in action and privacy disclosure.
- No paid AI service is switched on by code merge. Review provider costs, licenses/robots, per-IP abuse limits, multilingual source quality, retained data, citation fidelity, SSRF boundaries and provenance before activating.
- Existing private `REPORTING_ENABLED`, `EVIDENCE_ENABLED`, `NEARBY_DIRECTORY_ENABLED`, `NEARBY_DIRECTORY_REVIEWED` remain disabled in the staging script. This is not a government reporting service.
- This is a source-only change. The branch alone is not deployed; CI and staging SHA smoke checks must run first. Keep production `main` out of release.

## Verification
`npm run test:all`, `npm run test:browser` (Playwright), `npm run staging:check`, and relevant staging smoke tests. New Node tests cover bounded queries, citation priority, URL allowlist, robots rules, HTML sanitizing, structured AI citation validation and feature gates. Browser tests cover the single-search-surface look across seven widths, explicit source-action clicks, citation order, unique SVG marks and the report progress state.

## References
- Existing architecture: `docs/external-web-search-architecture.md`
- Prior change: PR #54 and #55; AI-mode tracked in issue #56.
- OpenAI Responses API: https://developers.openai.com/api/reference/resources/responses/methods/create
- Wikimedia API: https://www.mediawiki.org/wiki/API:REST_API/Reference
