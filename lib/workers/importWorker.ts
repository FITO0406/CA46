import { supabase } from '../supabase';
import { assertProductionTarget } from '../targetGuard';

export interface ImportJobResult {
  jobId: string;
  status: 'SUCCESS' | 'FAILED' | 'RETRY';
  processedCount: number;
  message: string;
}

export async function runImportWorker(jobId?: string): Promise<ImportJobResult> {
  assertProductionTarget();

  const id = jobId || `import_job_${Date.now()}`;
  console.log(`[ImportWorker] Iniciando procesamiento de job sintético: ${id}`);

  // Simulación de procesamiento idempotente sobre Supabase Production
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre')
    .limit(1);

  if (error) {
    return {
      jobId: id,
      status: 'FAILED',
      processedCount: 0,
      message: `Error al consultar productos: ${error.message}`
    };
  }

  return {
    jobId: id,
    status: 'SUCCESS',
    processedCount: data ? data.length : 0,
    message: 'Job de importación procesado idempotentemente con éxito.'
  };
}
