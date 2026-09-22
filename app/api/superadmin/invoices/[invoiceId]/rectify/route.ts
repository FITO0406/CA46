import { NextResponse } from 'next/server';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { getServiceInvoice, issueRectifyingServiceInvoice, type ServicePlan } from '@/lib/service-invoices-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ invoiceId: string }> };
const allowedPlans = new Set<ServicePlan>(['gratis', 'autonomo', 'empresa', 'personalizado']);

function clean(value: unknown, max = 220) {
  return String(value || '').trim().slice(0, max);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const { invoiceId } = await context.params;
    const original = await getServiceInvoice(invoiceId);
    if (!original) return NextResponse.json({ ok: false, error: 'Factura no encontrada.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const reason = clean(body?.reason, 800);
    const description = clean(body?.description, 500);
    const totalCents = Math.round(Number(body?.totalCents));
    const planCandidate = clean(body?.plan, 30).toLowerCase() as ServicePlan;
    const plan = allowedPlans.has(planCandidate) ? planCandidate : original.plan;

    if (reason.length < 3 || !description || !Number.isFinite(totalCents) || totalCents < 0) {
      return NextResponse.json({ ok: false, error: 'Motivo, concepto e importe corregido son obligatorios.' }, { status: 400 });
    }

    const originalCustomer = original.customer_snapshot || {};
    const customer = {
      businessName: clean(body?.customer?.businessName || originalCustomer.businessName, 180),
      legalName: clean(body?.customer?.legalName || originalCustomer.legalName, 180),
      taxId: clean(body?.customer?.taxId || originalCustomer.taxId, 40),
      email: clean(body?.customer?.email || originalCustomer.email, 180),
      address: clean(body?.customer?.address || originalCustomer.address, 220),
      postalCode: clean(body?.customer?.postalCode || originalCustomer.postalCode, 20),
      city: clean(body?.customer?.city || originalCustomer.city, 100),
      province: clean(body?.customer?.province || originalCustomer.province, 100),
      country: clean(body?.customer?.country || originalCustomer.country || 'España', 100),
    };

    const result = await issueRectifyingServiceInvoice({
      originalInvoice: original,
      reason,
      plan,
      description,
      totalCents,
      customer,
      servicePeriodStart: body?.servicePeriodStart || original.service_period_start || null,
      servicePeriodEnd: body?.servicePeriodEnd || original.service_period_end || null,
      createdByUserId: access.context.userId,
    });

    if (!result.invoice) {
      const error = result.skippedReason === 'VERIFACTU_REQUIRES_AEAT'
        ? 'Esta factura ya está vinculada a VERI*FACTU. La rectificación debe registrarse también ante la AEAT antes de emitirla.'
        : result.skippedReason === 'SETTINGS_NOT_READY'
          ? 'Completa primero la configuración fiscal.'
          : 'Esta factura no puede rectificarse en su estado actual.';
      return NextResponse.json({ ok: false, error, code: result.skippedReason }, { status: 409 });
    }

    return NextResponse.json({ ok: true, invoice: result.invoice }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('superadmin invoice rectify error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo generar la factura rectificativa.' }, { status: 500 });
  }
}
