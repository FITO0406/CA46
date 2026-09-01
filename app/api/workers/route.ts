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

  // Si no se especifica query parameter worker, devolver healthcheck status público
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

  // FASE 3: Autenticación obligatoria para ejecución de Workers
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');
  const expectedSecret = process.env.CRON_SECRET || process.env.WORKER_SECRET || 'ca46_server_worker_secret_998877665544332211';

  const isAuthorized = cronHeader === '1' || authHeader === `Bearer ${expectedSecret}`;

  if (!isAuthorized) {
    return NextResponse.json({
      correlationId,
      status: 'UNAUTHORIZED',
      error: 'Acceso no autorizado al ejecutor de Workers. Se requiere token Bearer servidor válido o header de Vercel Cron.'
    }, { status: 401 });
  }

  // Ejecución autorizada activada por Vercel Cron o secreto servidor
  return executeWorker(workerParam, null, correlationId);
}

export async function POST(req: Request) {
  const correlationId = `corr_post_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // FASE 3: Autenticación obligatoria para ejecución POST
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');
  const expectedSecret = process.env.CRON_SECRET || process.env.WORKER_SECRET || 'ca46_server_worker_secret_998877665544332211';

  const isAuthorized = cronHeader === '1' || authHeader === `Bearer ${expectedSecret}`;

  if (!isAuthorized) {
    return NextResponse.json({
      correlationId,
      status: 'UNAUTHORIZED',
      error: 'Acceso no autorizado al ejecutor de Workers.'
    }, { status: 401 });
  }

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
        const timestamp = Date.now();
        const outboxData = payload || {
          event_id: `TEST_AUTOMATIC_D51_PRELOCK_${timestamp}`,
          actor_id: `actor_auto_${timestamp}`,
          anonymized_at: new Date().toISOString(),
          compliance_standard: 'D47_GDPR_LOPD',
          test_marker: `TEST_AUTOMATIC_D51_PRELOCK_${timestamp}`
        };
        workerResult = await runContinuityOutboxWorker(outboxData);
        break;

      case 'AuditPiiScrubberWorker':
        const logsToScrub = payload?.logs || [
          { id: `log_cron_${Date.now()}`, message: 'Log de prueba en ejecutor autónomo con synth_user@example.com' }
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
