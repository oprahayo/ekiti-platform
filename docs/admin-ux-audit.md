# Admin navigation and mobile usability audit — 10 November 2026

## Method

Reviewed the **actual Chromium-rendered** administrative app from Playwright screenshots at desktop 1280×800, mobile 390×844, and narrow 280×720. Screenshots were produced in GitHub Actions in the `admin-visual-review` artifact, not imagined design renderings. Browser functional and strict TypeScript checks also run in GitHub CI.

## Findings in the existing draft

1. The mobile bottom bar had **nine horizontally scrolling entries** (all cases plus five status queues, moderation, routing and analytics). The important Moderation and Routing sections were hidden outside the first phone screen.
2. Moderation and Routing stacked their list and detail inspector on mobile. A selected item showed list rows above the detail, wasting a phone viewport and making action controls hard to locate.
3. Case statuses were at the same navigational level as whole workspaces, duplicating the information architecture and making the product feel like a generic dashboard template.
4. Demo warnings and action results were verbose. Demo-only mode was necessary, but the interface needed more usable, prominent focus states and clearer feedback.
5. No view-specific deep links; reloading any screen returned to All cases.

## Delivered UX changes

- Four visible, stable primary destinations: **Cases, Moderation, Routing, Overview**. Consistent SVG icons instead of miscellaneous Unicode glyphs.
- Native, keyboard-accessible **Filter by status** selector inside Cases, with truthful counts. Moderation now has a native mobile category selector so none of the five review types are off-screen.
- Overview now offers three working actions into Unassigned, Moderation and Routing instead of relying solely on generic metric cards.
- Separate mobile list and inspector views for Moderation and Routing, explicit back controls, no hidden side-scroll navigation. When a detail opens, introductory copy and category controls move out of the way.
- Direct, whitelisted `?view=` URL state for these sections/queues; browser back/forward works. No private case data, narratives, GPS or token enters a URL.
- Condensed demo notice on mobile; results from internal actions clearly say they were **local only**.
- Regression tests for 280px navigation visibility, mobile two-step detail flows, deep-link/back behavior and routing/claim safeguards.
- The existing desktop sidebar and two-pane professional workflow remain available.

## Acceptance and next engineering gate

The UI remains a local standalone demo. The next operational milestone is an authenticated server-side authorization boundary, verified office registry, privacy/retention approval and restricted case APIs. Do not interpret a UX preview or the `DEMO-` sample events as real cases or government activity.

Accessibility release checks should eventually include external keyboard/screen-reader audits, contrast testing, 200% zoom, offline/reconnect behavior, and supervised user testing on low-end Android devices. Playwright automated coverage does not replace those checks.
