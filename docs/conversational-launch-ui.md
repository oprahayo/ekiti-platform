# Launch UI — conversational civic journeys
Version: first-launch UI candidate, 10 November 2026

## Summary

Ekiti Civic's first-launch UI is **conversation-first** rather than a large form-based website. The existing 5-tab mobile shell, centered Home, bilingual Ask, source citations, optional voice, light/dark themes and read-only PostGIS geography remain in place.

- A citizen can type a source-backed question and receive the published answer, source, date and optional spoken reply.
- A report-like phrase in Ask routes **on-device** into a guided private report conversation. The text is **not** sent to `/api/ask` or any report endpoint.
- The assistant asks what happened, which of Ekiti's 16 LGAs is involved, and for optional details. It then summarizes the draft, offers corrections, and downloads a real plain-text file on request.
- A location can be entered in plain language or selected by a native select. GPS, map and boundary verification are hidden until explicitly requested. Raw coordinates are not stored in the draft.
- Track is a conversational explanation, with an **explicitly fictional** example timeline. A local draft may be resumed on the same device. There are no real case references or tokens.
- Hotel, school, health and office discovery requests route from Ask into the appropriate Explore category and supported LGA. Directory entries are **sample fixtures**; no fictional business is presented as verified, open, geolocated or available.
- A real listing/claim subsystem, knowledge contributions, ingestion, moderation and source indexing are follow-on backend work. No government-affiliation claims.

## UX guardrails

1. **Do not present technical forms as the primary interface.** The chat asks one question at a time and permits corrections before any action.
2. **Avoid decorative card grids and chips.** Agent messages appear as plain text; user messages as subtle bubbles. Explore categories are text tabs and places remain rows.
3. **No fake case receipt.** Downloading a draft is not equivalent to filing a report. Do not issue even a plausible fake reference or tracking token for a download.
4. **Privacy by default.** A report narrative is kept in localStorage for offline recovery and is not posted to the knowledge API or saved by the Worker. LocalStorage is not encrypted: clear drafts on shared devices.
5. **No involuntary GPS or audio.** Speech input is started by a user; browser providers may process audio remotely. Speech transcripts are editable before sending. A coordinate lookup requires a separate confirmation.
6. **Source honesty.** Official releases are attributed to the government publisher; political achievements and criticisms must be supported by distinct dated sources and allegations marked as allegations. Information crowdsourced from citizens requires provenance/moderation and correction handling.
7. **Real tracking is later.** A publicly visible case status must originate from authenticated, append-only state events after a secure report persistence gateway exists. The agent may remember an authorized case in a future private session, never from an unverifiable free-text number.
8. **Business directions are later.** Only verified business coordinates may generate Google Maps or other direction links. An illustrative entry must not have directions or unreviewed contact details.

## UI acceptance

- Text and speech: report microphone transcript stays in the report composer, instead of jumping to general Ask.
- Mobile: 280/320/360/390/428/768px report conversation and fixed composer without document overflow.
- Report: short descriptions prompt follow-up; no LGA guessing, no geometry without consent; edit description, LGA and details; local text download; clear localStorage.
- Offline: when already cached, the read-only app shell reloads and preserves the private report conversation.
- Track: no real lookup, fake success, fabricated agency acknowledgment, or token in a URL.
- Ask: report and tracking text do not leave the browser for general retrieval; ordinary verified-topic questions still use `POST /api/ask`.
- Explore: search presets persist across navigation; illustrative results remain conspicuously labeled.

## Backend release requirements

The following **are not implemented or approved**:
1. Publisher-specific crawling and lawful update scheduling (respect robots.txt, copyright and source policy).
2. Supabase private report storage, consent/retention policy, least privilege writer roles, moderation, case IDs, and tracking secrets.
3. Moderated place ingestion, verified business owner claiming, provenance, stored photos, reviewed coordinates, and directions.
4. Civic knowledge suggestions and corrections with review queue. Do not silently turn private conversations into public "learning."
5. Broad AI inference (no paid tokens): source-backed deterministic responses work only for covered questions. Open-weight on-device inference is optional later, tested per device and Yoruba quality.

The free-tier infrastructure has limits and is not a promise of unlimited service.

## Deployment

The UI is implemented in code but is **not automatically deployed** to Cloudflare when the PR merges. Deployment requires the existing local staging configuration and an explicit normal deployment. Verify `npm run test:all`, `npm run staging:check` and GitHub browser/GIS checks first.

Related: [Reporting governance](reporting-governance.md), [Ekiti sources](ask-ekiti-sources.md), [Interface principles](interface-principles.md).
