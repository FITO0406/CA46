import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedStatuses = new Set(['none', 'trial', 'active', 'pending', 'unpaid', 'cancelled']);
const allowedProviders = new Set(['none', 'manual']);

function parseNullableDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('Fecha no válida.');
  return date.toISOString();
}

export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const [companiesResult, subscriptionsResult, authUsersResult] = await Promise.all([
      supabaseAdmin
        .from('companies')
        .select('id, name, plan, status, owner_user_id, created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('company_subscriptions')
        .select('company_id, plan, status, provider, price_cents, currency, started_at, current_period_start, current_period_end, trial_ends_at, cancelled_at, notes, updated_at'),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (companiesResult.error) throw companiesResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;

    const ownerEmails = new Map<string, string>();
    if (!authUsersResult.error) {
      for (const user of authUsersResult.data.users || []) ownerEmails.set(user.id, user.email || '');
    }

    const subscriptions = new Map((subscriptionsResult.data || []).map((row) => [row.company_id, row]));
    const items = (companiesResult.data || []).map((company) => {
      const subscription = subscriptions.get(company.id);
      return {
        companyId: company.id,
        companyName: company.name,
        ownerEmail: ownerEmails.get(company.owner_user_id) || '',
        companyPlan: company.plan,
        companyStatus: company.status,
        createdAt: company.created_at,
        subscription: subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              provider: subscription.provider,
              priceCents: subscription.price_cents,
              currency: subscription.currency,
              startedAt: subscription.started_at,
              currentPeriodStart: subscription.current_period_start,
              currentPeriodEnd: subscription.current_period_end,
              trialEndsAt: subscription.trial_ends_at,
              cancelledAt: subscription.cancelled_at,
              notes: subscription.notes || '',
              updatedAt: subscription.updated_at,
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('superadmin/subscriptions GET error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudieron cargar las suscripciones.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const body = await request.json().catch(() => ({}));
    const companyId = String(body?.companyId || '').trim();
    if (!companyId) return NextResponse.json({ ok: false, error: 'Empresa no válida.' }, { status: 400 });

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('company_subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ ok: false, error: 'Suscripción no encontrada.' }, { status: 404 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body?.status !== undefined) {
      const status = String(body.status || '').trim().toLowerCase();
      if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: 'Estado de suscripción no válido.' }, { status: 400 });
      update.status = status;
      if ((status === 'trial' || status === 'active') && !existing.started_at) update.started_at = new Date().toISOString();
      update.cancelled_at = status === 'cancelled' ? (existing.cancelled_at || new Date().toISOString()) : null;
      if (status === 'none') {
        update.provider = 'none';
        update.current_period_start = null;
        update.current_period_end = null;
        update.trial_ends_at = null;
      }
    }

    if (body?.provider !== undefined) {
      const provider = String(body.provider || '').trim().toLowerCase();
      if (!allowedProviders.has(provider)) return NextResponse.json({ ok: false, error: 'Proveedor de cobro no válido para esta fase.' }, { status: 400 });
      update.provider = provider;
    }

    if (body?.currentPeriodEnd !== undefined) update.current_period_end = parseNullableDate(body.currentPeriodEnd);
    if (body?.trialEndsAt !== undefined) update.trial_ends_at = parseNullableDate(body.trialEndsAt);
    if (body?.notes !== undefined) update.notes = String(body.notes || '').trim().slice(0, 1000) || null;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('company_subscriptions')
      .update(update)
      .eq('company_id', companyId)
      .select('company_id, plan, status, provider, price_cents, currency, started_at, current_period_start, current_period_end, trial_ends_at, cancelled_at, notes, updated_at')
      .single();
    if (updateError) throw updateError;

    console.info('superadmin subscription control', {
      superAdminUserId: access.context.userId,
      companyId,
      previousStatus: existing.status,
      nextStatus: updated.status,
      provider: updated.provider,
    });

    return NextResponse.json({
      ok: true,
      subscription: {
        plan: updated.plan,
        status: updated.status,
        provider: updated.provider,
        priceCents: updated.price_cents,
        currency: updated.currency,
        startedAt: updated.started_at,
        currentPeriodStart: updated.current_period_start,
        currentPeriodEnd: updated.current_period_end,
        trialEndsAt: updated.trial_ends_at,
        cancelledAt: updated.cancelled_at,
        notes: updated.notes || '',
        updatedAt: updated.updated_at,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('superadmin/subscriptions PATCH error:', error);
    const message = error?.message === 'Fecha no válida.' ? 'Fecha no válida.' : 'No se pudo actualizar la suscripción.';
    return NextResponse.json({ ok: false, error: message }, { status: message === 'Fecha no válida.' ? 400 : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
