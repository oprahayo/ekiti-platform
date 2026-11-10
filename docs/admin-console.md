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
