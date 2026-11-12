# Sprint 11 — My Reports, on-demand platform timeline and contact-safe preferences

**Status: draft source only, not deployed, not approved for real citizen reports or notifications.** This branch stacks on Sprint 10 PR #35. Neither a live report gateway nor an SMS/email provider has been enabled. No production changes or unrelated migrations are made.

## What has been implemented

- The existing Profile → My Reports section retains its receipt-linked account index. Each private, previously linked case gains an **on-demand View private platform timeline** control if all required future deployment gates are explicitly enabled. The app does **not** fetch case events on guest browsing, page mount, or before the user opens that case.
- The private timeline reads only the latest 50 real `civic_private.case_events` for that account-linked case, ascending by event ID. Event kinds are limited to `intake_accepted`, `under_review`, `needs_information`, and `closed`; every event is explicitly `origin: independent_platform`. Case narrative, private explanation, location, evidence, contact information, internal staff names and receipt secrets are never returned.
- Case summaries and timelines visibly state that **platform receipt does not equal government delivery, viewing or acknowledgement**. Neither `under_review` nor `closed` is evidence that an official office accepted, responded to or resolved a report. No fake confirmation, office name or human response is invented.
- Residents can **opt in to a future contact preference** for a specific linked case: off (default), the account email (must be confirmed) or the account phone/SMS (must be confirmed separately). The chosen channel, confirmed-contact digest and consent timestamp are stored, not the raw contact. The user can turn off the preference at any time. **No automatic notifications, outbox rows, SMS, email or push messages are sent or scheduled by this sprint.**
- Residents may raise a minimal **correction review requested** or **possible duplicate review requested** flag. It stores only the report/account ID, enum kind and request timestamp. It does not edit the original allegation, merge reports, promise moderator response or assign an official status. Repeat requests are idempotently rejected to reduce misuse.
- The existing /track conversation remains a clearly fictional, free-to-browse demo. It does not make a real private-case lookup from the public tracking reference text, and the five primary homepage actions remain unchanged.

## Separation of privileges and approval gates

The proposal `db/proposals/0014_citizen_case_timeline.sql` is deliberately outside deployed migrations and starts with a **transaction-specific, explicit review token requirement**. It also installs its own **operator-controlled `civic_private.case_timeline_release` with `enabled=false`**, independent of the existing default-off Sprint 09 `citizen_link_release`. Both must be approved by an independent operator before any real timeline/private preference RPC can return content.

The `ekiti_case_timeline_owner` role is NOLOGIN. It has only narrowly enumerated SELECT columns on private cases/events/linked-report ownership and confirmed account status, plus full rights on its own preference/request tables. The sensitive `civic_private` schema remains FORCE RLS, and anonymous/authenticated/public geographic-reader roles have **no direct table access**. The function owner cannot set the operator release flag. Three public PostgREST RPCs have authenticated EXECUTE only:

1. `civic_my_case_timeline(_reference)`: verified `auth.uid()` and confirmed contact, exact linked UUID, unexpired report, both release checks; returns one minimal row or zero, never other users' reports. Event bodies come only from actual platform DB rows.
2. `civic_set_case_notice_preference(_reference,_channel)`: explicit per-case opt-in/out; verifies the selected existing Supabase contact at request time and stores only a digest. Off removes consent and digest. No message dispatch or "delivery" claims.
3. `civic_request_case_review(_reference,_kind)`: content-free enum request from the same report owner; no accidental status change or unbounded duplicate requests.

A **third, browser-side gate** `VITE_CITIZEN_TIMELINE_ENABLED=true` also depends on Sprint 09 private-history mode. This frontend flag is only a UI safeguard; the independent PostgreSQL approvals remain the actual data boundary.

## Verification

- `tests/sprint-11-case-timeline.test.mjs` validates precise timeline format, event-source labels, timestamp order, limited status vocabulary, absence of sensitive fields and disabled UI release flag.
- `tests/case-timeline-postgis.mjs` loads the Sprint 09 and Sprint 11 proposals only inside a disposable PostgreSQL transaction, confirms unauthorized SQL installation fails, verifies default-off behavior and least privilege, and uses simulated confirmed Supabase users to check case ownership, event integrity, no notes, cross-account denial, preferences, duplicate/correction flags and unlink/deletion cascade. The transaction always rolls back.
- `tests/browser/sprint-11-tracking.spec.ts` verifies guest no-leak, still-fictional Track, 280px layout and privacy wording. The existing reporting, SMS claim links and public directory regression suite remains in CI.

## Operational work intentionally excluded

No live government office registry, office acknowledgements, real operator/moderator assignment, official case status, or dispatch is introduced. The private timeline remains a platform-only record, and the current source-only UI is not a promise of an actual moderation response.

For eventual launch, separately approve/review Supabase Auth and server-side row security, operator/privacy/retention policy, event-production audit trail, accurate contact-confirmation and phone ownership, log suppression, accessibility, incident-safeguarding, consent withdrawal and deletion jobs including backups. **Future notifications need an independent provider, explicit user consent, safe message templates, delivery receipts, opt-out handling, dispatch retry logic and an operator review.** The Sprint 10 case-link sender interface is not a general status notification channel and is not used here.

The report correction/duplicate flags are not themselves a moderation inbox or a verified duplicate determination. A separately reviewed staff queue and real evidence would be required.

**Next:** Sprint 12 — Admin Identity and MFA, coordinated with the already-open separate admin foundation PRs. Do not merge the independent admin tracks without reconciling the schema/branch ancestry and reviewing default-deny access.
