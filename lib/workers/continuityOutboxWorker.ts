import { writeOutboxToD51Vault, verifyD51Object } from '../d51GcsAdapter';
import { assertProductionTarget } from '../targetGuard';
import { assertGoogleTarget, ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION } from '../googleTargetGuard';

export interface OutboxWorkerResult {
  eventId: string;
  filename: string;
  sha256: string;
  gcsPath: string;
  ackReceived: boolean;
  status: 'CONSOLIDATED' | 'FAILED';
}

export async function runContinuityOutboxWorker(outboxPayload: any): Promise<OutboxWorkerResult> {
  assertProductionTarget();
  assertGoogleTarget(ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION);

  const eventId = outboxPayload.event_id || `evt_${Date.now()}`;
  const filename = `${eventId}.json`;

  console.log(`[ContinuityOutboxWorker] Publicando outbox payload en GCS D51 Vault (${filename})...`);
  const uploadResult = await writeOutboxToD51Vault(filename, JSON.stringify(outboxPayload, null, 2));

  // Verificar integridad SHA-256 e inmutabilidad
  const verification = await verifyD51Object(filename);
  if (!verification.exists || !verification.sha256Match) {
    throw new Error(`[ContinuityOutboxWorker] Error de verificación de integridad SHA-256 para ${filename}`);
  }

  console.log(`[ContinuityOutboxWorker] ACK recibido. Objeto ${filename} consolidado en ${uploadResult.gcsPath}`);

  return {
    eventId,
    filename,
    sha256: uploadResult.sha256,
    gcsPath: uploadResult.gcsPath,
    ackReceived: true,
    status: 'CONSOLIDATED'
  };
}
