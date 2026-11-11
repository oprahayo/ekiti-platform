# Sprint 13 — private admin intake, verified LGA scopes and review proposals

**Status: draft implementation and operator-disabled SQL proposal; not deployed.**
Branch `feat/sprint-13-scoped-admin-intake` builds on the unified citizen/admin integration branch (PR #38), retaining both public-safe previews. It follows the roadmap's **Sprint 13 Admin intake dashboard**, with explicit default-deny office/LGA authorization established by the earlier admin sprints.

## What's implemented

- A new **Intake** section inside the isolated **authenticated** staff workspace, not in the public citizen app or fictional admin demonstration. It shows **no data until the user clicks Load authorized intake**. It includes LGA, case type and current independent-platform status filters, with a strict 20-row page (API/DB hard maximum 25). The first-stage view is deliberately limited to case UUID/reference, kind, verified LGA, platform status, revision and receipt/update timestamps.
- The new `GET /admin/api/intake` accepts only `limit`, `lga`, `kind`, `state`, with strict enum, duplicate-parameter and bound validation. SQL re-queries the **server-verified staff member's active, approved, unexpired membership** for each call. The case's LGA must actually be a verified LGA in `geo.areas`. The gateway performs an independent second result-scope check and requires an audited list read before returning data. Directory reviewers, auditors, guests and all government-officer accounts cannot use this platform case queue.
- A separate operator-disabled **proposal-only** `POST /admin/api/intake/:caseId/proposals` validates `{kind,targetLgaId,expectedRevision}` exactly. Supported kinds: `safeguarding_review`, `possible_duplicate`, and `assignment_review`. A case manager or platform administrator can suggest **reviewing** an LGA assignment within a verified/authorized LGA; moderators may request safeguarding or possible-duplicate review but cannot request assignment. The proposal is only pending metadata, not a staff assignment, move, merge, category edit or notification. It has no freeform description, private media, duplicate target case ID or official office ID.
- Proposed actions require a deliberate confirmation and are audited inside the same transaction as the proposal insert. The `civic_private.reports` row is locked for optimistic revision/authorization checks. Proposal replay is idempotent when the author, revision and target match; conflicting uses return 409. Any audit insertion failure rolls the proposal back.
- **Evidence inspection is still locked**, not faked. The API returns only the constant `evidenceAccess='blocked_pending_safeguarding'`; no photos, recordings, external attachment URLs, thumbnails, unreviewed narratives, contact details, exact GPS or vulnerable-person information are returned. Safeguarding review requests do not open the evidence. A separate audited content-access workflow and secure storage have to be independently approved first.
- **Office verification is not yet live (roadmap Sprint 15).** No office-based case routing, government acknowledgement, dispatch, referral, delivery mark, real assignment or “resolved” proof can be created with Sprint 13 code. The internal `government_officer` role still cannot activate, impersonate an agency or access this platform queue.

## Default-off data boundary

`db/proposals/admin_0009_intake_review.sql` **is not a migration**. It requires `SET LOCAL ekiti.admin_intake_reviewed='yes'` inside an independently approved privileged transaction and the preexisting private admin repository proposals. Its `civic_private.admin_intake_release` is created with `enabled=false`; only an independent DB operator with the appropriate role can approve and enable it with a review ID and timestamp. The existing anonymous, `authenticated`, public location reader and `ekiti_admin_rpc` roles cannot update the release switch or directly read the new tables.

The two SQL functions are `SECURITY DEFINER` with fixed search paths and parameterized scalar inputs:
- `civic_private.admin_rpc_intake_cases(actor,lga,kind,state,limit)`
- `civic_private.admin_rpc_intake_propose(actor,case,kind,target_lga,revision)`

Only the separate existing restricted admin RPC role receives EXECUTE. **This is not sufficient by itself for a live user-facing system**: the existing isolated service must cryptographically verify a pinned Supabase JWT, MFA AAL2, session freshness, and independently obtain the membership for the signed subject before calling any RPC. Never expose a caller-supplied `actor` UUID through any generic public PostgREST, public database login or browser URL.

The SQL table `admin_intake_review_proposals` uses a unique `(report_id,kind)` key so the same review request cannot be multiplied without limit. There is **no API to approve these proposals** in this sprint; a later, separately reviewed human moderation and evidence-access workflow is required. A stored proposal is not evidence that a moderator read or resolved it.

## Tests and CI

- `tests/admin-intake-postgis.mjs`: runs only in the disposable **admin** PostGIS CI service, within a rollback transaction; tests the unapproved installation guard and separate disabled release switch, role/table privileges, verified geography, filters, rechecked scope, no narrative/evidence leakage, optimistic revision, idempotent review proposals, role-specific assignment denial, audit failure atomicity, revocation and report expiry.
- `tests/admin-gateway.test.mjs`: signed MFA test fixtures verify the new routes, strict request validation, no unapproved data fallbacks, out-of-LGA repository result rejection, audit-before-return and review-only responses. The public citizen Worker retains its 404 administrative boundary.
- `tests/admin-staff-auth.test.mjs`: validates bounded client filters, authenticated same-origin requests, payload minimization and no evidence/government claim in proposal results.
- Existing citizen CI and the separate admin CI / fictional admin Playwright checks remain active. No Cloudflare deployment is triggered from this Sprint 13 branch.

## Prerequisites before real case intake administration

Independent operator/retention/safeguarding approval, reconciliation of citizen/admin private SQL schema branches, real moderated report intake and deletion enforcement, a verified human staff/MFA roster, separate protected admin Worker credentials, audit retention, verified LGA boundaries, cross-browser signed-in tests, an identity verification policy for potential government offices, and granular evidence inspection with need-to-know authorization are all missing. Do not merge, run proposed SQL, expose private services, turn on flags or deploy live administration without these approvals.

**Next roadmap milestone:** Sprint 14 — reviewed public map projection with explicit publication consent and redaction. Office registry and authentic official assignments follow only after the independent verification phase.
