import { NextResponse } from 'next/server';
import { billingAdminContextForRequest } from '@/lib/billing-auth-server';
import { buildServiceInvoicePdf, getServiceInvoice } from '@/lib/service-invoices-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const access = await billingAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const { invoiceId } = await context.params;
    const invoice = await getServiceInvoice(invoiceId);
    if (!invoice || invoice.company_id !== access.context.companyId) {
      return NextResponse.json({ ok: false, error: 'Factura no encontrada.' }, { status: 404 });
    }

    const pdf = buildServiceInvoicePdf(invoice);
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('billing invoice pdf error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo generar el PDF.' }, { status: 500 });
  }
}
