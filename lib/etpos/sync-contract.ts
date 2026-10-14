/**
 * CA46 → ETPOS: contract for the local bridge.
 * No calls to ETPOS or direct writes to ETPOS SQLite are performed here.
 * The bridge must be deployed locally and use an approved vendor interface.
 */
export type LabelSource = "24h" | "72h" | "cocina_hija";
export type SyncAction = "upsert" | "deactivate";
export type SyncStatus = "pending" | "synced" | "failed" | "blocked";

export interface LabelSyncEvent {
  eventId: string;
  companyId: string;
  deviceId: string;
  labelId: string;
  revision: number;
  action: SyncAction;
  source: LabelSource;
  occurredAt: string;
  // Product identity stays stable when a label is recovered.
  productCode: string;
  productName: string;
  commercialFamilyCode: string;
  lotCode: string;
  parentLotCode?: string;
  // Explicit validity checks prevent sale of expired/recalled goods.
  expiresAt?: string;
  approvedForSale: boolean;
}

export interface SyncDecision {
  status: "pending" | "blocked";
  reason?: string;
  deduplicationKey: string;
}

export function evaluateLabelSync(
  event: LabelSyncEvent,
  now: Date = new Date(),
): SyncDecision {
  if (!event.companyId || !event.deviceId || !event.labelId || !event.productCode ||
      !event.productName || !event.commercialFamilyCode || !event.lotCode ||
      !Number.isSafeInteger(event.revision) || event.revision < 1) {
    throw new Error("Invalid CA46/ETPOS synchronization event");
  }
  const deduplicationKey =
    [event.companyId, event.deviceId, event.labelId, event.revision, event.action].join(":");
  if (event.action === "deactivate") return { status: "pending", deduplicationKey };
  if (!event.approvedForSale) {
    return { status: "blocked", reason: "Sale approval is missing", deduplicationKey };
  }
  if (event.expiresAt) {
    const expiration = new Date(event.expiresAt);
    if (Number.isNaN(expiration.getTime()) || expiration.getTime() <= now.getTime()) {
      return { status: "blocked", reason: "Expired or invalid validity date", deduplicationKey };
    }
  }
  return { status: "pending", deduplicationKey };
}

/** Use only after the CA46 publication transaction has committed.
 * A recovered label produces a NEW revision and preserves its original lot,
 * traceability, and legal expiration; it never automatically extends shelf life.
 */
export function labelSyncIdempotencyKey(event: LabelSyncEvent): string {
  return evaluateLabelSync(event).deduplicationKey;
}
