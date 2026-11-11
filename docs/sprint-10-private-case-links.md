# Sprint 10 — private verified-contact case links, queue, retry and one-time redemption

**Status: source and review-only SQL proposal; no live delivery.** Stacked after Sprint 09 draft PR #34. Not installed, merged, scheduled, connected to a real sender or deployed. All historic report/intake/evidence/admin feature switches remain off.

## User journey

1. **Guest mode persists**. Anyone can browse Explore, use Ask and save unfinished incident drafts without an account. The platform is not an emergency service.
2. A resident who **already has a successfully committed private case receipt** may optionally sign into the same Supabase email-/SMS-verified citizen account and open **Profile → My Reports → Request a private case link**. The form requires their UUID, original 64-hex-character receipt secret, explicit consent, and selection of an **existing verified email or phone**. They cannot type an arbitrary new destination, and no message is sent just from opening the page.
3. An independently approved PostgreSQL function checks the user's real **confirmed** Supabase identity through `auth.uid()` and `auth.users`, validates the original private receipt hash, checks report retention and existing ownership, then adds a minimal queue record. It returns a generic result with no contact or case details. The database release switch is **off** after installation. The account/session Vite flag is merely an additional UI gate.
4. A separately provisioned, narrowly privileged **sender process** (not presently installed or scheduled) can reserve one due queue row. It generates a fresh 256-bit raw ticket *in memory*, sends only its SHA-256 digest to PostgreSQL and obtains the recipient contact from the currently verified Supabase account. The queue stores the **digest of the recipient contact**, never an email, phone, raw ticket or receipt secret. If that contact changed, queued delivery is not leased.
5. The process uses an operator-approved message transport. Messages include a bland non-sensitive description and an HTTPS link such as `https://<approved-host>/case-link#ticket=<one-time-secret>`. The fragment stays out of normal HTTP pathname/query logs but is **not guaranteed secret** from messaging providers, copied links, browser history or screenshots. The app erases the fragment immediately on the claim screen before any user-visible interaction.
6. A recipient must sign into **the same confirmed account that requested the message**, then explicitly press **Redeem one-time link**. PostgreSQL atomically consumes the ticket and links the case through the existing Sprint 09 private history index. A forwarded link cannot be redeemed from a different account. The ticket has a **10-minute maximum life**, is single-use, and is never a public tracking key or a replacement for the original receipt.
7. **My Reports** remains limited to existing sanitized platform events/UUIDs. Neither queueing, sending, provider acceptance nor redemption means the office received, read or acknowledged the incident. No public case projection is created.

## Backend and security model

`db/proposals/0013_private_case_delivery.sql` is a deliberately guarded, separately opt-in SQL **proposal**, not a migration. It requires both the approved Sprint 05 report gateway and installed Sprint 09 account link proposal, then itself fails unless `SET LOCAL ekiti.case_delivery_reviewed='yes'` is set by a privileged operator inside a reviewed transaction. Even when installed, `civic_private.case_link_release.enabled=false` requires a *second operator-only* reviewed approval; an ordinary user, anonymous browser, public location reader or delivery sender cannot change this switch. Existing `civic_private.citizen_link_release` must also be enabled by its own authorized operator.

Tables:
- `civic_private.case_link_release`: operator-only review ID/time and independently disabled release gate;
- `civic_private.case_link_outbox`: UUID, report ID, verified citizen ID, channel, hashed approved contact, state and retry timestamps, attempt count, ephemeral ticket digest/expiry. Delete a report or user and the associated queue rows cascade. No plaintext email/phone, ticket, report narrative, incident GPS, media or dispatch data is stored.

Roles:
- `ekiti_case_link_owner`: NOLOGIN SECURITY DEFINER function owner with narrowly scoped table access and RLS;
- `authenticated`: can only execute the request/redeem RPC; **cannot** SELECT tables or lease queued messages;
- `ekiti_case_delivery_api`: NOLOGIN delivery function caller, only allowed to lease and settle; no raw table SELECT and no report purge;
- `anon` and `ekiti_location_reader`: no access to queue, case links or message functions.

