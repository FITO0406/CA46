import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { getServiceInvoiceSettings, issueServiceInvoice, serviceInvoiceSettingsReady, type ServicePlan } from '@/lib/service-invoices-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedPlans = new Set<ServicePlan>(['gratis', 'autonomo', 'empresa', 'personalizado']);

export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const [settings, invoicesResult, companiesResult] = await Promise.all([
      getServiceInvoiceSettings(),
      supabaseAdmin.from('service_invoices').select('*').order('issued_at', { ascending: false }).limit(200),
      supabaseAdmin.from('companies').select('id, name, plan, status').order('name', { ascending: true }),
    ]);
    if (invoicesResult.error) throw invoicesResult.error;
    if (companiesResult.error) throw companiesResult.error;

    const companyMap = new Map((companiesResult.data || []).map((company) => [company.id, company]));
    const invoices = (invoicesResult.data || []).map((invoice) => ({
      ...invoice,
      companyName: companyMap.get(invoice.company_id)?.name || invoice.customer_snapshot?.businessName || invoice.customer_snapshot?.legalName || 'Empresa',
    }));

    const verifactuConnectorReady = process.env.VERIFACTU_CONNECTOR_READY === 'true';

    return NextResponse.json({
      ok: true,
      settings: {
        enabled: settings.enabled,
        issuerLegalName: settings.issuer_legal_name,
        issuerTaxId: settings.issuer_tax_id,
        issuerAddress: settings.issuer_address,
        issuerPostalCode: settings.issuer_postal_code,
        issuerCity: settings.issuer_city,
        issuerProvince: settings.issuer_province,
        issuerCountry: settings.issuer_country,
        issuerEmail: settings.issuer_email,
        seriesPrefix: settings.series_prefix,
        rectificationSeriesPrefix: settings.rectification_series_prefix,
        vatRate: Number(settings.vat_rate),
        autoEmail: settings.auto_email,
        verifactuMode: settings.verifactu_mode,
        verifactuConnectorReady,
        ready: serviceInvoiceSettingsReady(settings),
        emailProviderReady: Boolean(process.env.RESEND_API_KEY && process.env.INVOICE_FROM_EMAIL),
      },
      invoices,
      companies: companiesResult.data || [],
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('superadmin/invoices GET error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudieron cargar las facturas.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const body = await request.json().catch(() => ({}));
    const companyId = String(body?.companyId || '').trim();
    const description = String(body?.description || '').trim();
    const planCandidate = String(body?.plan || 'personalizado').trim().toLowerCase() as ServicePlan;
    const totalCents = Math.round(Number(body?.totalCents));
    const plan = allowedPlans.has(planCandidate) ? planCandidate : 'personalizado';

    if (!companyId || !description || !Number.isFinite(totalCents) || totalCents <= 0) {
      return NextResponse.json({ ok: false, error: 'Empresa, concepto e importe son obligatorios.' }, { status: 400 });
    }

    const { data: company, error: companyError } = await supabaseAdmin.from('companies').select('id').eq('id', companyId).maybeSingle();
    if (companyError) throw companyError;
    if (!company) return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 });

    const result = await issueServiceInvoice({
      companyId,
      paymentProvider: 'manual',
      paymentReference: `manual-${randomUUID()}`,
      plan,
      description,
      totalCents,
      currency: 'EUR',
      servicePeriodStart: body?.servicePeriodStart || null,
      servicePeriodEnd: body?.servicePeriodEnd || null,
      createdByUserId: access.context.userId,
    });

    if (!result.invoice) {
      const message = result.skippedReason === 'SETTINGS_NOT_READY'
        ? 'Completa y activa primero los datos fiscales de facturación.'
        : 'No se pudo emitir la factura.';
      return NextResponse.json({ ok: false, error: message, code: result.skippedReason }, { status: 409 });
    }

    return NextResponse.json({ ok: true, invoice: result.invoice }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('superadmin/invoices POST error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo emitir la factura manual.' }, { status: 500 });
  }
}
