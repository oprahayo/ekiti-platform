# Ekiti Civic — Search-first product contract
**Decision date:** 11 November 2026
**Sponsor/operator brand:** inEkiti Official (legal entity and public privacy contact require verification)
**Status:** User-approved product direction, **not** a claim of implemented functionality or agency partnership.
**Applies to:** Ekiti Civic citizen web/mobile, public directory/search, reporting, map, real administrative operations and API contracts.

## 1. Mission
Build an independent, intelligent **mobile gateway to Ekiti State** that bridges residents, small businesses/service providers, public knowledge, and accountable engagement with the correct public office. The public interface is a **search engine first**, with deep information, provenance and operational workflows behind it. Do not make the homepage look like an administrative dashboard, a card farm, a chat app clone or a phone interface stretched to desktop. Preserve existing services/code where compatible and finish functional milestones before superficial polish.

### Trust boundary
inEkiti Official is an **independent operator**, not Ekiti State Government. It may collect and moderate residents' submissions only after the private service is implemented, privacy/retention/identity work completed and tested. Neither the platform nor its AI can assert that a government office received, opened or acted on a report without attributable authenticated delivery/read/action evidence. In emergencies, provide verified direct contact details and do not promise dispatch.

## 2. Search-first desktop and mobile UX contract

### Shared mental model
One recognizable **Ekiti Civic** brand, one primary search field, and a small number of action links; the engine handles intent instead of forcing users through categories or LGA selectors. Main search examples:
- “Hotels near Ikogosi”
- “Churches in Ado Ekiti”
- “Find an electrician in my area”
- “Who handles bad roads in Ekiti?”
- “Bad road at Adebayo — report this”
- “What happened to my report EK-…?” (private receipt flow, not public query expansion)

### Desktop (not mobile blown up)
- Search landing: intentional centered content region with a calm logo/title, generous whitespace, **one wide search bar**, a short tagline and **small text-led actions**. Use responsive desktop typography, spacing and 100%-width content containers with a **desktop max-width**; do not display a narrow phone-width column as the only desktop composition.
- Search results: conventional scannable title/description/source list with filters and, when relevant, a separate contextual map/sidebar. Use the width meaningfully without filling it with cards or decorative statistic panels. Keyboard-first search, tab/focus, accessible autocomplete.
- Business/public service detail: factual name, address or verified area, category, opening details only where verified, contact/source, corrections/claim request. Reserve larger media only where it informs the visitor.
- Administration is a distinct professional workspace with usable tables, queue filters, side details, map and alerts—never a stretched citizen phone design.

### Mobile
- Minimal single-column, search-field-first page; large enough touch targets and keyboard safety, tight readable headings, no clutter. Keep small shortcuts (“Report”, “Explore map”, “List a business”, “Ask Ekiti”) secondary to search.
- Search results are compact readable rows with sources and controls; map is optional/on-demand, not required to use search.
- Reporting remains a short conversational flow on either viewport, not a multi-page bureaucracy.
- Test 280/320/360/375/390/428 and 768/1024/1440/1920 widths; no horizontal overflow, no desktop “giant mobile view”, no inaccessible fixed bars. Test real keyboard/mobile input, orientation, slow network, reduced motion and screen readers.

### Style
Use restraint, whitespace, legible typography, ordinary search/result patterns, accessible contrasts and Ekiti-inspired **independent** identity. Avoid generic AI-looking pill grids, brightly colored dashboards, huge cards, fake statistics and unnecessary illustrations. Do not copy Google branding or the official state-government logo.

