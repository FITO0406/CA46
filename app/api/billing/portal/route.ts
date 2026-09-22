import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { billingAdminContextForRequest } from '@/lib/billing-auth-server';
import { stripeAppBaseUrl, stripePublicStatus, stripeRequest } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const access = await billingAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!stripePublicStatus().secretKeyConfigured) {
      return NextResponse.json(
        { ok: false, error: 'Stripe todavía no está configurado en CA46.', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('company_subscriptions')
      .select('external_customer_id')
      .eq('company_id', access.context.companyId)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;
    if (!subscription?.external_customer_id) {
      return NextResponse.json(
        { ok: false, error: 'Esta empresa todavía no tiene un cliente Stripe asociado.', code: 'STRIPE_CUSTOMER_MISSING' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const params = new URLSearchParams();
    params.set('customer', subscription.external_customer_id);
    params.set('return_url', `${stripeAppBaseUrl()}/mi-empresa?billing=portal-return`);

    const session = await stripeRequest<{ url?: string }>('billing_portal/sessions', params);
    if (!session.url) throw new Error('Stripe no devolvió una URL del portal de facturación.');

    return NextResponse.json({ ok: true, url: session.url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('billing/portal error:', error);
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      { ok: false, error: error?.message || 'No se pudo abrir el portal de facturación.' },
      { status: status >= 400 && status < 600 ? status : 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
