import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['admin_empresa', 'encargado', 'superadmin']);
const REASONS: Record<string, string> = {
  wrong: 'Etiqueta equivocada',
  duplicate: 'Etiqueta duplicada',
  reading: 'Lectura incorrecta',
  other: 'Otro motivo',
};

function clean(value: unknown, max = 500) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().slice(0, max)
    : '';
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return noStore({ error: tenant.error }, tenant.status);

    const state = new URL(request.url).searchParams.get('state') || 'active';
    let query = supabaseAdmin
      .from('digital_tags')
      .select('id, product_name, origin, category, source, status, is_active, created_at, expires_at, annulled_at, annulled_reason, annulled_note')
      .eq('company_id', tenant.context.companyId)
      .order('created_at', { ascending: false })
      .limit(250);

    if (state === 'annulled') {
      query = query.not('annulled_at', 'is', null);
    } else if (state !== 'all') {
      query = query.eq('is_active', true).is('annulled_at', null).gt('expires_at', new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    return noStore({ labels: data || [], role: tenant.context.role });
  } catch (error: any) {
    console.error('Manage labels GET error:', error);
    return noStore({ error: 'No se pudieron cargar las etiquetas.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return noStore({ error: tenant.error }, tenant.status);

    if (!ALLOWED_ROLES.has(tenant.context.role)) {
      return noStore({ error: 'Tu perfil no tiene permiso para anular etiquetas.' }, 403);
    }

    const body = await request.json().catch(() => null);
    const id = clean(body?.id, 80);
    const reasonKey = clean(body?.reason, 40);
    const note = clean(body?.note, 500);
    const reason = REASONS[reasonKey];

    if (!id) return noStore({ error: 'Falta el identificador de la etiqueta.' }, 400);
    if (!reason) return noStore({ error: 'Selecciona un motivo válido para anular la etiqueta.' }, 400);
    if (reasonKey === 'other' && note.length < 3) {
      return noStore({ error: 'Indica brevemente el motivo de la anulación.' }, 400);
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('digital_tags')
      .select('id, product_name, is_active, annulled_at')
      .eq('id', id)
      .eq('company_id', tenant.context.companyId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) return noStore({ error: 'La etiqueta no pertenece a esta empresa o ya no existe.' }, 404);
    if (existing.annulled_at) return noStore({ error: 'Esta etiqueta ya estaba anulada.' }, 409);

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('digital_tags')
      .update({
        is_active: false,
        annulled_at: now,
        annulled_reason: reason,
        annulled_note: note || null,
        annulled_by_user_id: tenant.context.userId,
      })
      .eq('id', id)
      .eq('company_id', tenant.context.companyId)
      .is('annulled_at', null)
      .select('id, product_name, annulled_at, annulled_reason, annulled_note')
      .maybeSingle();

    if (error) throw error;
    if (!data) return noStore({ error: 'La etiqueta cambió mientras la estabas anulando. Actualiza la pantalla.' }, 409);

    return noStore({ ok: true, label: data });
  } catch (error: any) {
    console.error('Manage labels POST error:', error);
    return noStore({ error: error?.message || 'No se pudo anular la etiqueta.' }, 500);
  }
}
