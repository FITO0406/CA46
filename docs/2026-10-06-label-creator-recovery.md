# Label creator recovery — 6 October 2026

## Scope

The invoice and physical-label creators kept selected Files, partial OCR results
and manual corrections only in component state. Navigation/reloading discarded
them, and the invoice batch depended on a client-side sequential loop.

This patch changes only those creators, their draft/job helpers and the exact
employee permissions needed to use the job endpoint. The original OCR handlers,
buyer validation, publication handler, expiry rules, Drive, login, billing,
company configuration and all other application areas are unchanged.

## Recovery

- IndexedDB saves actual Files and editable results under company + user + mode,
  with a seven-day local draft retention. Object URLs are recreated on restoration.
- The local draft is committed before analysis begins. Interrupted work restores
  automatically; completed/corrected invoice results are never sent for OCR again.
- Each uploaded photo has an idempotent private server job. Next `after` processes
  accepted uploads independently of the browser and stores the response.
- The existing OCR route functions perform the original document, buyer and tenant
  checks. No bearer tokens are persisted in jobs.
- Atomic worker claims prevent overlapping submissions from running OCR twice.
  A worker interrupted by the platform deadline can be recovered after its lease
  when the owner returns. Uploads not received by the server resume from local Files.
- API requests are bound to the authenticated user/company; expected-scope headers
  also reject requests from a creator left open across an account switch.
- Images are erased from server jobs on completion/failure. Temporary results expire
  after 24 hours and an hourly database job removes expired rows. Publish/discard
  attempts to remove the corresponding jobs immediately.
- No automatic publication is introduced. Human review and the 24/72-hour expiry
  beginning at publication remain unchanged.

## Validation

- Production build, TypeScript and scoped ESLint pass (legacy warnings remain).
- 77 automated tests pass. New mounted React tests exercise photo retention,
  partial-batch recovery, manual edits, transport-error recovery, physical labels
  and account separation. API tests exercise background completion, idempotency,
  ownership, rejection/retry, stale leases and expired jobs.
- Production SQL transaction checks result persistence and immediate image erasure;
  the synthetic row is rolled back. RLS is enabled with no browser table privileges;
  access is solely through authenticated, server-scoped API handlers.
- Production hashes of companies, memberships, company settings and digital tags
  are identical before and after applying the isolated migration and SQL checks.
- Browser verification could not run: the browser installers failed (certificate
  error / truncated browser downloads). No live mobile/browser test is claimed.

## Operational limits

Only photos received by the server can run while the browser is suspended. A photo
still compressing/uploading remains recoverable in this device's local draft and
resumes on return. Recovering that draft requires the same account, origin and
browser storage; clearing browser data removes local Files. Server jobs do not
retain originals as a historical archive.
