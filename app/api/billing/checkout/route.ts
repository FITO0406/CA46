import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { billingAdminContextForRequest } from '@/lib/billing-auth-server';
import { getCompanyAccessOverride } from '@/lib/company-access-server';
import { stripeAppBaseUrl, stripePriceId, stripePublicStatus, stripeRequest, type StripePlanId } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedPlans = new Set<StripePlanId>(['autonomo', 'empresa']);

export async function POST(request: Request) {
  try {
    const access = await billingAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const complimentary = await getCompanyAccessOverride(access.context.companyId);
    if (complimentary?.effective) {
      return NextResponse.json(
        {
          ok: false,
          error: `Tu empresa tiene acceso de cortesía SuperAdmin al plan ${complimentary.plan}. No necesitas iniciar un nuevo cobro mientras esté activo.`,
          code: 'COMPLIMENTARY_ACCESS_ACTIVE',
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const config = stripePublicStatus();
    if (!config.secretKeyConfigured) {
      return NextResponse.json(
        { ok: false, error: 'Stripe todavía no está configurado en CA46.', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const body = await request.json().catch(() => ({}));
    const plan = String(body?.plan || '').trim().toLowerCase() as StripePlanId;
    if (!allowedPlans.has(plan)) {
      return NextResponse.json({ ok: false, error: 'Plan no válido para cobro automático.' }, { status: 400 });
    }

    const priceId = stripePriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: `Falta configurar el precio Stripe del plan ${plan}.`, code: 'STRIPE_PRICE_NOT_CONFIGURED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { context } = access;
    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('company_subscriptions')
      .select('external_customer_id')
      .eq('company_id', context.companyId)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;

    let customerId = subscription?.external_customer_id || '';
    if (!customerId) {
      const customerParams = new URLSearchParams();
      if (context.email) customerParams.set('email', context.email);
      customerParams.set('name', context.companyName);
      customerParams.set('metadata[company_id]', context.companyId);
      customerParams.set('metadata[source]', 'ca46');

      const customer = await stripeRequest<{ id: string }>('customers', customerParams);
      customerId = customer.id;

      const { error: customerUpdateError } = await supabaseAdmin
        .from('company_subscriptions')
        .upsert(
          {
            company_id: context.companyId,
            plan: context.plan,
            external_customer_id: customerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'company_id' },
        );
      if (customerUpdateError) throw customerUpdateError;
    }

    const baseUrl = stripeAppBaseUrl();
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('customer', customerId);
    params.set('client_reference_id', context.companyId);
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', `${baseUrl}/mi-empresa?billing=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${baseUrl}/planes?billing=cancelled`);
    params.set('allow_promotion_codes', 'true');
    params.set('metadata[company_id]', context.companyId);
    params.set('metadata[ca46_plan]', plan);
    params.set('subscription_data[metadata][company_id]', context.companyId);
    params.set('subscription_data[metadata][ca46_plan]', plan);

    const session = await stripeRequest<{ id: string; url?: string }>('checkout/sessions', params);
    if (!session.url) throw new Error('Stripe no devolvió una URL de pago.');

    return NextResponse.json(
      { ok: true, sessionId: session.id, url: session.url },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    console.error('billing/checkout error:', error);
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      { ok: false, error: error?.message || 'No se pudo iniciar el pago.' },
      { status: status >= 400 && status < 600 ? status : 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
