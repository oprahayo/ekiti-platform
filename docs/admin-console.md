# Administrative app — operations console milestone A

**Status:** Implemented as a separate, isolated, local demonstration. It is **not** an authorized production admin service.

## Scope and user experience

The Ekiti Civic administrative operations console is a separate React/Vite app, deliberately excluded from the citizen app's default build and Worker routes. Its responsive three-pane interface includes:

- Case inbox and All / Assigned / Awaiting / Escalations / Resolved queues.
- Search by reference, category, report type, LGA and title.
- Case details with safe fictional summaries, priority and assigned moderator.
- Append-only in-memory activity history; queue state is derived from events, not an editable status flag.
- Internal assignment, awaiting clarification, supervisor escalation, platform resolution, reopening and notes. A reason is required for every action except assignment.
- Sample-only analytics and a reset control.
- Five separate moderation work queues: **listing submissions, citizen reviews, business ownership claims, civic knowledge and corrections**, with an evidence check and reasoned decisions retained in demo memory.
- Ownership claim requests cannot be marked approved/verified from self-declarations or email OTP; human proof review is a separate restricted backend process.
- A case-based **office-routing review** which proposes only a general triage scope by category, keeps ward boundaries unmapped, and explicitly refuses to invent receiving offices, dispatch, delivery or read receipts.
- Separate **Agency delivery** and **Agency viewed** evidence indicators, both fixed to **Not verified**. No authorized agency receipt or view events can be emitted by the demo.

Every case is prefixed `DEMO-` and is synthetic. The interface states that it makes no server requests, saves no changes and handles no real citizen cases. It never displays fabricated official tracking, government acknowledgement or dispatch.

## Run locally

```sh
npm ci
npm run dev:admin
# Open http://127.0.0.1:5174
```

```sh
npm run check:admin
npm run build:admin
npm run test:admin:browser
npm run test:all
```

The admin Vite build outputs to `dist-admin/`; it is not deployed. No new SQL migration, Supabase setting or Worker route is activated.

## Recovered original product scope (not yet complete)

This console supports a larger civic platform, not only case tracking. The original operational requirements are:

1. **Automatic classification with human checks:** case type, geography and severity; state/LGA/ward/community resolution must use a source-verified administrative hierarchy. A text label or weak similarity is not verification. Current ward polygons are unmapped.
2. **Agency directory and routing:** maintain authorized offices, jurisdictions, responsible services, contact endpoints, acceptance/transfer procedures, staff teams and permissions. Route only to approved destinations using verified rules and allow triage review when jurisdiction is uncertain.
3. **Government interaction and accountability:** distinct stages for platform intake, suggested routing, attempted forwarding, confirmed delivery/office receipt, authenticated view/read, official response, follow-up, independently verified resolution and reopening. No stage is inferred from time elapsed or a platform moderator's action.
4. **Overdue reminders and escalation:** enforce defined service-level policies and business calendars; record actual attempted and successful notifications, no-responses and escalations. The earlier seven-day acknowledgement window was a proposal, **not a binding policy**.
5. **Directory/content moderation:** approve sourced place records, verify claims (not just email possession), handle ratings/reviews, corrections, publisher provenance, copyright/licensing, evidence dates and appeals. Never publish a pending contribution by default.
6. **Public accountability:** expose only approved redacted indicators with source evidence, denominators, update dates, response-vs-no-response distinctions, access constraints and exportable open data/APIs. Anonymous citizen narratives, precise incident coordinates and tracking tokens stay private.
7. **Platform administration:** distinct moderator, directory reviewer, case manager, government officer, supervisor, auditor and platform administrator permissions, enforced on every server request.

### Proposed authorization and event semantics

| Responsibility | Required evidence | Public interpretation |
| --- | --- | --- |
| Platform submitted/accepted | Database commit, consent/policy version and intake event | The independent platform holds a report |
| Suggested routing | Source/office mapping and human approval where ambiguous | Internal recommendation only |
| Forwarding attempted | Gateway send attempt and destination | Not equivalent to delivered |
| Delivered to office | Verified gateway delivery or authenticated office acceptance | Agency receipt is confirmed |
| Viewed/read by officer | Authenticated officer principal and case-access event | Case was accessed, not necessarily addressed |
| Awaiting official response | Recorded office receipt/view and a policy deadline | No official answer yet |
| Responded | Recorded official response and actor authorization | A response exists; resolution not implied |
| Resolved/reopened | Documented action/outcome, with any independent verification clearly labeled | Claimed vs verified resolution are separate |
| Ignored/unanswered | Objective policy-defined elapsed window with no qualifying reply | Never assume motive; display "No recorded response" |

An append-only backend event journal will be the canonical state source. Do not let the frontend directly update status or pretend to sign official read events.

## Next milestone — secure operational backend (not implemented)

1. Review and approve report purpose, consent, retention/automatic deletion, moderator safety and incident processes in [reporting governance](reporting-governance.md).
2. Implement authenticated, invite-only moderator access with server-validated roles (reviewer, supervisor, administrator), MFA, short sessions, disabled accounts and least privilege. Hiding buttons is **not** access control.
3. Design private, row-restricted report APIs and an independently auditable, append-only event log with actor identity, action timestamp and before/after transitions. Ensure ordinary moderators cannot impersonate agency accounts.
4. Implement internal assignment, supervisor escalation, response drafts, closure and reopen with idempotency, conflict handling, permissions, and privacy-safe notifications.
5. Only show delivery or view events after verified, signed server-side external-agency access evidence exists. Label internal platform interactions separately. Do not expose private narratives or coordinates in public status.
6. Test cross-role access, direct API calls, pagination, race conditions, XSS, CSRF, audit tampering, denial of service, retention and emergency shutdown against a disposable staging database.
7. Connect the admin app to production **only after** a separately approved launch and data-protection review.

## Safety boundaries

- This app has **no sign-in** because it has **no real data or write APIs**. It must not be publicly launched as an administrative portal until server-backed authorization is implemented.
- Never embed a Supabase service-role key or restricted credential in the frontend.
- No citizen narratives, names, phone numbers, attachments, GPS, tracking secrets or private events are supplied to the demo.
- Public tracking should derive from server-verified records. A platform resolved case is not a verified government resolution.
- The existing citizen experience, live Worker and Supabase environment are unchanged.
