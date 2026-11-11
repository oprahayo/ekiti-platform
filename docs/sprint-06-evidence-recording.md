# Sprint 06 — reliable private evidence recording (source-only; no live media)

**Status: draft implementation, NOT deployed and NOT authorized to collect evidence.**
Stacked on Sprint 05 draft PR #30. The current production/staging configuration contains no evidence binding or approval, and all `/api/evidence/*` routes return 404.

## What was built

1. **Private session protocol:** `src/evidence/evidence-protocol.ts` and `src/server/private-evidence-routes.ts` define a restricted, separately gated endpoint family for creating an evidence session **only after** an actual report was committed and the resident has its 256-bit private receipt secret. A separate, explicit `evidenceConsent: true` and matching approved evidence policy version are required. Neither the receipt secret nor private evidence bytes appear in URLs or logs.
2. **Continuous per-chunk service contract:** An authorized future MediaRecorder caller can submit each `Blob` as a short, numbered binary segment. 1 MiB maximum per segment, 1,024 possible indices, 15 MB audio / 25 MB video maximum per session. The server checks the SHA-256 digest of every segment, accepts only contiguous sequence numbers, and limits size; the **private R2 object's encrypted ciphertext must be acknowledged, then the SQL metadata ledger committed, before an HTTP 200 `stored: true`** is sent.
3. **Encryption, private storage and least privilege:** Each object is AES-256-GCM encrypted with a fresh, independent 96-bit nonce and authenticated associated data covering its session, index and digest. Only ciphertext is written to an unexposed `EVIDENCE_R2` binding; the key is separately protected by `EVIDENCE_KEY_HEX`. No GET, public bucket URL, evidence preview, agency delivery or moderator download endpoint is created. The evidence SQL connection is **separate** from the report writer and public location reader.
4. **Crash/retry status:** `POST /api/evidence/sessions/:id/status` reauthenticates the secret digest and returns only previously committed chunk indices, checksums and byte counts; the browser `EvidenceUploadQueue` reconciles an acknowledgement lost after the server saved it, and retries unacknowledged chunks while the original tab still holds the raw bytes. `complete` refuses gaps. After a tab/device crash **only already acknowledged segments can be recovered**; unacknowledged media held only in the lost tab **cannot** be recovered. A new capture must start a separate recording session, not silently splice a new MediaRecorder stream into the old one.
5. **Bounded browser queue:** `src/app/evidence-upload-queue.ts` is an explicit, opt-in integration point for later approved `MediaRecorder.ondataavailable` wiring. It retains a small, bounded (5-chunk) volatile queue, reports unsaved segments clearly, does not write media or secrets to localStorage/sessionStorage, and supports manual retry. No automatic request or recording starts without a caller.
6. **Proposed private evidence ledger:** `db/proposals/0010_private_evidence.sql` is an **unapplied migration proposal** with report-bound private sessions, append-only SHA-256 chunk metadata, atomic sequential acknowledgements, restrictive RLS, separate NOLOGIN `ekiti_evidence_api` role, explicit opt-in SQL guard and no grants to anonymous citizens or the public location reader.
7. **Separate release gate:** Neither `REPORTING_ENABLED` nor `EVIDENCE_ENABLED` is enabled. Even when both are true, the evidence service rejects with 503 unless all previous operator/policy/retention checks and a separate evidence approval ID, evidence policy, encryption key, evidence retention attestation, evidence DB, private R2 bucket and evidence quota are configured. Test fixtures **do not** constitute approval.

## Endpoints proposed, not active

| Operation | Method/path | Authentication |
|---|---|---|
| Create | `POST /api/evidence/sessions` | Private reference + secret in JSON, explicit media consent |
| Append | `PUT /api/evidence/sessions/{id}/chunks/{index}` | Secret in Authorization header; body is raw binary; SHA-256 in header |
| Recover status | `POST /api/evidence/sessions/{id}/status` | Receipt secret in Authorization header |
| Finalize | `POST /api/evidence/sessions/{id}/complete` | Receipt secret in Authorization header, expected contiguous count |

All requests require the exact approved HTTPS origin; requests and responses are no-store and no-referrer. Session IDs are identifiers, not authority. The signed receipt **secret** is the authorization credential. R2 object keys remain internal.

## Why this cannot be used for emergency reports yet

**Required but not delivered in this source-only sprint:**

- A legally verified controller, official privacy notice, explicit media consent text, approved evidence-retention schedule, harm-sensitive-case review and real staff operator procedures.
- A real private R2 bucket, key-management/rotation and independent least-privileged evidence database credentials. No keys or bindings were configured, and the SQL has not been independently applied or audited against the shared environment.
- A **tested, running multi-store retention/deletion process** for linked SQL rows, R2 blobs, orphaned failed writes, backups and rotated keys. An SQL `delete_at` field is not a deletion worker. Never set the `EVIDENCE_RETENTION_JOB_VERIFIED` flag without proof.
- Consistency and abuse tests against **real** R2 + PostgreSQL, recovery from disconnected networks and browser crashes, concurrent writes, content scanning/redaction isolation, reviewer MFA, object-access auditing, and emergency-dispatch disclaimer evaluation.
- Final production integration of `EvidenceUploadQueue` into the actual `OnDeviceRecorder`. The current recorder **still collects chunks only in volatile local memory**, not over the network; it correctly displays its existing device-only warning. It must not be described as server-backed or emergency-safe. MediaRecorder container transitions across multiple independent device sessions require media-specific review.

## Verification

- `tests/private-evidence-api.test.mjs`: default 404, independent config fail-closed, private receipt authorization, origin, per-chunk SHA, AES-GCM ciphertext and authenticated AAD, ACK only after ciphertext and ledger, idempotent retry, gap rejection, failed object store and failed DB acknowledgement.
- `tests/evidence-upload-queue.test.mjs`: saved bytes only after matching ACK, lost response reconciliation, offline retry, crash status recovery and never placing secrets in URLs.
- `tests/browser/sprint-06-evidence-offline.spec.ts`: the existing resident recorder still says device-only, sends no evidence requests and all unconfigured evidence routes are 404.
- Prior citizen, privacy, RLS and PostGIS regressions still run. **Migration execution against real database, durable R2 integration, and interrupted-device tests are still missing and remain hard release blockers.**

## Next gate

Sprint 07 — geolocation and coverage — may proceed independently as a source-only feature. Sprint 06 must not be called **live complete** until the above gates pass and the media recording UI has a demonstrated server-acknowledged and interruption-safe path. Do not merge stacked PRs, deploy, apply SQL, provision keys or enable live reporting without separate authorization.
