import { NextResponse } from 'next/server';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { getServiceInvoice, voidServiceInvoice } from '@/lib/service-invoices-server';

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

    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || '').trim();
    if (reason.length < 3) return NextResponse.json({ ok: false, error: 'Indica el motivo de la anulación.' }, { status: 400 });

    const result = await voidServiceInvoice(invoice, reason, access.context.userId);
    if (!result.invoice) {
      const error = result.skippedReason === 'VERIFACTU_REQUIRES_AEAT'
        ? 'Esta factura ya está vinculada a VERI*FACTU y no puede anularse localmente sin registrar la anulación ante la AEAT.'
        : 'La factura ya no está en estado emitido o ha cambiado mientras la revisabas.';
      return NextResponse.json({ ok: false, error, code: result.skippedReason }, { status: 409 });
    }

    return NextResponse.json({ ok: true, invoice: result.invoice }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('superadmin invoice void error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo anular la factura.' }, { status: 500 });
  }
}
