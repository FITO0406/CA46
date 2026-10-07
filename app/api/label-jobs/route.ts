import { randomUUID } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest, type TenantRequestContext } from '@/lib/tenant-auth-server';
import { POST as analyzeInvoice } from '@/app/api/analyze-invoice/route';
import { POST as analyzePhysicalLabel } from '@/app/api/analyze-physical-label/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const TABLE = 'label_analysis_jobs';
const PUBLIC_FIELDS = 'id,mode,status,result,error,started_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEASE_MS = 330000; // Longer than this route's hard lifetime.
const headers = { 'Cache-Control': 'no-store' };

function scopeChanged(request: Request, context: TenantRequestContext) {
  const company = request.headers.get('x-ca46-company');
  const user = request.headers.get('x-ca46-user');
  return (company && company !== context.companyId) || (user && user !== context.userId);
}

function scoped(context: TenantRequestContext) {
  return supabaseAdmin.from(TABLE).select(PUBLIC_FIELDS)
    .eq('company_id', context.companyId).eq('user_id', context.userId).gt('expires_at', new Date().toISOString());
}

async function runJob(id: string, context: TenantRequestContext, authorization: string) {
  const runId = randomUUID();
  const { data: job, error: claimError } = await supabaseAdmin.from(TABLE)
    .update({ status: 'running', run_id: runId, started_at: new Date().toISOString() })
    .eq('id', id).eq('company_id', context.companyId).eq('user_id', context.userId).eq('status', 'queued')
    .select('mode,image_base64,file_name,mime_type').maybeSingle();
  if (claimError || !job) return;
  try {
    const path = job.mode === 'invoice' ? '/api/analyze-invoice' : '/api/analyze-physical-label';
    // Reuse the existing authenticated OCR handlers unchanged: buyer and document
    // validation remain identical. The user's token is never stored in the job.
    const started = Date.now();
    let response: Response;
    let payload: any;
    for (let attempt = 0; ; attempt++) {
      const form = new FormData();
      form.append('image', new File([Buffer.from(job.image_base64, 'base64')], job.file_name, { type: job.mime_type }));
      const request = new Request(`https://ca46.internal${path}`, { method: 'POST', headers: { Authorization: authorization }, body: form });
      response = await (job.mode === 'invoice' ? analyzeInvoice(request) : analyzePhysicalLabel(request));
      payload = await response.json();
      // Retry transient reader failures within the existing worker lifetime.
      // Buyer/document/auth rejection and missing configuration remain final.
      const transient = response.status === 429 || response.status >= 500;
      if (!transient || payload.code === 'AI_NOT_CONFIGURED' || attempt >= 1 || Date.now() - started > 85000) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    }
    const { error } = await supabaseAdmin.from(TABLE).update({
      status: response.ok ? 'done' : 'error', result: response.ok ? payload : null,
      error: response.ok ? null : payload.error || 'No se pudo analizar la fotografía.', image_base64: null,
    }).eq('id', id).eq('company_id', context.companyId).eq('user_id', context.userId).eq('run_id', runId);
    if (error) throw error;
  } catch (error) {
    await supabaseAdmin.from(TABLE).update({ status: 'error', image_base64: null, error: error instanceof Error ? error.message : 'El análisis se interrumpió. Reinténtalo con la foto guardada.' })
      .eq('id', id).eq('company_id', context.companyId).eq('user_id', context.userId).eq('run_id', runId);
  }
}

async function scheduleJob(job: any, context: TenantRequestContext, authorization: string) {
  if (job?.status === 'running' && Date.now() - Date.parse(job.started_at) > LEASE_MS) {
    // A killed server invocation can be recovered without racing a live worker.
    const { error } = await supabaseAdmin.from(TABLE).update({ status: 'queued', run_id: null })
      .eq('id', job.id).eq('company_id', context.companyId).eq('user_id', context.userId)
      .eq('status', 'running').lte('started_at', new Date(Date.now() - LEASE_MS).toISOString());
    if (error) throw error;
    job.status = 'queued';
  }
  if (job?.status === 'queued') after(() => runJob(job.id, context, authorization));
}

