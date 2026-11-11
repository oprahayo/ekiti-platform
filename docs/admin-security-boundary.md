# Administrative security boundary — preparatory milestone

**Status:** Tested source-only authorization primitives, not a launched admin backend or a usable production login.

The admin UI is a **fictional demo**. Its buttons do not communicate with the database. This milestone adds two server-only foundations for a future separate invitation-only administration service:

- `src/server/admin-auth.ts`: strict asymmetric JWT verification (ES256 or RS256 only), pinned HTTPS issuer and audience, trusted server-owned JWKS resolver, correct `kid`, verified signature, authenticated role, UUID subject, AAL2 MFA claim, expiry, issued-at and max one-hour token lifetime. Rejects unsigned/HS tokens, forged claims, expired tokens, bad keys and wrong issuer/audience. **Never accept a JWK URL or key from the incoming request.**
- `src/server/admin-access.ts`: independent, default-deny membership authorization. Fetch a membership from a restricted **server-controlled registry** after validating identity; never trust a client-supplied role or `user_metadata`. Distinct platform admin, case manager, moderator, directory reviewer, government officer and auditor capabilities. Restrict LGA case access; allow agency acknowledgement/view/response only under verified office identity and matching office delivery/referral evidence. Platform admins cannot impersonate officers.

## Authentication is not yet connected

There is no `/api/admin` route, production staff login, membership table, signing-key fetch, report writer, permission grant, real office directory, or deployment. The existing public Worker explicitly responds 404 for admin routes. Tests use generated disposable keys and fictional role/office information. The frontend **does not** grant permissions.

## Required before enabling this backend

1. Review operator identity, legal entity, consent/retention/deletion, case sensitivity, emergency triage and audit responsibilities.
2. Set up a dedicated verified staff identity provider / Supabase Auth project or approved tenant with MFA, invite-only registration, short session TTL, disable/revoke workflows and managed JWKS.
3. Introduce a private server-read membership/office registry, auditable administrator approval, authenticated staff offboarding and protected staff invitation procedure.
4. Implement separate admin endpoints with the above verification before every request, rate-limiting, origin/CSRF protection, strict body validation, safe errors, idempotency and real append-only events.
5. Test vertical and horizontal authorization, forged tokens, key rotation, suspended staff, expired membership, LGA boundaries, officer mismatch, agency read/proof replay, incident response and 280px mobile accessibility.
6. Apply reviewed migrations only to isolated staging after governance sign-off. Never grant the location reader role any case-write capability.

**Note:** The JWT checks here are a reusable building block, not a replacement for security review. The future key resolver must pin a trustworthy identity issuer and handle rotations safely. Access control must be enforced server-side on every query, not by hiding UI elements.
