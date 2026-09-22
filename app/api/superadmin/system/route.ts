import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { stripePublicStatus } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CountResult = { ok: boolean; count: number };

async function safeCount(table: string, configure?: (query: any) => any): Promise<CountResult> {
  try {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (configure) query = configure(query);
    const { count, error } = await query;
    if (error) return { ok: false, count: 0 };
    return { ok: true, count: count || 0 };
  } catch {
    return { ok: false, count: 0 };
  }
}

export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const nowIso = new Date().toISOString();
    const [companies, members, tags, subscriptions, webhooks, drive, screens, recentWebhookResult] = await Promise.all([
      safeCount('companies'),
      safeCount('company_members', (query) => query.eq('is_active', true)),
      safeCount('digital_tags', (query) => query.eq('is_active', true).or(`expires_at.is.null,expires_at.gt.${nowIso}`)),
      safeCount('company_subscriptions'),
      safeCount('stripe_webhook_events'),
      safeCount('company_settings', (query) => query.eq('drive_connected', true)),
      safeCount('company_settings', (query) => query.eq('public_screen_enabled', true)),
      supabaseAdmin
        .from('stripe_webhook_events')
        .select('event_id, event_type, processed_at')
        .order('processed_at', { ascending: false })
        .limit(8),
    ]);

    const coreChecks = [companies, members, tags, subscriptions, drive, screens];
    const databaseHealthy = coreChecks.every((item) => item.ok);
    const stripe = stripePublicStatus();

    const recentWebhooks = recentWebhookResult.error
      ? []
      : (recentWebhookResult.data || []).map((event) => ({
          id: event.event_id,
          type: event.event_type,
          processedAt: event.processed_at,
        }));

    return NextResponse.json(
      {
        ok: true,
        checkedAt: nowIso,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        services: {
          database: { healthy: databaseHealthy },
          auth: { healthy: true },
          stripe: {
            ready: stripe.ready,
            secretKeyConfigured: stripe.secretKeyConfigured,
            webhookConfigured: stripe.webhookConfigured,
            autonomoPriceConfigured: stripe.prices.autonomo,
            empresaPriceConfigured: stripe.prices.empresa,
          },
        },
        counters: {
          companies,
          activeMembers: members,
          activeTags: tags,
          subscriptions,
          webhookEvents: webhooks,
          driveConnected: drive,
          screensEnabled: screens,
        },
        recentWebhooks,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('superadmin/system error:', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo consultar el estado del sistema.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
