import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const body = await request.json().catch(() => ({}));
    const seriesPrefix = String(body?.seriesPrefix || 'CA46').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20) || 'CA46';
    const rectificationSeriesPrefix = String(body?.rectificationSeriesPrefix || `R-${seriesPrefix}`).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20) || `R-${seriesPrefix}`;
    const vatRate = Number(body?.vatRate);
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      return NextResponse.json({ ok: false, error: 'IVA no válido.' }, { status: 400 });
    }

    const requestedVerifactuMode = String(body?.verifactuMode || 'off');
    const connectorReady = process.env.VERIFACTU_CONNECTOR_READY === 'true';
    const verifactuMode = requestedVerifactuMode === 'active' && connectorReady
      ? 'active'
      : requestedVerifactuMode === 'prepared' || requestedVerifactuMode === 'active'
        ? 'prepared'
        : 'off';

    const update = {
      enabled: Boolean(body?.enabled),
      issuer_legal_name: String(body?.issuerLegalName || '').trim().slice(0, 180),
      issuer_tax_id: String(body?.issuerTaxId || '').trim().slice(0, 40),
      issuer_address: String(body?.issuerAddress || '').trim().slice(0, 220),
      issuer_postal_code: String(body?.issuerPostalCode || '').trim().slice(0, 20),
      issuer_city: String(body?.issuerCity || '').trim().slice(0, 100),
      issuer_province: String(body?.issuerProvince || '').trim().slice(0, 100),
      issuer_country: String(body?.issuerCountry || 'España').trim().slice(0, 100) || 'España',
      issuer_email: String(body?.issuerEmail || '').trim().slice(0, 180),
      series_prefix: seriesPrefix,
      rectification_series_prefix: rectificationSeriesPrefix,
      vat_rate: vatRate,
      auto_email: Boolean(body?.autoEmail),
      verifactu_mode: verifactuMode,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('service_invoice_settings')
      .update(update)
      .eq('id', true)
      .select('*')
      .single();
    if (error) throw error;

    console.info('superadmin invoice settings updated', {
      superAdminUserId: access.context.userId,
      enabled: data.enabled,
      seriesPrefix: data.series_prefix,
      rectificationSeriesPrefix: data.rectification_series_prefix,
      autoEmail: data.auto_email,
      verifactuMode: data.verifactu_mode,
    });

    return NextResponse.json({ ok: true, verifactuMode: data.verifactu_mode, connectorReady }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('superadmin/invoices/settings error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la configuración fiscal.' }, { status: 500 });
  }
}
