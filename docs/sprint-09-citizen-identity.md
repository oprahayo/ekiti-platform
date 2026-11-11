# Sprint 09 — optional citizen authentication and receipt-protected report history

**Status: draft source code and review-only SQL. Not approved for live account, SMS or report data collection.**
This branch is stacked on Sprint 08 PR #33. All private-report intake and evidence routes remain disabled by default. Nothing in this sprint runs migrations, deploys a service, provisions Supabase Auth, sends SMS, contacts an actual resident, or claims government affiliation.

## What is built

### Reuse the citizen auth system already present

The project already had a separate optional Supabase Auth **email-code** flow for reviewed business listings, moderated reviews and claim requests. Sprint 09 extends that same provider instead of creating another login system. Its one-time email code remains the baseline. A separately gated `VITE_CITIZEN_SMS_OTP_ENABLED=true` can expose an optional **E.164 phone number + SMS code** path, but only in a build with valid public Supabase Auth configuration. No SMS provider or paid messaging has been provisioned.

The sign-in screen describes passwordless same-contact account recovery: after losing a tab or device, an individual may request a new email/SMS OTP through the **same** verified contact and regain the same Supabase account if that Auth identity still exists. The app does **not** automatically merge email and phone identities, verify legal residency or government identity, recover unknown/expired report secrets, or bypass provider restrictions. Every account remains optional; no login is needed for Explore, Report drafts, Ask or Track demonstration.

Access/refresh tokens stay tab-scoped in the pre-existing sessionStorage implementation; this is script-readable and *not* equivalent to HttpOnly cookies. The client checks its token against Supabase `/auth/v1/user` and refreshes with Auth. Local sign-out clears the tab immediately, revokes the refresh session on a best-effort network call, and does not guarantee already issued access tokens have instantly expired. Full CSP, XSS and token revocation review remain pilot prerequisites.

### An explicit private-report ownership proof, not an email association

A new opt-in proposal `db/proposals/0012_citizen_report_links.sql` creates a `civic_private.citizen_case_links` index keyed by report ID, with foreign keys to both the private report and `auth.users`. Its row is cascaded away when the report expires and is **actually deleted**, or when the Supabase account is deleted. It does **not** alter existing reports, save a second copy of the secret, create new receipts or change the report's retention. Account history remains empty unless deliberately linked.

Each link requires **both**:
1. An authenticated, server-verified Supabase JWT: SQL uses `auth.uid()` for the signed-in account; it never accepts a caller-supplied account ID.
2. The matching committed report UUID **and original 256-bit receipt secret**, sent to a narrow HTTPS PostgREST RPC after explicit UI consent. The DB validates its SHA-256 digest against the existing private report's digest; no secret is persisted, logged or placed in a URL.

A case already linked to another account is **not transferred** even with a correct secret; an approved human dispute/recovery process would be required. Someone merely knowing a resident's email, phone, social handle, location, device or report number cannot claim the report. The current guest draft has no server-issued receipt and cannot be claimed.

### Three tightly scoped functions, unavailable unless separately installed

- `public.civic_link_private_report(uuid,text)`: attach a proven private report to the authenticated account, without changing the report's contents.
- `public.civic_my_private_reports()`: return at most 30 of the account's linked report references, original kind/time and real platform event labels; **never** narrative, private contact, media, exact GPS, internal notes or unsupported government acknowledgement.
- `public.civic_unlink_private_report(uuid)`: remove only the authenticated person's account link. The report remains subject to its separate retention and deletion rules.

The functions run with a restrictive NOLOGIN owner and explicit policies/grants. `anon`, `authenticated` and the public-location reader cannot directly SELECT the private report/link tables. The signed-in `authenticated` role receives only the narrow RPC EXECUTE permissions. **The SQL itself is default-off:** `civic_private.citizen_link_release` initially has `enabled=false`; only a privileged operator can update it with a reviewed approval ID and timestamp. Until that database-controlled switch is enabled, even a signed-in direct RPC request with the correct receipt cannot create a link or enumerate private report history. The Vite build flag is only a UI gate, never the sole security boundary. No Cloudflare Worker user impersonation, service-role key, public report link, government dispatch or live case action is added.

### Minimal Profile screen and release gates

The existing Profile now includes **My Reports**. Guests see an honest guest explanation with no network request for a private history or code. With a configured account but without `VITE_CITIZEN_REPORT_LINKING_ENABLED=true`, the screen explicitly says private history is **not active** and does not display a fictitious account report. If separately enabled and the audited RPCs are installed, the screen can fetch sanitized linked history, require explicit link consent, and unlink previously claimed cases. The receipt secret is held only in volatile React state during the form and cleared after any request; never stored in localStorage/sessionStorage, indexed in a URL or reused as a report password.

**Configuration flags do not constitute authorization.** Do not set them until independently reviewed Auth setup, privacy policy, private report intake, retention/deletion, moderation, abuse response and secure end-to-end account verification are operational. No verified report is available in the current preview.

## Automated checks

- `tests/sprint-09-citizen-account.test.mjs`: E.164 validation; SMS and report-history disabled defaults; email OTP recovery produces the *same* identity in a mock Auth provider, but no cases; reject invalid receipts, fake government acknowledgements, narratives or malformed history responses.
- `tests/citizen-report-links-postgis.mjs`: guard denies migration without a local explicit review token; rollback-only PostGIS Auth-role exercise rejects wrong receipt, guest, hijack and cross-account history; verifies RLS and EXECUTE grants, owner unlink without case deletion, and retention cascade.
- `tests/browser/sprint-09-citizen-accounts.spec.ts`: Profile for guests; no private fetch before activation; no unconfigured contact form; case-history direct route; privacy disclosure and narrow mobile layout.
- All previous citizen navigation, account reviews/claims, incident privacy and PostGIS regressions are preserved in CI.

## Unfinished and must not be represented as released

- Phone provider setup, consent and sender verification, pricing, international destination support, delivery audits, rate limiting and real **SMS OTP** end-to-end testing.
- Supabase Auth integration against isolated test users, same-account recovery on **two physical devices**, session rotation/revocation across browsers, and CSRF/XSS/CSP review. Tab-scoped sessionStorage remains an explicit security limitation.
- Reviewed schema/migration execution on isolated **approved staging**, proof of final SQL access restrictions in the real Supabase role context, and a retention/deletion job that actually deletes reports and linked history including backups.
- Operator-approved privacy policy, controller contact, account deletion rights, anti-abuse controls for repeated receipt guesses, moderator escalation/dispute recovery, and trustworthy recovery after a report was committed but its receipt response was lost.
- Actual real report acceptance, official acknowledgement, SMS/email receipt-link delivery (**Sprint 10**) and full account case timeline/status UI (**Sprint 11**). The current Track conversation is fictional and labelled as such.

**Next:** Sprint 10 — verified email/SMS claim links with one-time, short-lived, non-leaking delivery and recovery. It is not authorized for release merely because Sprint 09 source tests pass.
