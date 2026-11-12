# Sprint 04 — Privacy, consent and safeguarding (source-only, release gated)

**Scope:** Ekiti Civic citizen reporting preview, stacked on Sprint 03. No public live intake, no deployment, no merge, no Supabase migrations and no new government integrations.

## What is implemented now

1. **Independent-service disclosure.** An accessible `/privacy` page explains that Ekiti Civic is independent, not a government agency or emergency dispatcher. It explicitly identifies the responsible legal operator, official contact and approved live processing notice as **pending verification**, rather than inventing one.
2. **Precise draft disclosure.** The guided report remains in page memory until a resident **actively checks a local-save acknowledgement** and chooses to save. The saved guided copy contains narrative, category, optional taxonomy answer, LGA/community and date; it deliberately excludes email, phone, media, raw GPS, safeguard flags and consent/legal policy claims. `readJourneyDraft` rejects expired copies after 24 hours; `hasExpiredLocalDraft` removes older explicit guided drafts from session storage **on next report page load**. This is not a timer, forensic wipe, server purge or guarantee about previous browser copies. The older legacy `/report/text-draft` route uses independent localStorage autosave and is explicitly disclosed.
3. **User-controlled local erasure.** `/privacy` can delete the guided session key and two older text-draft localStorage keys. A result is only reported when storage removal operations succeed. Saved-report UI also lets users clear the guided draft and restart. This does not erase an open draft in another tab, downloaded/copied files, any other device or future server data.
4. **Harm prevention in the report flow.** Voluntary local-only flags for a child/vulnerable person or retaliation concerns prompt a clear warning about names, faces, addresses and sensitive allegations. If either flag is selected, the evidence step disables photo, video and audio preview/capture and proceeds without attachments. These flags **are not stored** in the explicit browser draft and are not sent to any endpoint. This is a protective limitation, not secure whistleblower intake.
5. **Proposed moderation default-deny helper.** `mayPublishApprovedSummary` is a **pure, currently unconnected** future rule requiring an authorized human reviewer, explicit approval of a redacted public summary, operator policy approval and no vulnerable-person/retaliation flags. It is not a real admin queue, authorization check or live publication gate. Server-side independent checks, classification persistence, redaction and audit trails are future work.
6. **Protection of incomplete work.** Privacy links open in a separate tab so reviewing the notice does not silently discard an unsaved report. Existing home page and other user journeys are untouched.

## Required human decisions — DO NOT REPRESENT AS COMPLETED

| Decision | Status | Needed evidence |
|---|---|---|
| Exact responsible legal operator/controller identity, address and contact | **Pending** | Signed off public disclosure |
| Lawful basis and privacy obligations (relevant Nigerian and cross-border rules), notice language and accessibility | **Pending** | Independent legal assessment, versioned approved notice |
| Real data-submission consent versus optional local save | **Pending** | Separate opt-in design and server-side policy version for live intake |
| Retention of report text, events, evidence, contact, audit and abuse metadata | **Pending** | Written per-data-type schedule and verified deletion flow |
| Automated purge of live DB objects, backups, caches and media chunks | **Not implemented** | Recurring job, manual erasure/recovery, test records and auditable proof |
| Threats, children, coercion, retaliation and emergency response playbooks | **Pending** | Trained operators, secure referral, confidentiality and lawful reporting boundaries |
| Moderation, redaction, restricted review, appeals and insider audit | **Pending** | Real access-controlled admin workflows, adversarial tests, reviewed public projection |
| Private gateway activation | **Disabled** | Separate explicit permission for staging and security review, followed by production approval |

The user-facing checkbox is **not** a legal consent to future live data processing. A future policy cannot be substituted retroactively, and sensitive narratives may identify individuals even without direct contact fields.

## Validation

- `npm run test:all`: unit and TypeScript checks, including `tests/report-safeguarding.test.mjs`.
- `npm run test:browser`: existing Sprint 01–03 citizen regressions plus `tests/browser/sprint-04-safeguarding.spec.ts` exercising no-save-by-default, opt-in save, local deletion, stale draft removal, threat/vulnerable safety constraints and 280px/390px privacy page rendering.
- Disposable CI PostGIS and staging dry-runs must continue to pass. Production SQL and secret configuration are **untouched**.

## Release gates

This PR is an engineering preview and cannot constitute completed privacy compliance. Before Sprint 05 turns on any live report intake, obtain written operator approval, published lawful privacy notice, consent/retention decisions, independent security review, actual server-side deletion/enforcement and trusted moderator handling. No deployment or merge is implied by CI success.
