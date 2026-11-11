# Citizen journeys: welcome gateway and guided conversations

The live `ekiti-platform` codebase is React/Vite + Cloudflare Worker. The independent Next.js EkiSignal repository is not connected to its deployment.

## Designed experience

- **Welcome**: a clear landing page with choices for Report, Feedback, Ask about Ekiti, Explore and Post a Listing, plus tracking. Community Post and a social forum are deliberately out of scope. The chatbot is not the initial homepage.
- **Report and Feedback**: a separate one-question-at-a-time conversation. Choose text, photo, video or audio evidence; category; description; LGA and optional community; capture or choose a file; optional email/SMS follow-up; review.
- **Media**: photo/video/audio are attachments, **not voice commands**. Photo uses native device capture. Video and audio may use an in-tab MediaRecorder preview with 1-second chunks held **only in volatile memory**, or existing-file selection. This is not continuous server upload. If the tab closes during recording, evidence may be lost. Supported types and size limits are enforced. Evidence could contain sensitive metadata and must be reviewed before actual intake.
- **Contact**: email and SMS are *choices for a future tracking link*, not active delivery mechanisms. Typed contact information stays in current React state and is never stored in browser sessionStorage or sent to an endpoint.
- **Save**: the safe prototype saves a non-contact textual summary in this browser session only. It does not generate a government case number, send an email/SMS, upload a report, mark a public-map pin or imply that an official desk read it. The older text-draft flow remains at `/report/text-draft` for regression coverage.
- **Directory**: Explore and Post a Listing go to the same Ekiti Yellow Pages area, with the app's existing green/neutral palette instead of a yellow color scheme. Listing previews are not published. There is no public community-post route or social forum.

## Required backend and moderation milestone

1. Approve independent operator, privacy/legal basis, contact verification, media retention/deletion, sensitive and anonymous reporting safeguards.
2. Set up a dedicated private intake role and secure report/media store **separate from the existing public PostGIS location reader**, with idempotency, access controls and abuse throttling.
3. Produce a real UUID/reference and one-time private tracking secret **only after the database transaction commits**. Do not put tracking secrets or identifying contact details in public URLs.
4. Send a verified email/SMS notification with an opaque **single-use, short-lived claim link** over a configured provider; no receipt download. Verify the recipient first, then establish an authenticated private tracking session. Expired or lost links require a secure recovery flow. Do not expose a bearer tracking secret in external analytics/referrers/logs.
5. Moderate categories, incidents and evidence first. Only safe, deliberately approved summaries/approximate areas can appear on a public Ekiti report map. Sensitive security allegations and identifiable imagery must not be public by default.
6. Differentiate platform intake, proposed routing, delivered, acknowledged, officially responded and resolved with event timestamps and verified office accounts.
7. Validate end-to-end on multiple devices with synthetic cases before enabling real staging intake.

This sprint is client-side only. No live database migrations, official messaging, real backend intake or deployments were performed.

## Sprint 01 refinement: location and engagement

On first visit the home screen presents an optional location request. Geolocation is requested only after residents choose to share it, then coordinates are sent to the verified PostGIS `/api/resolve` endpoint. Only an unambiguous Ekiti LGA is automatically selected for Explore; a consistent ward may be shown. Raw coordinates are not saved in browser storage. Outside-Ekiti, declined, unavailable and ambiguous matches retain manual browse and report access. Device position is never automatically treated as a report's incident position.

The reporting UI now has a concise welcome bubble, icon-led evidence choices, a short non-emergency typing pause and opt-in chat sounds. Emergency instructions bypass the pause. Video/audio recording remains an honest local preview until Sprint 06 adds acknowledged chunk-by-chunk private uploads. See `docs/sprint-roadmap-v2.md` for release gates and the removed community forum scope.
