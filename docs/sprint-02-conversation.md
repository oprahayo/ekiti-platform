# Sprint 02 — Civic welcome icons and reversible private chat

**Status:** Implemented on the development branch, pending CI and merge. Not automatically deployed.

## User-facing changes

- Welcome hero vertically centred in the usable phone viewport, with original, vector, three-dimensional-feel **multi-colour** pictograms for Report an Issue, Give Feedback, Ask about Ekiti, Explore Ekiti, and Post a Listing. Header and five-tab footer are not modified.
- The redundant "Have a report reference? Check tracking" text link was removed; the existing **Track** bottom tab remains. No fake "live" tracking feed or receipt is introduced.
- Guided reporting has a discreet **Back** control. It reopens the previous response, removes the reverted answer and its reply from the visible thread, and preserves editable text. It can also cancel an unfinished typing delay.
- Review's "Change category" removes superseded downstream messages before stepping forward again.
- Chat sound is opt-in, stays off by default, and remembers only a simple on/off preference in browser localStorage. Sound playback uses the user's interaction; no voice commands or unsolicited audio.
- Response prompts are defined centrally in English and Yoruba. Switching language updates the untouched welcome prompt and future chatbot responses. Existing answered bubbles stay as originally written, preserving conversation history.
- Resident can **explicitly resume** a previously **saved** report or feedback draft within 24 hours in the same browser tab's sessionStorage. The local draft restores only purpose, evidence method, category, description, selected LGA and community. It does not recover files, location coordinates, contact details, email, phone or bearer secrets. It cannot submit.
- A session-local saved draft is not a durable account record, government submission, offline sync, or cross-device recovery. Real durable case work is still gated by the later private intake/notification sprints.

## Privacy and operational boundaries

- **No automatic recording upload or remote preservation**. The existing optional MediaRecorder component remains device-only; if the page closes, recordings can be lost.
- The private `/api/reports` and `/api/tracking` endpoints remain **default-off**. No new database tables, permissions, migrations or credentials are required.
- The guide does not claim an official desk received a report, or that an example tracking number can verify government action.
- "Live tracking" is not implemented. The Track page stays the only existing route explaining tracking.
- The header, bottom navigation, geolocation consent rules and reviewed public directory remain unchanged.

## Verification

- Unit tests: prompt completeness in English/Yoruba, saved draft validation and type isolation, expiry and no restored contact/media secrets.
- Chromium browser tests: five distinct multi-colour SVG icons, hero centering, responsive layout at 280/390/1280px, backtracking, revision, opt-in remembered sounds, draft save/recovery and reduced-motion/emergency immediate prompts.
- Full project CI: TypeScript check, all unit/security tests, disposable PostGIS and browser integration checks.

## Deployment

After the PR is merged into `main`, the owner-controlled local procedure (`git pull`, `npm ci`, `npm run test:all`, `npm run staging:check`, `npm run staging:prepare`, `npx wrangler deploy --config wrangler.staging.local.json`, then smoke test) is still required. Merging cannot publish the Cloudflare Worker automatically.