## 3. Unified Ekiti discovery engine
- A public universal search spanning **verified business/services**, **hotel/accommodation**, **places of interest**, **places of worship**, **public services/offices**, **community/civic knowledge**, and **approved public case summaries**. A broad typed query can identify the likely intent or show grouped results.
- Providers can **submit or claim a business or service listing** for moderation. The first product is a directory of **businesses and services**, **not individual product catalogues or e-commerce inventory**. Listing fields: name, category, public location/area, safe contact, website/social where provided, description, source and verification/claim state.
- Filter/lookup by town, settlement, LGA and nearby area **without forcing administrative geography into the main search**. Use curated source-backed place aliases (including Yoruba spelling variants), normalized entities, verified map geometry and geocoded listing positions.
- Clear data provenance, update dates, independent vs official designation, verified/pending state, duplicate controls, corrections and appeals. Never display fictional sample data as real results.
- Intelligence: hybrid lexical/geographic retrieval plus evidence-grounded question answering in **English and Yoruba**; can learn from reviewed corrections, updated sources, approved data contributions and search analytics. **Never train itself to auto-publish unverified claims or alter office jurisdiction from free-text reports.** A question can produce a concise answer with source links and an uncertainty statement rather than fake confidence.
- Search API needs query intent, normalized entities/place, candidate scores, source/version, confidence, review state, privacy-safe telemetry, and a strict separation between public index and private citizen data.

## 4. Reporting: a simple smart conversation

### Entry and capture
- Primary question is “What would you like to report?” or “What happened?” and choice of **text, photo, video, audio, live audio recording, live video recording** where compatible and authorized. Enable browser camera/microphone **only on a deliberate user click**. Include actual capture timestamp, provenance and user-confirmed event time when different.
- Ask the *minimum* follow-up questions needed to submit; do **not** routinely ask “Does it involve a child?”, expose a long safeguarding questionnaire, ask for LGA or ward by default, or repeatedly request a location already resolved with confidence.
- Sensitive reports still require safety protections, consent, data minimization, access controls and operator moderation; those checks can be conducted privately without interrupting everyone with irrelevant questions.

### Location intelligence
The incident's **location is not necessarily the reporter's current GPS position**.
1. Parse named places, nearby landmarks and likely towns from the user's narrative (“Adebayo”, “Iludun Ekiti”, “Eda Oniyo”), using a curated geo gazetteer with aliases.
2. When expressly authorized, inspect **existing media geotags** or allow the person to select/confirm an incident point on the Ekiti map. Treat metadata as optional, untrusted and potentially removed; do not assume it exists.
3. For opt-in **device location**, explain that it is the user's device position **now**, not automatically the incident position. If relevant and within Ekiti, use verified PostGIS polygon containment to infer LGA, town and ward where evidence supports it; surface a low-friction “Location detected: … · Change” confirmation, not an LGA form.
4. If geocoding is ambiguous, edge-of-LGA, not covered, outside Ekiti, permission-denied or contradictory, **say so**. Offer an optional place search, manual town, then LGA fallback—only when necessary. Never guess a town/LGA as verified.
5. Keep exact incident GPS **private** and discard unneeded raw media EXIF/geodata; do not expose it in public search, telemetry, public incident pins or office dashboards beyond authorized need-to-know.

### Emergency flow
- Selecting **Emergency** immediately shows a concise visually clear red warning: in immediate danger, **call verified Ekiti emergency contacts directly**. Fetch numbers from a validated, timestamped authority registry before display; avoid made-up/stale numbers or falsely promising a response.
- Prominent tap-to-call and “Continue reporting” actions. Reporting remains possible even when a call does not connect, but a web form is **not an alternative emergency dispatch guarantee**. Never require users to prove a phone call failed, or log their call details without consent.

### Actual persistence
- When a separate approved private writer exists, Submit requires clear consent, server-acknowledged transaction, one-time genuine receipt/token, and private tracking. The UI cannot say “sent” if only a local draft was saved. For live audio/video use chunk upload, retry/resume and **server ACK** before labeling saved; secure object storage, size limits and retention/deletion are required.
- Anonymous submission stays possible; optional identity/account linking is a later convenience and should not be a barrier.

## 5. Public Ekiti map — a geographic accountability interface
- MapLibre (already integrated), verified GRID3 LGA boundaries plus a curated town/settlement gazetteer, optional street context licensed for use. Search and filter by locality, type, date and verified case state.
- Public layers: reviewed businesses/places, consented **moderated public feedback**, verified road/sanitation/service problems, and safe aggregated emergency trends where appropriate.
- Publication is a **separate moderation and consent decision** from private reporting. A sensitive or active emergency report must not create a public exact-location pin by default. Use generalized coordinates, area markers or aggregate counts when necessary; redact names, faces, home addresses, vulnerable-person details, identifying narratives and media.
- Distinguish “public opinion about a location” from “verified event/incident” and from “official notice”. Public comments are not automatically facts or government acknowledgments.
- For every public case result, allow a private trace/reference when authorized, and attach source, event dates and a correction/retraction trail. Public map must remain usable with a list alternative and accessible controls.

