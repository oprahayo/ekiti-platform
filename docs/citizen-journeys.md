# Citizen journeys: welcome gateway and guided conversations

The live `ekiti-platform` codebase is React/Vite + Cloudflare Worker. The independent Next.js EkiSignal repository is not connected to its deployment.

## Designed experience

- **Welcome**: a clear landing page with choices for Report, Feedback, Community Post, Explore, Post a Listing and Ask a Question, plus tracking. The chatbot is not the initial homepage.
- **Report and Feedback**: a separate one-question-at-a-time conversation. Choose text, photo, video or audio evidence; category; description; LGA and optional community; capture or choose a file; optional email/SMS follow-up; review.
- **Media**: photo/video/audio are attachments, **not voice commands**. Native device capture and existing-file selection use browser file controls. File previews never leave the tab; supported types and sizes are enforced. Evidence could contain sensitive metadata and must be reviewed before actual intake.
- **Contact**: email and SMS are *choices for a future tracking link*, not active delivery mechanisms. Typed contact information stays in current React state and is never stored in browser sessionStorage or sent to an endpoint.
- **Save**: the safe prototype saves a non-contact textual summary in this browser session only. It does not generate a government case number, send an email/SMS, upload a report, mark a public-map pin or imply that an official desk read it. The older text-draft flow remains at `/report/text-draft` for regression coverage.
- **Directory**: Explore and Post a Listing go to the same Ekiti Yellow Pages area, with the app's existing green/neutral palette instead of a yellow color scheme. Listing previews and community posts are not published.

## Required backend and moderation milestone

1. Approve independent operator, privacy/legal basis, contact verification, media retention/deletion, sensitive and anonymous reporting safeguards.
2. Set up a dedicated private intake role and secure report/media store **separate from the existing public PostGIS location reader**, with idempotency, access controls and abuse throttling.
3. Produce a real UUID/reference and one-time private tracking secret **only after the database transaction commits**. Do not put tracking secrets or identifying contact details in public URLs.
4. Send a verified email/SMS notification with an opaque **single-use, short-lived claim link** over a configured provider; no receipt download. Verify the recipient first, then establish an authenticated private tracking session. Expired or lost links require a secure recovery flow. Do not expose a bearer tracking secret in external analytics/referrers/logs.
5. Moderate categories, incidents and evidence first. Only safe, deliberately approved summaries/approximate areas can appear on a public Ekiti report map. Sensitive security allegations and identifiable imagery must not be public by default.
6. Differentiate platform intake, proposed routing, delivered, acknowledged, officially responded and resolved with event timestamps and verified office accounts.
7. Validate end-to-end on multiple devices with synthetic cases before enabling real staging intake.

This sprint is client-side only. No live database migrations, official messaging, real backend intake or deployments were performed.
