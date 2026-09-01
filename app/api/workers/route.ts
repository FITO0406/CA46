import { NextResponse } from 'next/server';
import { runImportWorker } from '@/lib/workers/importWorker';
import { runRetentionD47Worker } from '@/lib/workers/retentionD47Worker';
import { runContinuityOutboxWorker } from '@/lib/workers/continuityOutboxWorker';
import { runAuditPiiScrubberWorker } from '@/lib/workers/auditPiiScrubberWorker';
import { assertProductionTarget } from '@/lib/targetGuard';
import { assertGoogleTarget, ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION } from '@/lib/googleTargetGuard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const correlationId = `corr_cron_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const { searchParams } = new URL(req.url);
  const workerParam = searchParams.get('worker') || 'all';

  // Autenticación obligatoria para invocación de Workers (Vercel Cron o token servidor)
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');
  const expectedSecret = process.env.CRON_SECRET || process.env.WORKER_SECRET || 'ca46_server_worker_secret_998877665544332211';

  const isAuthorized = cronHeader === '1' || authHeader === `Bearer ${expectedSecret}`;

  // Si no viene autorizado ni hay workerParam específico, responder healthcheck público básico
  if (!searchParams.get('worker') && !isAuthorized) {
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

  if (!isAuthorized) {
    return NextResponse.json({
      correlationId,
      status: 'UNAUTHORIZED',
      error: 'Acceso no autorizado al ejecutor de Workers. Se requiere token Bearer servidor válido o header de Vercel Cron.'
    }, { status: 401 });
  }

  return executeWorker(workerParam, null, correlationId, 'VERCEL_CRON');
}

export async function POST(req: Request) {
  const correlationId = `corr_post_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
  const workerName = body.workerName || body.worker || 'all';

  return executeWorker(workerName, body.payload, correlationId, 'SERVER_API');
}

async function executeWorker(workerName: string, payload: any, correlationId: string, triggerSource: string) {
  const startTime = Date.now();

  try {
    assertProductionTarget();
    assertGoogleTarget(ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION);

    const timestamp = Date.now();

    if (workerName === 'all') {
      console.log(`[Vercel Cron Trigger] Ejecutando secuencia completa de los 4 Workers (${triggerSource})...`);

      const importResult = await runImportWorker(`job_cron_${timestamp}`);
      const d47Result = await runRetentionD47Worker(`actor_cron_${timestamp}`, { nombre: 'Sintético Cron', email: 'synth_cron@example.com' });

      const outboxPayload = {
        event_id: `TEST_AUTOMATIC_D51_CRON_${timestamp}`,
        actor_id: d47Result.actorId,
        pseudonym: d47Result.pseudonym,
        anonymized_at: new Date().toISOString(),
        compliance_standard: 'D47_GDPR_LOPD',
        test_marker: `TEST_AUTOMATIC_D51_CRON_${timestamp}`
      };

      const outboxResult = await runContinuityOutboxWorker(outboxPayload);
      const scrubberResult = await runAuditPiiScrubberWorker([
        { id: `log_cron_${timestamp}`, message: 'Log de ejecución autónoma Vercel Cron con email user_cron@example.com' }
      ]);

      const durationMs = Date.now() - startTime;

      return NextResponse.json({
        correlationId,
        trigger: triggerSource,
        status: 'SUCCESS',
        durationMs,
        timestampUTC: new Date().toISOString(),
        workersExecuted: 4,
        results: {
          ImportWorker: importResult,
          RetentionD47Worker: d47Result,
          ContinuityOutboxWorker: outboxResult,
          AuditPiiScrubberWorker: scrubberResult
        }
      }, { status: 200 });
    }

    let singleResult: any = null;

    switch (workerName) {
      case 'ImportWorker':
        singleResult = await runImportWorker(payload?.jobId);
        break;

      case 'RetentionD47Worker':
        const actorId = payload?.actorId || `actor_cron_${timestamp}`;
        singleResult = await runRetentionD47Worker(actorId, payload?.piiData || { nombre: 'Sintético Cron', email: 'synth_cron@example.com' });
        break;

      case 'ContinuityOutboxWorker':
        const outboxData = payload || {
          event_id: `TEST_AUTOMATIC_D51_CRON_${timestamp}`,
          actor_id: `actor_auto_${timestamp}`,
          anonymized_at: new Date().toISOString(),
          compliance_standard: 'D47_GDPR_LOPD',
          test_marker: `TEST_AUTOMATIC_D51_CRON_${timestamp}`
        };
        singleResult = await runContinuityOutboxWorker(outboxData);
        break;

      case 'AuditPiiScrubberWorker':
        const logsToScrub = payload?.logs || [
          { id: `log_cron_${timestamp}`, message: 'Log de prueba en ejecutor autónomo con synth_user@example.com' }
        ];
        singleResult = await runAuditPiiScrubberWorker(logsToScrub);
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
      trigger: triggerSource,
      workerName,
      status: 'SUCCESS',
      durationMs,
      timestampUTC: new Date().toISOString(),
      result: singleResult
    }, { status: 200 });

  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[Worker Execution Error] correlationId=${correlationId}:`, err.message);

    return NextResponse.json({
      correlationId,
      trigger: triggerSource,
      status: 'FAILED',
      durationMs,
      timestampUTC: new Date().toISOString(),
      errorCode: 'WORKER_EXECUTION_ERROR',
      message: err.message
    }, { status: 500 });
  }
}