## 6. Ministry/office routing and trustworthy case states
- Build a **reviewed, versioned jurisdiction registry** for Ekiti ministries, agencies, local-government offices, state/federal road authorities and parastatals. Routing should use issue type + location + verified responsibility, not solely labels like “roads = transport”: specific road ownership or category can change the competent office.
- Example *candidate* classification only, pending verified registry: roads → road/works or transport authority with proper jurisdiction; commerce complaints → commerce/business regulator; tourist site issues → tourism office; local drainage/waste → appropriate environmental/local office.
- Workflow: classify; propose responsible office; operator safeguards and reviews; send via an actually verified agency integration; record per-office delivery/read/reply/action events **only when system evidence establishes each one**. Unknown delivery should remain unknown, not “seen” or “ignored”.
- **State machine:** draft → received by inEkiti Official → under independent moderation → jurisdiction proposed → forwarded (signed send record) → delivered to verified office (delivery receipt) → viewed by verified office (authenticated read evidence) → officially acknowledged/responded → action underway → resolution asserted → independently verified/appealed. These events may branch, return or remain pending; do not pretend a strictly linear process where none exists.
- Show *only* evidenced milestone labels publicly. Separate **platform staff actions** from **actual government actor actions**. No inferred “read and ignored” when only an email was sent; “no official response recorded” is accurate.
- Office dashboards and performance summaries can reflect verified response times and case denominators with correction/appeal, status confidence and safeguards against gaming. A ministry may access and act only after verified identity, role scope and explicit partnership/access policy.

## 7. Backend modules, not a bloated frontend
Keep the existing stack (React/Vite, Cloudflare Workers, PostGIS/Supabase) and working geographic boundaries. Gradually build or align:
1. **Public search index/retrieval API** joining reviewed directory, places and civic knowledge.
2. **Gazetteer/location resolver** for towns, aliases, geotag/geopoint matching, confidence and optional correction.
3. **Directory submission, validation, moderation, claim and public search**.
4. **Private reporting/evidence** gateway with retention, authenticated moderation, per-case event ledger, receipts and auditing.
5. **Verified office registry, jurisdiction matching, secure delivery and two-way office portal**.
6. **Moderated public projection** of safe geo/generalized cases, status evidence and open-data endpoints.
7. **Opt-in notifications**, browser push/sounds and subscribed email/SMS when providers and actual case events exist.
8. **Grounded assistant** using verified Ekiti sources, bilingual retrieval and human-reviewed learning loop.

Never publish real sensitive data, production secrets or fake approvals to make a prototype appear finished.

## 8. Build-to-completion, review once
The owner's preference is to **finish the product's intended features before a broad cosmetic correction cycle**, not continuously restart/redesign after each sprint. Treat this document as the target contract **now**, keep completed verified modules and redesign their interface only where incompatible with the end goal. Design work proceeds alongside backend completion; no duplicate implementation and no global architecture reset.

### Acceptance outcomes for the finished system
- At 1440px the homepage visually reads as a **purpose-built desktop search page**, not a narrow phone view; at 360px it is minimal and fully functional.
- A user can search “hotel in Ikogosi” or “electrician in Ado Ekiti” and obtain relevant, sourced reviewed listing results and a map view; no product catalogue required.
- A business can submit or claim a service listing; only approved listings appear in search.
- A person in Adebayo or Iludun Ekiti can report with text/media and location. The system detects/validates locality **when evidence supports it**, shows a correction option, and does not demand LGA by default.
- A person physically outside Ekiti can still report an incident **in** Ekiti using place search/manual fallback.
- A submission produces an actual committed receipt and private status, not fictional case tracking.
- Emergency type surfaces **verified** click-to-call help and permits reporting, with truthful non-dispatch explanation.
- Public map contains only consented, moderated, privacy-safe cases and reviewed locations; sensitive points stay private.
- A case routed to an office has authentic sent/delivered/read/response proof, or an explicit “not confirmed” state; no platform action impersonates a ministry.
- Admin has real signed-in role-scoped queue, moderation, routing and opt-in event alerts—not just sample cases.
- All critical user journeys pass 320/390/768/1024/1440/1920 browser tests, accessibility checks and manual smartphone review.