export async function GET(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers });
    if (scopeChanged(request, tenant.context)) return NextResponse.json({ error: 'La cuenta ha cambiado. Vuelve a entrar al creador de etiquetas.' }, { status: 409, headers });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ companyId: tenant.context.companyId, userId: tenant.context.userId }, { headers });
    if (!UUID.test(id)) return NextResponse.json({ error: 'Identificador de análisis inválido.' }, { status: 400, headers });
    const { data: job, error } = await scoped(tenant.context).eq('id', id).maybeSingle();
    if (error) throw error;
    await scheduleJob(job, tenant.context, request.headers.get('authorization') || '');
    return NextResponse.json({ job }, { headers });
  } catch (error) {
    console.error('Label job recovery failed:', error);
    return NextResponse.json({ error: 'No se pudo recuperar el trabajo guardado.' }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers });
    if (scopeChanged(request, tenant.context)) return NextResponse.json({ error: 'La cuenta ha cambiado. Vuelve a entrar al creador de etiquetas.' }, { status: 409, headers });
    const form = await request.formData();
    const id = String(form.get('id') || '');
    const mode = String(form.get('mode') || '');
    const file = form.get('image');
    if (!UUID.test(id) || !['invoice', 'physical_label'].includes(mode)) return NextResponse.json({ error: 'Tipo o identificador de análisis inválido.' }, { status: 400, headers });
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'No se ha recibido ninguna fotografía.' }, { status: 400, headers });
    if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: 'La fotografía es demasiado grande. Usa una imagen de menos de 6 MB.' }, { status: 413, headers });
    const { data: existing, error: readError } = await scoped(tenant.context).eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (existing && existing.mode !== mode) return NextResponse.json({ error: 'El análisis pertenece a otro tipo de documento.' }, { status: 409, headers });
    if (!existing) {
      const { error } = await supabaseAdmin.from(TABLE).delete().eq('id', id)
        .eq('company_id', tenant.context.companyId).eq('user_id', tenant.context.userId).lte('expires_at', new Date().toISOString());
      if (error) throw error;
    }
    let job = existing;
    if (!existing || (existing.status === 'error' && form.get('retry') === 'true')) {
      const image = Buffer.from(await file.arrayBuffer()).toString('base64');
      const values = { status: 'queued', result: null, error: null, image_base64: image, file_name: file.name, mime_type: file.type || 'application/octet-stream', run_id: null, started_at: null, expires_at: new Date(Date.now() + 86400000).toISOString() };
      if (existing) {
        const { error } = await supabaseAdmin.from(TABLE).update(values).eq('id', id).eq('company_id', tenant.context.companyId).eq('user_id', tenant.context.userId).eq('status', 'error');
        if (error) throw error;
      } else {
        // Ignore an overlapping upload with the same id; the original job wins.
        const { error } = await supabaseAdmin.from(TABLE).upsert({ ...values, id, mode, company_id: tenant.context.companyId, user_id: tenant.context.userId }, { onConflict: 'company_id,user_id,id', ignoreDuplicates: true });
        if (error) throw error;
      }
      const { data, error } = await scoped(tenant.context).eq('id', id).single();
      if (error) throw error;
      job = data;
    }
    await scheduleJob(job, tenant.context, request.headers.get('authorization') || '');
    return NextResponse.json({ job }, { status: 202, headers });
  } catch (error) {
    console.error('Label job upload failed:', error);
    return NextResponse.json({ error: 'No se pudo guardar la fotografía para analizarla. Tu borrador permanece en el móvil.' }, { status: 503, headers });
  }
}

export async function DELETE(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers });
    if (scopeChanged(request, tenant.context)) return NextResponse.json({ error: 'La cuenta ha cambiado. Vuelve a entrar al creador de etiquetas.' }, { status: 409, headers });
    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (!ids.length || ids.length > 100 || ids.some((id: unknown) => typeof id !== 'string' || !UUID.test(id))) return NextResponse.json({ error: 'Identificadores inválidos.' }, { status: 400, headers });
    const { error } = await supabaseAdmin.from(TABLE).delete().eq('company_id', tenant.context.companyId).eq('user_id', tenant.context.userId).in('id', ids);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo limpiar el análisis temporal.' }, { status: 503, headers });
  }
}
