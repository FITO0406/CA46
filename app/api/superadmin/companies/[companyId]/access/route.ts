import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { ACCESS_FEATURE_KEYS, normalizeAccessFeatures, type AccessPlan } from '@/lib/company-access-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ companyId: string }> };

const allowedPlans = new Set<AccessPlan>(['gratis', 'autonomo', 'empresa', 'personalizado']);

function isoOrNull(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const { companyId } = await context.params;
    if (!companyId) {
      return NextResponse.json({ ok: false, error: 'Empresa no válida.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .maybeSingle();

    if (companyError) throw companyError;
    if (!company) {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const body = await request.json().catch(() => ({}));
    const active = body?.active !== false;
    const plan = String(body?.plan || 'gratis').trim().toLowerCase() as AccessPlan;
    if (!allowedPlans.has(plan)) {
      return NextResponse.json({ ok: false, error: 'Plan de cortesía no válido.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const indefinite = body?.indefinite !== false;
    const endsAt = indefinite ? null : isoOrNull(body?.endsAt);
    if (active && !indefinite && !endsAt) {
      return NextResponse.json({ ok: false, error: 'Indica la fecha de fin de la cortesía.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    if (active && endsAt && new Date(endsAt).getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: 'La fecha de fin debe ser futura.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const features = plan === 'personalizado' ? normalizeAccessFeatures(body?.features) : normalizeAccessFeatures({});
    if (active && plan === 'personalizado' && !ACCESS_FEATURE_KEYS.some((key) => features[key])) {
      return NextResponse.json({ ok: false, error: 'En un acceso personalizado selecciona al menos una función.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const notes = String(body?.notes || '').trim().slice(0, 600);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('company_access_overrides')
      .select('is_active, starts_at, ends_at, granted_plan')
      .eq('company_id', companyId)
      .maybeSingle();
    if (existingError) throw existingError;

    const nowIso = new Date().toISOString();
    const startsAt = existing?.is_active && (!existing.ends_at || new Date(existing.ends_at).getTime() > Date.now())
      ? existing.starts_at
      : nowIso;

    const { data: saved, error: saveError } = await supabaseAdmin
      .from('company_access_overrides')
      .upsert({
        company_id: companyId,
        is_active: active,
        granted_plan: plan,
        features,
        starts_at: startsAt,
        ends_at: active ? endsAt : null,
        notes,
        granted_by_user_id: access.context.userId,
        updated_at: nowIso,
      }, { onConflict: 'company_id' })
      .select('is_active, granted_plan, features, starts_at, ends_at, notes, granted_by_user_id, updated_at')
      .single();

    if (saveError) throw saveError;

    console.info('superadmin complimentary access', {
      superAdminUserId: access.context.userId,
      superAdminEmail: access.context.email,
      companyId,
      companyName: company.name,
      active: saved.is_active,
      plan: saved.granted_plan,
      endsAt: saved.ends_at,
    });

    return NextResponse.json({
      ok: true,
      grant: {
        active: Boolean(saved.is_active),
        effective: Boolean(saved.is_active) && (!saved.ends_at || new Date(saved.ends_at).getTime() > Date.now()),
        plan: saved.granted_plan,
        features: normalizeAccessFeatures(saved.features),
        startsAt: saved.starts_at,
        endsAt: saved.ends_at,
        notes: saved.notes || '',
        grantedByUserId: saved.granted_by_user_id || '',
        updatedAt: saved.updated_at,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('superadmin/company complimentary access error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la cortesía SuperAdmin.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
