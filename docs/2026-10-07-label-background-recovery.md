# Label analysis recovery — 7 October 2026

The label creators previously displayed analysis before upload acknowledgement.
A failed polling request ended the client flow, and restoring a received job
compressed and uploaded its photo again before recovering the saved response.

This patch limits application changes to both label creators, the shared analysis
client and the existing label-jobs worker. No migration, dependency, credential,
authentication, publication, retention, Drive or billing change is required.

- Per-photo progress separates preparing/uploading from server acceptance.
- Every start/resume consults the existing scoped job before compression/upload.
  Ambiguous POST failures also consult the job before sending anything again.
- Transport/timeouts/temporary API failure use bounded recovery with backoff.
  Online/visible events wake the wait immediately. Hidden/offline time does not
  exhaust the transport retry counter. Account/auth/validation failures remain
  terminal. A page teardown stops client polling, not the accepted server job.
- The worker retries transient OCR failures once, with sufficient remaining
  lifetime. It does not retry missing configuration or buyer/document rejection.
  Original OCR handlers, idempotent claims and scoped result storage are retained.

Validation: production build/TypeScript passed; scoped ESLint has zero errors
(existing warnings remain); 88 tests passed. New functional tests cover lost
upload acknowledgement, same-page network recovery, suspended/offline recovery,
accepted-result retrieval without compression, cancellation, account mismatch,
visible progress in both creators and bounded independent worker retries.
Production read-only inspection found one completed invoice job in the last
24 hours and no stale running job; recent error-log inspection returned no logs.

Limits: only photos received by the server can run after mobile suspension.
Unreceived uploads resume from the same browser's saved draft. Hard platform
termination still uses the existing lease-based recovery when the owner returns;
this patch does not introduce a durable external queue. Real Android lock-screen
or app-switch testing is not claimed: the container browser download failed and
the cloud browser's CA46 creator requires a signed-in session.
