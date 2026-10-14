# CA46 → ETPOS bridge (prototype, NOT enabled)

## Scope
- Publish CA46 24h, 72h and kitchen-derived child labels to a per-company synchronization queue.
- On recovery to viewer, queue a new revision of the SAME label and lot. Do not extend validity.
- Product and commercial-family mappings must be verified per ETPOS site.
- Never directly update the vendor's SQLite `.sbd` files or attempt fiscal writes.
- Never sync one company's data to another company's device.

## Event pipeline
1. After the authoritative CA46 label publication/recovery transaction commits, emit one event.
2. Check sale approval and expiry and use `companyId:deviceId:labelId:revision:action` as the idempotency key.
3. Queue pending events with retries, acknowledgement and audit trail. Failed events remain pending/failed, never marked synced.
4. A local authenticated connector maps only vendor-supported fields to the documented ETWS or official importer.
5. Confirm acknowledgement/read-back before marking synced; show per-label state under Mi balanza.
6. On deactivation or recall, queue a deactivate action even when approval/expiry blocks upsert.
7. Do not merge commercial-family IDs with CA46's separate traceability classification.

## Readiness gates (not yet completed)
- Obtain official ETPOS/SDILAB integration specification and authorization, test on the demo.
- Confirm BM5 ARM's actual network configuration and supported data fields.
- Locate the real CA46 creation/publication/recovery/kitchen flows and DB schema and wire transactional outbox events.
- Add company-scoped persistent queue, role authorization, rate limits, encryption and audit records.
- Integration tests for: 24h, 72h, child labels, recovery, expiry, rollback, duplicate delivery,
  connection loss, multi-company isolation, mapping errors, and rejections.
- Deployment: keep ETPOS connection off until explicitly verified; no production migration is included in this prototype.

Current file `lib/etpos/sync-contract.ts` implements only payload types, idempotency and basic gating. It does NOT connect to a balance, modify the database or alter existing screens.
