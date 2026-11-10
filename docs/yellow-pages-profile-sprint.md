# Sprint — sticky mobile navigation, Yellow Pages, citizen profile and reviews

Status: **reviewed UI candidate only**, not deployed to Cloudflare. No authentication, owner claims, public reviews or case intake are activated.

## Screenshot interpretation and design decisions

The owner supplied four Yellow Pages references featuring a yellow/white palette, icon-rich service categories, a business-details photo hero with action buttons, ratings/reviews tab, saved entries, a profile, and a short About modal. The implementation follows their interaction patterns **without** copying the fictional business names, ratings, personal photograph, review counts, or sample account identity in those references.

Ekiti Civic keeps its lowercase wordmark and red dot, English/Yoruba controls, voice-enabled Ask, report chat, Track and independent-project disclaimer. Yellow Pages is a directory sub-brand, with an original open-book and location icon, yellow-accent search section and existing 24 category icons.

### Navigation & mobile

- Shared **sticky header** on every route, `position: sticky; top: 0`, raised z-index and background. Top padding respects iPhone safe-area inset; the optional header profile shortcut hides at narrow widths while Profile remains a permanent bottom tab.
- Bottom navigation: Home, Explore, Report, Track, Profile. Scores remains available through Profile.
- Existing fixed bottom navigation and conversation composer do not change. Screen routes retain scrolling, deep-link support and keyboard focus.
- Yellow Pages uses a focused header, LGA filter, three relevant quick actions (near me, categories, add listing), and existing 24 categorized illustrations. Direct account buttons do not submit personal data.

### Directory record

- Published-source reviewed listings can show a licensed storefront photo, confirmed public contacts, category/LGA, source attribution, and Google Maps directions **only when exact coordinates were reviewed**.
- No fabricated `open now`, distances, review counts, star averages or owner verification badges.
- Tabs: Overview, Reviews, Services, Photos. Empty states distinguish not-yet-collected information from negative real-world claims.
- "Save" stores only a published listing UUID in the device's localStorage; local saves are not synchronized or a citizen account.
- Reviews accept 1–5 star **local drafts** with a short text note; nothing is submitted, counted, publicly posted or tied to an identity. The user can delete the saved draft. Sign-in prompts are disclosure dialogs, not fake credential forms.
- The owner-claim action explains the verification process but does not ask for KYC documents or expose an unprotected upload.

### Profile & About

- Guest profile shows **actual local counts** of saved reviewed listing IDs and unpublished review drafts, and explains device-only storage.
- Saved entries are refetched from the reviewed listing endpoint and remain hidden if withdrawn/unavailable.
- Profile opens an accessible native `dialog` for About & Contact, sign-in, listing management, and notifications. About is not a separate route.
- The contact email was included in the supplied mockup and **must be confirmed by the project owner before release**; no unconfirmed support phone or person is copied from the references.
- Authentication, verified ownership, public reviews, moderation and notifications require a later backend milestone; do not present guest storage as a real account.

### Location

- "Near me" requests browser geolocation only when pressed, then separately asks for permission to send coordinates for the existing verified LGA lookup.
- The filter shows matching **LGA** listings, explicitly not distance-ranked nearby businesses.
- No persistent or implicit GPS tracking.

## Validation

- Browser: 280, 320, 360, 375, 390, 428, 768px sticky-header and navigation checks, category search, Near Me two-step consent, guest Profile, About modal Escape, verified listing contact links, honest ratings, draft saving, and claim disclosure.
- Node: localStorage corruption, ID allowlist, ratings bounds and no storage of demo listing review drafts.
- Existing: bilingual Ask, report drafts and tracking, source-backed query, PostGIS isolation, geographic API and responsive Explore categories.

## Release gates

1. Confirm the project support address from the reference image.
2. Review frontend in mobile Safari, Android browser, with 200% zoom, reduced-motion and screen reader.
3. Secure identity and business claim verification, review anti-spam/moderation and appropriate retention/access policies must be designed and approved before enabling writes.
4. The prepared knowledge-directory migration (0004) remains approval-gated. These interfaces are designed to render honest empty states if the directory is not yet populated or deployed.
5. Do not deploy automatically or add paid inference APIs.
