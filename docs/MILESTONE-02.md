# Milestone 02 — Citizen reporting

**First feature.** A citizen can prepare a complaint, commendation or issue, edit its description, and download a plain-text draft with the current area selection. A download includes the manual ward label and boundary evidence. Text stays in the page until the user chooses a file download. Reloading normally discards the in-memory draft. Files the citizen downloads remain under their control. No new server write permission or public record is created.

| Sequence | Integration and acceptance |
| --- | --- |
| 1. Private draft | Shipped in this change. A keyboard user can select a report type, enter text, download it, and clear the fields. The export works with incomplete geography. The browser test reads the file and checks that the draft triggers no HTTP requests. |
| 2. Consent-based intake | After approval of intake purpose, access and retention, accept one report through a bounded, rate-limited Worker endpoint. Persist it transactionally through a dedicated write function. Test explicit consent, duplicate retries, server validation and restricted reads. Reuse the confirmed incident marker and resolver provenance. Keep exact positions private. |
| 3. Tracking | Return a case reference only after successful intake. Introduce an authorized event log and a redacted public timeline. Test that private content and precise locations cannot be retrieved from public routes. Every displayed status needs a recorded event. |
| 4. Places directory | Add audited business/place records with attribution, verification date and correction flow. Ship list search, then lazy map markers. Measure mobile transfer and keep the list usable without a map. |
| 5. Unified chat and push-to-talk | Start with typed questions routed to verified directory or civic information. Add opt-in press-to-record with visible recording state, stop/cancel, and editable transcript. Decide audio retention and revise microphone permissions only for that feature. Chat may propose an action; the citizen confirms before intake. |
| 6. AI-assisted information and search | Retrieve from reviewed civic sources with source dates and links. Evaluate unsupported answers, stale information, prompt injection and privacy before exposing a model. Keep deterministic geographic resolution and case events separate from model output. |

Staging validation is the next operational step. Live intake and public tracking are separate milestones from downloading a draft. [Staging runbook](staging.md) · [Architecture decision](adr/0003-platform-modules.md)