## 9. Development state / sequencing
This is **requirements documentation** and must not be misrepresented as deployed functionality. The existing unified staging candidate at commit `524386e` and the operational-pilot schema PR #43 remain separate. Preserve them. Next active tasks: real private schema/identity/retention; public search and listing index; reliable location/gazetteer; authenticated routing/office registry; publication workflow; comprehensive acceptance and production rollout. Revisit the older 26-sprint roadmap wherever it conflicts with this contract. The office verification, evidence and safe publication gates still apply.

## 11 November 2026 — search-engine frontend decision

Product owner explicitly confirmed that **Ekiti Civic is an Ekiti-focused search engine first**. Google Search / AI Mode is a design-behavior reference (minimal white/dark search canvas, useful sourced answers and follow-up exploration), **not** visual branding or a promise of identical capabilities.

- **Homepage:** one search field; action-card grid and separate “Ask about Ekiti” home action are retired. Search handles public directory/knowledge inquiries; recognized private-report intent navigates to the separate report flow without putting narratives in public GET URLs. Preserve optional `/ask` deep links for backwards compatibility, but don't promote them as a second search engine.
- **Products menu:** compact app launcher with Search, Civic report, Government feedback draft, Explore Ekiti, Ekiti map, List a business/service, Track and My Account. Avoid false “government received” wording while official routing is not live.
- **Appearance:** users choose **System** (default; live device preference updates), **Light**, or **Dark** (persistent override). Maintain existing black/white and Ekiti accent palette. Compact header on mobile retains Yoruba/English controls through the launcher where needed.
- **Low bandwidth:** no external fonts, background video or decorative hero media; MapLibre and map geometry are lazy-loaded on explicit map access, not on homepage load. Use platform-native inputs, keep text usable under slow 4G and before optional assets load. Offline shell must never cache private report data.
- **Accounts:** sign-in/create account is a genuine future feature of the existing authenticated citizen stack; preview should not fake account creation if Supabase login is not configured.
- **Future citizen email:** a possible separate opt-in `name@EkitiCitizen.com` / `.ng` service is **ideas backlog only**, pending domain availability/ownership, spam/abuse protections, operating cost, user consent, identity and privacy review. Never imply domain exists or email provisioning is active.
- **Search learning:** learn by incorporating reviewed business submissions, reviewed corrections and public-source updates; *never* silently train on sensitive report bodies or auto-publish unsupported claims. Source-backed Q&A can share the single search route and must always retain provenance and uncertainty.
- **Discovery/SEO:** public directory pages eventually need server-side/edge-rendered crawlable content, verified canonical domain, structured metadata, XML sitemap, and legitimate source relationships. A Vite SPA meta description alone does **not** guarantee Google indexing or rich search visibility; avoid indexing fictional staging/demo records.
- **Incident coordinates:** never request automatic browser geolocation on page load. On a user action, ask for precise GPS only when needed and the reporter is physically at the incident; allow place search, verified town/LGA inference and manual incident selection for users outside Ekiti, users who decline permission and inaccessible devices. Requiring location permission for *all* reports would prevent valid remote reporting and misidentify incident locations.
- **Map coverage:** all confirmed towns/communities and moderated public map reports remain a separate ingestion milestone, tracked in [issue #53](https://github.com/oprahayo/ekiti-platform/issues/53), using GRID3 settlement names + verified PostGIS polygon checks and attribution. Currently 16 LGA boundaries and approved place pins exist; no fictional town data is allowed.
- **Operational truth:** pilot private intake, media evidence, ministry delivery/read receipts, official login and public redacted-case publication remain separately gated by [#42](https://github.com/oprahayo/ekiti-platform/issues/42).

The source implementation for this interface decision is [PR #52](https://github.com/oprahayo/ekiti-platform/pull/52). Until CI and staging manifests are verified, it is **implemented on a branch**, not accepted as deployed or fully tested.
