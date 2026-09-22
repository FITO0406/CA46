import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { billingAdminContextForRequest } from '@/lib/billing-auth-server';
import { stripePublicStatus } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await billingAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('company_subscriptions')
      .select('plan, status, provider, price_cents, currency, started_at, current_period_end, trial_ends_at, cancelled_at, external_customer_id, external_subscription_id')
      .eq('company_id', access.context.companyId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(
      {
        ok: true,
        company: {
          id: access.context.companyId,
          name: access.context.companyName,
          plan: access.context.plan,
        },
        subscription: subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              provider: subscription.provider,
              priceCents: subscription.price_cents,
              currency: subscription.currency,
              startedAt: subscription.started_at,
              currentPeriodEnd: subscription.current_period_end,
              trialEndsAt: subscription.trial_ends_at,
              cancelledAt: subscription.cancelled_at,
              hasStripeCustomer: Boolean(subscription.external_customer_id),
              hasStripeSubscription: Boolean(subscription.external_subscription_id),
            }
          : null,
        stripe: stripePublicStatus(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('billing/me error:', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo cargar la facturación.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
