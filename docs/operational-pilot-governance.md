# inEkiti Official — operational pilot ownership record

**Decision recorded:** 11 November 2026.
**Source:** Project owner explicitly selected **inEkiti Official** as the responsible operator name for Ekiti Civic.
**Status:** Product/governance decision accepted; formal legal and operational verification pending. This document is **not** a published privacy notice or permission to receive live reports.

## Designation

- **Public-facing operator name:** inEkiti Official
- **Platform:** Ekiti Civic
- **Operating model:** independent civic information and reporting platform, **not** Ekiti State Government and not an emergency-response agency
- **Responsible legal entity / registration:** **unverified / to be established**. Do not silently substitute a developer's company or the owner's personal name. A public brand by itself does not establish the legal person who controls citizen personal data.
- **Accountable person and contact channel:** owner must verify these before collection of actual citizen reports; do not infer or invent a staff roster, emergency phone number or government partnership.

## Pilot scope awaiting release

1. Start with **anonymous, consent-based text reports**, reviewed by an authorized inEkiti Official moderator. The platform may issue its own persisted receipt and private status, but it must never imply an office received, read, acknowledged or resolved the report without separate authenticated evidence.
2. **Photo, video, audio, contact details, precise incident GPS and public report pins** require distinct data-minimization, safeguarding, retention and access decisions. Keep the existing blockers until implemented and verified.
3. A report about immediate danger should prominently direct residents to relevant emergency services; inEkiti Official is **not a real-time emergency dispatcher** unless a genuine receiving operation and verified escalation protocol exist.
4. The admin gateway must require independently verified staff membership, MFA, least-privilege LGA scope, audit logs and revocation; no staff member or office can be synthesized from a demo fixture.
5. No government office account, agency endorsement, report transmission, or governmental acknowledgement may be advertised until the named office, recipient and channel are verified and explicitly enrolled.

## Decisions that must be documented before public collection

- Which legally identifiable entity or person behind inEkiti Official will be the data controller, with a working public privacy contact
- Privacy/consent notice and complaint/safety procedures, reviewed for applicable law
- Retention interval, enforceable record deletion, backup expiry and subject-access/deletion process (include verified end-to-end tests)
- Named responsible moderators, incident handling, safeguards for threats involving children or vulnerable persons, and abuse escalation
- Separate restricted database writers, audit boundaries, authentication provider, least-privilege secrets, incident recovery and feature-off/rollback plan
- If an initial Ekiti LGA pilot is planned, the selected LGA and an independently confirmed receiving/moderation team

## Activation order

Start with reversible, secured pilot infrastructure and real text-only report receipts in a **separate staging environment**. After proven end-to-end tests and the above decisions, deploy an expressly limited private pilot. Add media, notifications, verified office integration and public map accountability as separately audited features.

**Do not** set `REPORTING_ENABLED=true`, `EVIDENCE_ENABLED=true`, `REPORTING_RETENTION_JOB_VERIFIED=true`, or other approval switches merely because the owner named an operator. The current unified staging is still a guest-only preview with a fictional admin demo.

Links: [operational activation plan](https://github.com/oprahayo/ekiti-platform/issues/42) · [combined private schema CI](https://github.com/oprahayo/ekiti-platform/pull/43).
