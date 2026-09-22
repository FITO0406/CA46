import { createHmac, timingSafeEqual } from 'node:crypto';

export type StripePlanId = 'autonomo' | 'empresa';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const PRICE_IDS: Record<StripePlanId, string> = {
  autonomo: process.env.STRIPE_PRICE_AUTONOMO || '',
  empresa: process.env.STRIPE_PRICE_EMPRESA || '',
};

export function stripePublicStatus() {
  return {
    secretKeyConfigured: Boolean(SECRET_KEY),
    webhookConfigured: Boolean(WEBHOOK_SECRET),
    prices: {
      autonomo: Boolean(PRICE_IDS.autonomo),
      empresa: Boolean(PRICE_IDS.empresa),
    },
    ready: Boolean(SECRET_KEY && WEBHOOK_SECRET && PRICE_IDS.autonomo && PRICE_IDS.empresa),
  };
}

export function stripePriceId(plan: StripePlanId) {
  return PRICE_IDS[plan] || '';
}

export function stripePlanFromPriceId(priceId: string): StripePlanId | null {
  if (priceId && priceId === PRICE_IDS.autonomo) return 'autonomo';
  if (priceId && priceId === PRICE_IDS.empresa) return 'empresa';
  return null;
}

export function stripeAppBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const production = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim().replace(/\/$/, '');
  if (production) return production.startsWith('http') ? production : `https://${production}`;

  return 'https://ca-46.vercel.app';
}

export async function stripeRequest<T = any>(path: string, params: URLSearchParams) {
  if (!SECRET_KEY) throw new Error('STRIPE_NOT_CONFIGURED');

  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, '')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || 'Stripe no pudo completar la operación.';
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload?.error?.code || 'STRIPE_REQUEST_FAILED';
    throw error;
  }

  return payload as T;
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string) {
  if (!WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_NOT_CONFIGURED');

  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || '';
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) return false;
  if (Math.abs(Date.now() / 1000 - numericTimestamp) > 300) return false;

  const expected = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  return signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, 'utf8');
    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
  });
}
