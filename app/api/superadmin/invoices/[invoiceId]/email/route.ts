import { NextResponse } from 'next/server';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { getServiceInvoice, sendServiceInvoiceEmail } from '@/lib/service-invoices-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const { invoiceId } = await context.params;
    const invoice = await getServiceInvoice(invoiceId);
    if (!invoice) return NextResponse.json({ ok: false, error: 'Factura no encontrada.' }, { status: 404 });

    const result = await sendServiceInvoiceEmail(invoice);
    if (!result.sent) {
      const message = result.reason === 'EMAIL_NOT_CONFIGURED'
        ? 'Falta configurar el servicio de email automático.'
        : 'La empresa no tiene un email de facturación.';
      return NextResponse.json({ ok: false, error: message, code: result.reason }, { status: 409 });
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('superadmin invoice email error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'No se pudo enviar la factura.' }, { status: 500 });
  }
}
