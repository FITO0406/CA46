import { NextResponse } from 'next/server';
import { runImportWorker } from '@/lib/workers/importWorker';
import { runRetentionD47Worker } from '@/lib/workers/retentionD47Worker';
import { runContinuityOutboxWorker } from '@/lib/workers/continuityOutboxWorker';
import { runAuditPiiScrubberWorker } from '@/lib/workers/auditPiiScrubberWorker';
import { assertProductionTarget } from '@/lib/targetGuard';
import { assertGoogleTarget, ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION } from '@/lib/googleTargetGuard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const correlationId = `corr_get_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const { searchParams } = new URL(req.url);
  const workerParam = searchParams.get('worker');

  // Si no se especifica query parameter worker, devolver healthcheck status
  if (!workerParam) {
    try {
      assertProductionTarget();
      assertGoogleTarget(ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION);

      return NextResponse.json({
        status: 'HEALTHY',
        timestamp: new Date().toISOString(),
        targetSupabase: 'xcjhqyjqakknnfbjxlui',
        targetGcsBucket: ALLOWED_GCS_BUCKET_NAME,
        targetGcsRegion: ALLOWED_GCS_REGION,
        availableWorkers: [
          'ImportWorker',
          'RetentionD47Worker',
          'ContinuityOutboxWorker',
          'AuditPiiScrubberWorker'
        ]
      }, { status: 200 });
    } catch (err: any) {
      return NextResponse.json({ status: 'UNHEALTHY', error: err.message }, { status: 500 });
    }
  }

  // Ejecución activada por Cron o enlace directo
  return executeWorker(workerParam, null, correlationId);
}

export async function POST(req: Request) {
  const correlationId = `corr_post_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const body = await req.json().catch(() => ({}));
  const workerName = body.workerName || body.worker;

  return executeWorker(workerName, body.payload, correlationId);
}

async function executeWorker(workerName: string | null, payload: any, correlationId: string) {
  const startTime = Date.now();

  try {
    assertProductionTarget();
    assertGoogleTarget(ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION);

    let workerResult: any = null;

    switch (workerName) {
      case 'ImportWorker':
        workerResult = await runImportWorker(payload?.jobId);
        break;

      case 'RetentionD47Worker':
        const actorId = payload?.actorId || `actor_cron_${Date.now()}`;
        workerResult = await runRetentionD47Worker(actorId, payload?.piiData || { nombre: 'Sintético Cron', email: 'synth_cron@example.com' });
        break;

      case 'ContinuityOutboxWorker':
        const outboxData = payload || {
          event_id: `evt_cloud_${Date.now()}`,
          actor_id: `actor_cloud_${Date.now()}`,
          anonymized_at: new Date().toISOString(),
          compliance_standard: 'D47_GDPR_LOPD',
          test_marker: `WORKER_CLOUD_EXECUTION_${Date.now()}`
        };
        workerResult = await runContinuityOutboxWorker(outboxData);
        break;

      case 'AuditPiiScrubberWorker':
        const logsToScrub = payload?.logs || [
          { id: `log_${Date.now()}`, message: 'Log de prueba en ejecutor de nube con user_email@example.com' }
        ];
        workerResult = await runAuditPiiScrubberWorker(logsToScrub);
        break;

      default:
        return NextResponse.json({
          correlationId,
          error: `Worker '${workerName}' no reconocido.`
        }, { status: 400 });
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      correlationId,
      workerName,
      status: 'SUCCESS',
      durationMs,
      timestamp: new Date().toISOString(),
      result: workerResult
    }, { status: 200 });

  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[Worker Execution Error] correlationId=${correlationId}:`, err.message);

    return NextResponse.json({
      correlationId,
      status: 'FAILED',
      durationMs,
      timestamp: new Date().toISOString(),
      errorCode: 'WORKER_EXECUTION_ERROR',
      message: err.message
    }, { status: 500 });
  }
}