Functions:
- `public.civic_request_case_link(uuid,text,text)` — receipt proof, confirmed matching contact, 15-minute per report/account/channel cooldown, and no account hijack;
- `civic_private.case_link_delivery_lease(bytea)` — atomic `SKIP LOCKED` queue claim, accepts only a digest of a *new* ticket, returns a verified recipient to the restricted delivery process, max three attempts and 45-second lease;
- `civic_private.case_link_delivery_settle(uuid,int,boolean)` — distinguishes accepted submission from failure, retries after 1 or 5 minutes, invalidates tokens on failure or lease expiry, rejects stale acknowledgements; does **not** claim actual arrival;
- `public.civic_redeem_case_link(text)` — verifies the same confirmed account, 10-minute TTL and valid ticket, atomically consumes the ticket exactly once and links the case only to the requesting account;
- `civic_private.case_link_delivery_purge()` — separate operator-only routine for deleting completed/failed/stale queue records after a reviewed 30-day retention; **not scheduled**.

Sending/claim logic:
- `src/reporting/case-link-dispatch.ts`: operator-only, **unwired** provider-injection facade. No Resend/Twilio/SMS/SES credentials, provider route, automatic cron, API keys or paid service are present. A failure schedules a bounded new attempt, and any retry invalidates the old link. A provider API returning accepted means **provider accepted**, not delivered.
- `src/app/CitizenCaseLinkRequest.tsx`: explicit contact-channel choice and receipt proof inside the existing Profile; generic response avoids disclosing the existence of reports.
- `src/app/CaseLinkClaim.tsx`: a separate tiny `/case-link` screen; scrubs the ticket from `location.hash`, never redeems on load, requires the original account session and a button press, and stores no ticket in localStorage/sessionStorage.
- `src/app/auth-api.ts`, `CitizenAuth.tsx`: separate browser gate `VITE_CITIZEN_CASE_LINKS_ENABLED=true` requires Sprint 09 private-history gate to be configured first; no new service-role/bearer keys.
- `src/app/ReportPrivacy.tsx`: explains exact limitations, message-provider processing and imperfect fragment secrecy.

## Test coverage

- `tests/sprint-10-case-link.test.mjs`: ticket strength and HTTPS-fragment-only link, generic text, no-lease behavior, provider-accepted versus delivered, retry after thrown/failing transport and stale settlement.
- `tests/case-link-delivery-postgis.mjs`: installs **both** Sprint 09 and Sprint 10 proposals only in a disposable CI PostgreSQL transaction, asserts default-off release gates, role isolation, incorrect receipts, confirmation requirements, cooldown, verified destination fingerprint, failed-send retry/rotation, stale ACK, no forwarding/replay, 10-minute expiry, minimal history and delete cascade; finally rolls back.
- `tests/browser/sprint-10-case-links.spec.ts`: guest Profile never sends or links anything; absent/malformed fragments are scrubbed; no secret in page/storage; 280px mobile; disclosure.
- All pre-existing citizen, directory, private report, PostGIS and browser regressions must continue to pass.

## Operational dependencies intentionally incomplete

- **Real email/SMS provider integration and sender authentication**, provider-specific delivery webhooks, dedicated sender DB login, durable sender scheduler, rate-limit/IP abuse handling, bounce/opt-out/country coverage, provider privacy contracts, consent and billing. The integration interface is ready; no production provider has been selected or authorized.
- **Delivery evidence**. Provider acceptance is never treated as actual delivery or verified recipient reading. Provider timeout after the message leaves the network may result in a rotated replacement link. All messages remain unconfirmed until independently verified evidence is collected. Never promise notification arrival.
- **Redemption and session hardening**. Complete real two-device end-to-end testing with verified users, short TTL expiry under concurrency, Supabase session invalidation, CSP/XSS, anti-phishing copy, fragment/document referrer threat analysis and accessible SMS verification.
- **Case safety**. Legal/operator/retention approval, child/sensitive-case consent, moderators and contact verification, deletion including backups, receipts lost in transit, genuine case-ingestion release, and government-office identity verification all remain required. Do not enable or merge while these conditions are missing.
- **No downloadable receipt**. Report receipts stay server-issued capability secrets and are never offered as a downloadable file, link query parameter or public proof of submission.

**Next:** Sprint 11 — My Reports / Tracking: a verified history/timeline for private case events with contact-safe notifications, review statuses and truthful official-acknowledgement distinctions. This sprint does not make that workflow live.
