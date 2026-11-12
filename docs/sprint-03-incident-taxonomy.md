# Sprint 03 — detailed incident taxonomy and cautious safety prompts

**Status:** Proposed change on `feat/sprint-03-incident-taxonomy`; **no Cloudflare deployment, private report activation, or Supabase migration**.

This increment keeps the existing Welcome screen, fixed public header, five actions, conversational draft, and Back/edit/draft recovery controls exactly in their existing roles.

## Implementation

- `src/app/incident-taxonomy.ts` defines a stable, reviewed **15-category** taxonomy: Emergency, Security, Roads, Drainage, Water, Electricity, Sanitation, Health, Education, Environment, Public facilities, Service delay/corruption, Suggestion, Commendation and Other. Each has one human-readable context question and **3–4 optional structured detail choices**. Prompts and options are supplied in English and Yoruba; no cloud model is invoked to infer a personal story.
- The incident-detail question is shown on the existing conversation's description step. A separate simple **"Is anyone in immediate danger right now?"** yes/no/not-sure question is available for reports, with a conservative unknown default; it is not shown for feedback. Existing reports can continue without declaring certainty.
- A declared **Yes** or Emergency category immediately displays a warning to seek actual emergency help. No fake ambulance/police dispatch, agency alert, severity score, official SLA, government response or real case priority is created. All other cases still require human assessment. We never infer danger from free text alone.
- The review screen shows the structured detail, resident-declared danger answer and a **preliminary human-review signal**. It explicitly disclaims official triage and preserves the default-off intake.
- When a previously **explicitly saved text draft exists in the same browser tab**, the review may suggest a **possible overlap only with that draft**: same purpose, exact category, exact LGA and substantial specific word overlap. This is advisory only; no matching against other residents, no private DB reads, no case merge, no false duplicate claims.
- Structured answers are optionally included in the same existing 24-hour, same-tab explicit-save draft. Old drafts remain readable, and invalid taxonomy or safety values are rejected. Raw coordinates, phone, email, media and tracking secrets remain excluded from draft recovery.
- CSS keeps the existing mobile UI and 280px layout. No new page, dashboard, forum, API route or storage mechanism was added.

## Verification

- `npm run test:all`: existing unit/TypeScript checks + new `tests/incident-taxonomy.test.mjs`.
- `npm run test:browser`: prior Sprint 01/02 regression tests and new `tests/browser/sprint-03-taxonomy.spec.ts` for contextual prompts, category revision, urgent notice, local-only overlap, restored answers and 280px bilingual rendering.
- Existing PostgreSQL/PostGIS tests and `npm run staging:check` remain part of CI; they are **dry-run/disposable**.

## Explicit next gates

Sprint 04 must separately settle the privacy operator identity, lawfulness/consent and precise retention/automatic deletion rules, incident safeguarding and threats to reporters. Sprint 05 must separately authorize actual private intake and proof of database commit. Sprint 06 must separately provide continuous server-acknowledged recording—local MediaRecorder is **not** durable evidence storage. No emergency response coordination is represented or claimed by this front-end sprint.

The first staging deployment still requires a separate user-controlled review and authenticated Wrangler operation after merge. This PR must not turn on `REPORTING_ENABLED` or alter secrets.
