import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';

type AnalysisScope = { companyId: string; userId: string };
function scopeHeaders(scope: AnalysisScope | null): Record<string, string> {
  return scope ? { 'X-CA46-Company': scope.companyId, 'X-CA46-User': scope.userId } : {};
}

export type AnalysisMode = 'invoice' | 'physical_label';
export type AnalysisJob = { id: string; status: 'queued' | 'running' | 'done' | 'error'; result: Record<string, any> | null; error: string | null };
export type AnalysisProgress = 'recovering' | 'preparing' | 'uploading' | 'server' | 'reconnecting';

export const ANALYSIS_MESSAGES: Record<AnalysisProgress, string> = {
  recovering: 'Comprobando trabajo guardado…',
  preparing: 'Preparando foto. Espera antes de salir…',
  uploading: 'Enviando foto. Espera antes de salir…',
  server: 'Foto recibida. CA46 sigue trabajando aunque salgas.',
  reconnecting: 'Recuperando conexión. Tu trabajo sigue guardado.',
};

class RequestFailure extends Error {
  constructor(message: string, readonly recoverable: boolean) { super(message); }
}

async function jobRequest(url: string, options: RequestInit, scope: AnalysisScope | null, signal?: AbortSignal): Promise<AnalysisJob | null> {
  const response = await fetch(url, {
    ...options, cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    headers: { ...(await tenantAuthorizationHeader()), ...scopeHeaders(scope) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new RequestFailure(body.error || 'No se pudo consultar el análisis.', response.status === 408 || response.status === 429 || response.status >= 500);
  }
  const body = await response.json();
  return body.job ?? null;
}

// Wake on return/connection recovery. Mobile suspension must not consume retries.
function waitForRecovery(delay: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => { cleanup(); reject(signal?.reason); };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (typeof window !== 'undefined') window.removeEventListener('online', finish);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible);
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const visible = () => { if (document.visibilityState === 'visible') finish(); };
    const timer = setTimeout(finish, delay);
    signal?.addEventListener('abort', abort, { once: true });
    if (typeof window !== 'undefined') window.addEventListener('online', finish, { once: true });
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible);
  });
}

export async function analyzeSavedPhoto(
  id: string, mode: AnalysisMode, file: File | (() => Promise<File>), retry = false,
  scope: AnalysisScope | null = null, onProgress: (progress: AnalysisProgress) => void = () => {},
  signal?: AbortSignal,
): Promise<Record<string, any>> {
  let optimized: File | undefined;
  let failures = 0;
  let retryRequested = retry;
  onProgress('recovering');
  for (;;) {
    signal?.throwIfAborted();
    let job: AnalysisJob | null;
    try {
      // Recover first: a lost acknowledgement/reload must not re-upload an accepted photo.
      job = await jobRequest(`/api/label-jobs?id=${encodeURIComponent(id)}`, { method: 'GET' }, scope, signal);
      if (!job || (job.status === 'error' && retryRequested)) {
        if (!optimized) {
          onProgress('preparing');
          optimized = typeof file === 'function' ? await file() : file;
        }
        const form = new FormData();
        form.append('id', id);
        form.append('mode', mode);
        form.append('image', optimized);
        if (retryRequested) form.append('retry', 'true');
        onProgress('uploading');
        job = await jobRequest('/api/label-jobs', { method: 'POST', body: form }, scope, signal);
      }
      if (!job) throw new RequestFailure('No se pudo recuperar el análisis.', true);
      retryRequested = false;
      failures = 0;
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof RequestFailure && !error.recoverable) throw error;
      const suspended = (typeof document !== 'undefined' && document.visibilityState === 'hidden')
        || (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (!suspended && ++failures > 8) throw new Error('No se pudo recuperar la conexión. La foto permanece guardada; vuelve a entrar o pulsa Analizar para continuar.');
      onProgress('reconnecting');
      await waitForRecovery(Math.min(1000 * 2 ** failures, 15000), signal);
      continue;
    }
    if (job.status === 'error') throw new Error(job.error || 'No se pudo leer la fotografía.');
    if (job.status === 'done') return job.result || {};
    onProgress('server');
    await waitForRecovery(1500, signal);
  }
}

export async function discardAnalysisJobs(ids: string[], scope: AnalysisScope | null = null) {
  if (!ids.length) return;
  await fetch('/api/label-jobs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...(await tenantAuthorizationHeader()), ...scopeHeaders(scope) },
    body: JSON.stringify({ ids }),
  });
}
