# Mobile UI v2 — focused edition

Source brief: `ekiti-mobile-ui-dev-prompt-v2-focused.md` provided by the project owner on 10 November 2026. This UI supersedes the earlier single-page location finder as the primary web entry point.

## Stack

React 19 + React Router v7 (declarative routing), TypeScript and vanilla token-based CSS, Vite, Cloudflare Workers static assets, and the existing read-only PostGIS/Supabase Hyperdrive API. No paid APIs or external fonts.

Routes: `/` (Home), `/ask`, `/explore`, `/report`, `/track`, `/track/:publicId`, `/scores`, `/places/:id`. All static paths share the Cloudflare SPA fallback; `/api/*` continues to use the Worker.

## Demonstration status — important

**This is an interface prototype, not a live civic reporting service.** Report categories, local draft storage, optional GPS and boundary lookup use real client logic. The 16-LGA/177-ward reference directory and LGA boundary resolver can still be read through the existing API. The prototype does **not** call `POST /api/reports`, write to Supabase, assign an official case, send reports to agencies, or notify anyone.

Ask is now backed by a live `/api/ask` deterministic, source-backed answer service for supported English and Yorùbá topics; press-release RSS is fetched on demand with a dated fallback and explicit limitations. The app has **no unrestricted generative AI model or paid API key**. See [Ask Ekiti data provenance](ask-ekiti-sources.md). Explore business/place records and Scores metrics are visibly labeled **illustrative**. The example case `DEMO-EKP-2026-00001` and token `DEMO-ONLY-NOT-VALID` cannot access real reports. Track events are fiction with explicit evidence-status labels. No actual event is displayed as a recorded achievement. A live reporting product requires [intake governance and privacy approval](reporting-governance.md).

## Why this interface differs from the previous version

- Home offers exactly three primary jobs: Ask, Report, Explore. No decorative hero, cards, coverage pills, or resume tiles.
- Narrow screens use a fixed five-tab bottom nav with an elevated Report action; it becomes a normal tab below 320px.
- Rich features belong to their own screens, not the home screen. Search/map and voice are opt-in.
- Phone-first tokens are used for light and dark themes, at least 44px targets, system fonts, visible focus, motion limits and reduced-motion.
- A single source of illustrative place fixtures powers Explore list filtering. **No false map pins are shown**; the optional map contains actual reference LGA geometry and explicitly says demo places are not geocoded.
- Voice uses the browser's optional SpeechRecognition API in en-NG or yo-NG when supported, and replies can be played via the browser's speech synthesis voices. Voice audio is handled by the browser's speech implementation; no audio is uploaded to Ekiti Civic. The transcript is editable before a user chooses Send.
- Local report drafts autosave after 500ms under `ekiti-report-preview-v2`. This may expose sensitive text on a shared device: clear the draft after use. No draft narrative is written to the Worker or service worker cache.
- The static service worker caches the public HTML/JS/CSS app shell and already-loaded chunks for offline refresh, but **never** `/api/*`, report bodies or tracking secrets.
- Mock report completion displays no green recorded check or apparent official acknowledgement. Example tokens are intentionally unusable.

## Testing and caveats

Commands:
```sh
npm ci
npm run test:all
npm run staging:check
npm run test:browser
```

Browser acceptance covers Home focus, navigation, route/deep link handling, 280–1440px viewport overflow, nav tap targets, Ask source uncertainty, Explore filtering and lazy map loading, explicit GPS confirmation, a denied-GPS report flow, client-side autosave, offline refresh, demo tracking labels, dark theme, and Scores denominator.

Caveats and follow-up tasks:
- **3G first paint under three seconds must be measured on a real low-end Android device under a representative 3G connection.** CI bundling alone is not a field performance result.
- Manually inspect mobile Safari, Android accessibility services, 200%/400% text enlargement, screen-reader reading order, overlay focus trapping and physical device vibration.
- The browser's speech recognition service may use third-party processing and may not support Nigerian English on every device. Always provide text fallback and avoid implying private local speech processing.
- LocalStorage is convenient but not encrypted and does not provide cross-device resume. Do not use it as a server-side persistence substitute.
- Client-side EXIF stripping processes selected image bytes into a new JPEG for *local preview only*. No photo is submitted or stored by the server.
- For operational place maps, use only reviewed coordinates and add legitimate provenance to each listing. Do not put fictional demo pins on a real Ekiti map.
- A government-affiliation notice must remain visible; the Ekiti State Government seal is deliberately not used.

## Deployment

Cloudflare staging is deployed manually using the existing restricted Hyperdrive setup; no other database privileges are required:

```sh
git pull --ff-only origin main
npm ci
npm run test:all
npm run staging:check
export STAGING_HYPERDRIVE_ID=312d8dc4d1494bc2856606899c8313a8
npm run staging:prepare
npx wrangler deploy --config wrangler.staging.local.json
node scripts/smoke-staging.mjs https://ekiti-platform-staging.inekitikete.workers.dev
```

Only deploy after PR review and passing CI. Do not run `db/proposals/0004_reporting_private.sql` or misrepresent the demo data as real public-service information.
