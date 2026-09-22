import { NextResponse } from 'next/server';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { stripePublicStatus } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json(
      { ok: true, stripe: stripePublicStatus() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('superadmin/stripe-status error:', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo consultar la configuración de Stripe.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
