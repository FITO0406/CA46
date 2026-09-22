import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { stripePlanFromPriceId, verifyStripeWebhookSignature } from '@/lib/stripe-server';
import { issueServiceInvoice, type ServicePlan } from '@/lib/service-invoices-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BillingStatus = 'none' | 'trial' | 'active' | 'pending' | 'unpaid' | 'cancelled';

function stripeId(value: any): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.id === 'string') return value.id;
  return '';
}

function unixToIso(value: any) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

function unixToDate(value: any) {
  const iso = unixToIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function mapSubscriptionStatus(status: string): BillingStatus {
  if (status === 'trialing') return 'trial';
  if (status === 'active') return 'active';
  if (status === 'past_due' || status === 'incomplete' || status === 'paused') return 'pending';
  if (status === 'unpaid') return 'unpaid';
  if (status === 'canceled' || status === 'incomplete_expired') return 'cancelled';
  return 'pending';
}

function subscriptionPeriod(subscription: any) {
  const item = subscription?.items?.data?.[0] || null;
  return {
    start: unixToIso(subscription?.current_period_start ?? item?.current_period_start),
    end: unixToIso(subscription?.current_period_end ?? item?.current_period_end),
  };
}

async function findCompanyId(object: any) {
  const metadataCompanyId = String(object?.metadata?.company_id || '').trim();
  if (metadataCompanyId) {
    const { data } = await supabaseAdmin.from('companies').select('id').eq('id', metadataCompanyId).maybeSingle();
    if (data?.id) return data.id as string;
  }

  const subscriptionId = stripeId(object?.subscription) || stripeId(object?.parent?.subscription_details?.subscription);
  if (subscriptionId) {
    const { data } = await supabaseAdmin
      .from('company_subscriptions')
      .select('company_id')
      .eq('external_subscription_id', subscriptionId)
      .maybeSingle();
    if (data?.company_id) return data.company_id as string;
  }

  const customerId = stripeId(object?.customer);
  if (customerId) {
    const { data } = await supabaseAdmin
      .from('company_subscriptions')
      .select('company_id')
      .eq('external_customer_id', customerId)
      .maybeSingle();
    if (data?.company_id) return data.company_id as string;
  }

  return '';
}

async function handleCheckoutCompleted(session: any) {
  const companyId = String(session?.metadata?.company_id || session?.client_reference_id || '').trim();
  if (!companyId) return;

  const planCandidate = String(session?.metadata?.ca46_plan || '').trim();
  const plan = planCandidate === 'autonomo' || planCandidate === 'empresa' ? planCandidate : null;
  const customerId = stripeId(session?.customer);
  const subscriptionId = stripeId(session?.subscription);
  const paymentStatus = String(session?.payment_status || '');
  const status: BillingStatus = paymentStatus === 'paid' || paymentStatus === 'no_payment_required' ? 'active' : 'pending';

  const update: Record<string, any> = {
    provider: 'stripe',
    status,
    external_customer_id: customerId || null,
    external_subscription_id: subscriptionId || null,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (plan) update.plan = plan;

  const { error } = await supabaseAdmin.from('company_subscriptions').update(update).eq('company_id', companyId);
  if (error) throw error;

  if (plan) {
    const { error: companyError } = await supabaseAdmin
      .from('companies')
      .update({ plan, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    if (companyError) throw companyError;
  }
}

async function handleSubscription(subscription: any) {
  const companyId = await findCompanyId(subscription);
  if (!companyId) return;

  const price = subscription?.items?.data?.[0]?.price || null;
  const priceId = stripeId(price);
  const metadataPlan = String(subscription?.metadata?.ca46_plan || '').trim();
  const plan = metadataPlan === 'autonomo' || metadataPlan === 'empresa'
    ? metadataPlan
    : stripePlanFromPriceId(priceId);
  const period = subscriptionPeriod(subscription);
  const status = mapSubscriptionStatus(String(subscription?.status || ''));
  const customerId = stripeId(subscription?.customer);
  const subscriptionId = stripeId(subscription);
  const unitAmount = Number(price?.unit_amount);

  const update: Record<string, any> = {
    provider: 'stripe',
    status,
    external_customer_id: customerId || null,
    external_subscription_id: subscriptionId || null,
    price_cents: Number.isFinite(unitAmount) ? unitAmount : null,
    currency: String(price?.currency || 'eur').toUpperCase().slice(0, 3),
    current_period_start: period.start,
    current_period_end: period.end,
    trial_ends_at: unixToIso(subscription?.trial_end),
    cancelled_at: status === 'cancelled' ? (unixToIso(subscription?.canceled_at) || new Date().toISOString()) : null,
    started_at: unixToIso(subscription?.start_date) || unixToIso(subscription?.created) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (plan) update.plan = plan;

  const { error } = await supabaseAdmin.from('company_subscriptions').update(update).eq('company_id', companyId);
  if (error) throw error;

  if (plan && (status === 'active' || status === 'trial')) {
    const { error: companyError } = await supabaseAdmin
      .from('companies')
      .update({ plan, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    if (companyError) throw companyError;
  }
}

async function invoicePlan(companyId: string): Promise<ServicePlan> {
  const { data } = await supabaseAdmin.from('company_subscriptions').select('plan').eq('company_id', companyId).maybeSingle();
  const plan = String(data?.plan || 'personalizado');
  return plan === 'gratis' || plan === 'autonomo' || plan === 'empresa' || plan === 'personalizado' ? plan : 'personalizado';
}

async function createPaidStripeInvoice(companyId: string, invoice: any) {
  const totalCents = Number(invoice?.amount_paid ?? invoice?.total ?? 0);
  if (!Number.isFinite(totalCents) || totalCents <= 0) return;

  const plan = await invoicePlan(companyId);
  const stripeInvoiceId = stripeId(invoice);
  const line = invoice?.lines?.data?.[0] || null;
  const periodStart = unixToDate(line?.period?.start);
  const periodEnd = unixToDate(line?.period?.end);
  const explicitSubtotal = Number(invoice?.subtotal_excluding_tax);
  const subtotalCents = Number.isFinite(explicitSubtotal) && explicitSubtotal >= 0 ? explicitSubtotal : null;
  const vatCents = subtotalCents !== null ? Math.max(0, totalCents - subtotalCents) : null;
  const monthLabel = periodStart ? new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(`${periodStart}T12:00:00Z`)) : '';
  const description = `Servicio CA46 · Plan ${plan === 'autonomo' ? 'Autónomo' : plan === 'empresa' ? 'Empresa' : plan === 'gratis' ? 'Gratis' : 'Personalizado'}${monthLabel ? ` · ${monthLabel}` : ''}`;

  const result = await issueServiceInvoice({
    companyId,
    paymentProvider: 'stripe',
    paymentReference: stripeInvoiceId || stripeId(invoice?.payment_intent) || null,
    plan,
    description,
    totalCents,
    subtotalCents,
    vatCents,
    currency: String(invoice?.currency || 'eur').toUpperCase(),
    servicePeriodStart: periodStart,
    servicePeriodEnd: periodEnd,
  });

  if (!result.invoice && result.skippedReason === 'SETTINGS_NOT_READY') {
    console.warn('stripe invoice paid without CA46 invoice: issuer settings not ready', { companyId, stripeInvoiceId });
  }
}

async function handleInvoice(invoice: any, paid: boolean) {
  const companyId = await findCompanyId(invoice);
  if (!companyId) return;

  const subscriptionId = stripeId(invoice?.subscription) || stripeId(invoice?.parent?.subscription_details?.subscription);
  const customerId = stripeId(invoice?.customer);
  const update: Record<string, any> = {
    provider: 'stripe',
    status: paid ? 'active' : 'unpaid',
    updated_at: new Date().toISOString(),
  };
  if (subscriptionId) update.external_subscription_id = subscriptionId;
  if (customerId) update.external_customer_id = customerId;

  const { error } = await supabaseAdmin.from('company_subscriptions').update(update).eq('company_id', companyId);
  if (error) throw error;

  if (paid) await createPaidStripeInvoice(companyId, invoice);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  try {
    if (!signature || !verifyStripeWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ received: false, error: 'Firma Stripe no válida.' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventId = String(event?.id || '').trim();
    const eventType = String(event?.type || '').trim();
    if (!eventId || !eventType) return NextResponse.json({ received: false, error: 'Evento Stripe no válido.' }, { status: 400 });

    const { data: processed, error: processedError } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (processedError) throw processedError;
    if (processed) return NextResponse.json({ received: true, duplicate: true });

    const object = event?.data?.object || {};

    if (eventType === 'checkout.session.completed') await handleCheckoutCompleted(object);
    if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.deleted') {
      await handleSubscription(object);
    }
    if (eventType === 'invoice.paid') await handleInvoice(object, true);
    if (eventType === 'invoice.payment_failed') await handleInvoice(object, false);

    const { error: eventError } = await supabaseAdmin
      .from('stripe_webhook_events')
      .insert({ event_id: eventId, event_type: eventType });
    if (eventError && eventError.code !== '23505') throw eventError;

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('stripe/webhook error:', error);
    const notConfigured = error?.message === 'STRIPE_WEBHOOK_NOT_CONFIGURED';
    return NextResponse.json(
      { received: false, error: notConfigured ? 'Webhook Stripe no configurado.' : 'No se pudo procesar el evento Stripe.' },
      { status: notConfigured ? 503 : 500 },
    );
  }
}
