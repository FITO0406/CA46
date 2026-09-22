import { NextResponse } from 'next/server';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { buildServiceInvoicePdf, getServiceInvoice } from '@/lib/service-invoices-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const { invoiceId } = await context.params;
    const invoice = await getServiceInvoice(invoiceId);
    if (!invoice) return NextResponse.json({ ok: false, error: 'Factura no encontrada.' }, { status: 404 });

    const pdf = buildServiceInvoicePdf(invoice);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('superadmin invoice pdf error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo generar el PDF.' }, { status: 500 });
  }
}
