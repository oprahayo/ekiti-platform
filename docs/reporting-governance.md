# Reporting milestone 02 — privacy and release gate

Status: **Foundation only. Not approved for public intake.**

## What is implemented and what is not

The live product currently offers private downloads only. This branch adds a strict anonymous report request parser and a proposed restricted schema. The Worker intentionally has **no** `/api/reports` route, no report database binding, and no ability to persist narratives. No report has been accepted, assigned a tracking code, or delivered to a government agency.

These are **planning defaults for review, not policy decisions**:
- Initial public beta: anonymous first, with **no** name, email, phone, or account requirement. Narrative text may still identify someone.
- Retain only necessary fields: report type, citizen-described narrative, LGA, optional ward and landmark, policy version, request idempotency identifier and receipt access proof.
- Do **not** accept or retain raw GPS coordinates, attachments, direct contact details or request IP as case data in the first release.
- Only a case successfully committed to the private database can receive a reference. A failed submission must never display a fabricated reference.
- No public display of narratives, geolocation details, names, or attachments.
- Any case status must be generated from a genuine append-only internal event, with a clearly distinguished **platform moderation** status. No claim of official acknowledgement without real verification.
- Rate-limit new write and tracking routes separately from read-only location endpoints.
- Never include a private tracking token in a URL, log, web analytics payload, or external notification. Generate a separate random 256-bit tracking secret, store a one-way digest, and present the secret to the citizen after persistence. Public reference on its own is insufficient for accessing a case.
- Do not store raw narrative in application telemetry, error responses, client analytics, or audit logs.

## Required decisions before enabling intake

1. **Purpose and consent:** plain-language notice, exact responsible entity (independent operator), lawful basis, whether any data will be shared, the right to withdraw/delete, and versioned consent; review under applicable Nigerian and other relevant laws before a public launch.
2. **Retention and deletion:** choose a period for report bodies, case events, IP-derived abuse data if any, and unused tracking secrets; implement and prove an automatic deletion job and manual deletion workflow. Merely having `delete_at` in the schema is not enforcement.
3. **Moderation and safety:** designate authorized moderators; queue/suspend harmful or identifying allegations; requests for correction; escalation and abuse handling. Never imply a service handles emergencies.
4. **Case visibility:** decide whether a redacted status-only view is accessible using a separate secret or whether all case status remains private. Confirm the recovery plan if a token is lost.
5. **Operational access:** dedicated restricted report writer and reviewer database credentials, separate from read-only `ekiti_location_app`; password/key rotation, audits, emergency disable, and no public PostgREST exposure.
6. **Threat model:** malicious and duplicate submissions, cross-origin posts, CSRF, scraping and guessing attacks, XSS in narratives, rate-limit bypass, replay, evidence leaks, insider access, and backup retention.

## Gated engineering plan

### Phase A — completed by foundation PR
- Strict typed input validation with explicit, versioned consent.
- Test rejection of unexpected fields, GPS, unapproved policy, malformed or oversize data.
- An independent, inaccessible private schema proposal with RLS and **no public grants**.
- A regression test proving `POST /api/reports` remains 404 until enabled.
- Current downloadable drafts unchanged.

### Phase B — after the decisions above are approved
- Review migration; apply to a **separate staging database**, not the currently configured location reader.
- Implement least-privileged DB functions validating LGA/ward relationship and idempotency atomically, with transactional intake event and receipt creation.
- Add a separately throttled Worker route behind an explicit feature flag and restricted Hyperdrive binding. Refuse requests if configuration is incomplete.
- Persist secure hash only (not bearer secret), encrypt/limit backups as appropriate.
- Implement retention worker, authorized moderation and deletion procedures.
- Validate again using disposable test reports, access-control tests and independent privacy review.

### Phase C — user-facing beta
- Mobile-first confirmation/consent and an explicit submit action (not disguised as the existing draft download).
- Real receipt page, private token-based status checker, and clear operator-vs-government statuses.
- Rehearse rollback, offboarding, consent withdrawal, accessibility and incident response.

## Immediate staging release safety

Neither the proposed SQL at `db/proposals/0004_reporting_private.sql` nor the new parser is imported by the Worker. The SQL refuses execution by default unless an explicit session setting is deliberately supplied. Do not apply it to the live Supabase project; do not add new DB credentials to the current Hyperdrive binding. The existing staging deployment keeps its same features.

Tracking issue: https://github.com/oprahayo/ekiti-platform/issues/10
