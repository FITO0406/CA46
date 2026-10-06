import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';

type AnalysisScope = { companyId: string; userId: string };
function scopeHeaders(scope: AnalysisScope | null): Record<string, string> {
  return scope ? { 'X-CA46-Company': scope.companyId, 'X-CA46-User': scope.userId } : {};
}

export type AnalysisMode = 'invoice' | 'physical_label';
export type AnalysisJob = { id: string; status: 'queued' | 'running' | 'done' | 'error'; result: Record<string, any> | null; error: string | null };

export async function analyzeSavedPhoto(id: string, mode: AnalysisMode, file: File, retry = false, scope: AnalysisScope | null = null): Promise<Record<string, any>> {
  const form = new FormData();
  form.append('id', id);
  form.append('mode', mode);
  form.append('image', file);
  if (retry) form.append('retry', 'true');
  let response = await fetch('/api/label-jobs', { method: 'POST', headers: { ...(await tenantAuthorizationHeader()), ...scopeHeaders(scope) }, body: form });
  let body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No se pudo guardar la fotografía para analizarla.');
  let job: AnalysisJob = body.job;
  while (job.status === 'queued' || job.status === 'running') {
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    response = await fetch(`/api/label-jobs?id=${encodeURIComponent(id)}`, { cache: 'no-store', headers: { ...(await tenantAuthorizationHeader()), ...scopeHeaders(scope) } });
    body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No se pudo recuperar el análisis.');
    job = body.job;
    if (!job) throw new Error('El análisis ya no está disponible. Pulsa Analizar para reintentarlo con la foto guardada.');
  }
  if (job.status === 'error') throw new Error(job.error || 'No se pudo leer la fotografía.');
  return job.result || {};
}

export async function discardAnalysisJobs(ids: string[], scope: AnalysisScope | null = null) {
  if (!ids.length) return;
  await fetch('/api/label-jobs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...(await tenantAuthorizationHeader()), ...scopeHeaders(scope) },
    body: JSON.stringify({ ids }),
  });
}
