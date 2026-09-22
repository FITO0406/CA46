import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { billingAdminContextForRequest } from '@/lib/billing-auth-server';
import { getCompanyAccessOverride } from '@/lib/company-access-server';
import { stripePublicStatus } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await billingAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const [{ data: subscription, error }, complimentary, invoicesResult] = await Promise.all([
      supabaseAdmin
        .from('company_subscriptions')
        .select('plan, status, provider, price_cents, currency, started_at, current_period_end, trial_ends_at, cancelled_at, external_customer_id, external_subscription_id')
        .eq('company_id', access.context.companyId)
        .maybeSingle(),
      getCompanyAccessOverride(access.context.companyId),
      supabaseAdmin
        .from('service_invoices')
        .select('id, invoice_number, description, total_cents, currency, issued_at, payment_provider, email_status')
        .eq('company_id', access.context.companyId)
        .order('issued_at', { ascending: false })
        .limit(50),
    ]);

    if (error) throw error;
    if (invoicesResult.error) throw invoicesResult.error;

    const effectivePlan = complimentary?.effective ? complimentary.plan : (subscription?.plan || access.context.plan);

    return NextResponse.json(
      {
        ok: true,
        company: {
          id: access.context.companyId,
          name: access.context.companyName,
          plan: access.context.plan,
          effectivePlan,
        },
        complimentaryAccess: complimentary?.effective
          ? {
              active: true,
              plan: complimentary.plan,
              endsAt: complimentary.endsAt,
              features: complimentary.features,
            }
          : null,
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
        invoices: (invoicesResult.data || []).map((invoice) => ({
          id: invoice.id,
          number: invoice.invoice_number,
          description: invoice.description,
          totalCents: invoice.total_cents,
          currency: invoice.currency,
          issuedAt: invoice.issued_at,
          paymentProvider: invoice.payment_provider,
          emailStatus: invoice.email_status,
        })),
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
