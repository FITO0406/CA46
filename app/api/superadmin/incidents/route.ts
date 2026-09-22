import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { getServiceInvoiceSettings, serviceInvoiceSettingsReady } from '@/lib/service-invoices-server';
import { stripePublicStatus } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Incident = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  type: string;
  title: string;
  detail: string;
  companyId?: string;
  companyName?: string;
  href: string;
};

export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const [companiesResult, membersResult, subscriptionsResult, settingsResult, invoicesResult, invoiceSettings] = await Promise.all([
      supabaseAdmin.from('companies').select('id, name, status'),
      supabaseAdmin.from('company_members').select('company_id, is_active').eq('is_active', true),
      supabaseAdmin.from('company_subscriptions').select('company_id, status, provider, trial_ends_at, current_period_end'),
      supabaseAdmin.from('company_settings').select('company_id, public_screen_enabled, public_screen_token'),
      supabaseAdmin.from('service_invoices').select('id, company_id, invoice_number, email_status, issued_at').in('email_status', ['failed', 'disabled', 'pending']).order('issued_at', { ascending: false }).limit(100),
      getServiceInvoiceSettings(),
    ]);

    if (companiesResult.error) throw companiesResult.error;
    if (membersResult.error) throw membersResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (invoicesResult.error) throw invoicesResult.error;

    const companies = companiesResult.data || [];
    const companyMap = new Map(companies.map((company) => [company.id, company]));
    const memberCounts = new Map<string, number>();
    for (const member of membersResult.data || []) memberCounts.set(member.company_id, (memberCounts.get(member.company_id) || 0) + 1);
    const companySettings = new Map((settingsResult.data || []).map((row) => [row.company_id, row]));
    const incidents: Incident[] = [];

    for (const company of companies) {
      if ((company.status === 'active' || company.status === 'trial') && (memberCounts.get(company.id) || 0) === 0) {
        incidents.push({ id: `members-${company.id}`, severity: 'high', type: 'access', title: 'Empresa sin usuario activo', detail: 'La empresa está operativa pero no tiene ningún usuario activo vinculado.', companyId: company.id, companyName: company.name, href: `/superadmin/empresas/${company.id}` });
      }
      if (company.status === 'suspended') {
        incidents.push({ id: `suspended-${company.id}`, severity: 'low', type: 'access', title: 'Empresa suspendida', detail: 'El acceso a CA46 está suspendido. Revisa si debe continuar bloqueado.', companyId: company.id, companyName: company.name, href: `/superadmin/empresas/${company.id}` });
      }
      const screen = companySettings.get(company.id);
      if (screen?.public_screen_enabled && !String(screen.public_screen_token || '').trim()) {
        incidents.push({ id: `screen-${company.id}`, severity: 'high', type: 'screen', title: 'Pantalla sin token', detail: 'La pantalla pública está activada pero no tiene token válido.', companyId: company.id, companyName: company.name, href: `/superadmin/empresas/${company.id}` });
      }
    }

    for (const subscription of subscriptionsResult.data || []) {
      const company = companyMap.get(subscription.company_id);
      if (!company) continue;
      if (subscription.status === 'unpaid') {
        incidents.push({ id: `unpaid-${subscription.company_id}`, severity: 'high', type: 'billing', title: 'Suscripción impagada', detail: 'El último cobro ha quedado como impagado.', companyId: company.id, companyName: company.name, href: '/superadmin/planes' });
      } else if (subscription.status === 'pending') {
        incidents.push({ id: `pending-${subscription.company_id}`, severity: 'medium', type: 'billing', title: 'Pago pendiente', detail: 'La suscripción tiene un pago pendiente de completar.', companyId: company.id, companyName: company.name, href: '/superadmin/planes' });
      }
      if (subscription.status === 'trial' && subscription.trial_ends_at) {
        const days = Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000);
        if (days >= 0 && days <= 7) incidents.push({ id: `trial-${subscription.company_id}`, severity: 'low', type: 'billing', title: 'Prueba próxima a terminar', detail: `El periodo de prueba termina en ${days} día${days === 1 ? '' : 's'}.`, companyId: company.id, companyName: company.name, href: '/superadmin/planes' });
      }
    }

    for (const invoice of invoicesResult.data || []) {
      if (invoice.email_status === 'pending' && Date.now() - new Date(invoice.issued_at).getTime() < 10 * 60 * 1000) continue;
      const company = companyMap.get(invoice.company_id);
      const title = invoice.email_status === 'failed' ? 'Factura no enviada' : invoice.email_status === 'disabled' ? 'Email de facturas no configurado' : 'Factura pendiente de enviar';
      incidents.push({ id: `invoice-${invoice.id}`, severity: invoice.email_status === 'failed' ? 'medium' : 'low', type: 'invoice', title, detail: `${invoice.invoice_number} necesita revisión del envío por email.`, companyId: invoice.company_id, companyName: company?.name || 'Empresa', href: '/superadmin/facturas' });
    }

    const stripe = stripePublicStatus();
    if (!stripe.ready) {
      incidents.push({ id: 'stripe-config', severity: 'medium', type: 'system', title: 'Stripe pendiente de configuración', detail: 'El motor está instalado, pero todavía faltan credenciales o Price IDs para cobrar en producción.', href: '/superadmin/planes' });
    }
    if (!serviceInvoiceSettingsReady(invoiceSettings)) {
      incidents.push({ id: 'invoice-config', severity: 'medium', type: 'system', title: 'Facturación automática sin activar', detail: 'Completa los datos fiscales del emisor para que CA46 pueda emitir facturas tras cada cobro.', href: '/superadmin/facturas' });
    } else if (invoiceSettings.auto_email && !(process.env.RESEND_API_KEY && process.env.INVOICE_FROM_EMAIL)) {
      incidents.push({ id: 'invoice-email-config', severity: 'medium', type: 'system', title: 'Envío automático de facturas pendiente', detail: 'Las facturas se pueden generar, pero falta configurar el servicio de email en producción.', href: '/superadmin/facturas' });
    }

    const order = { high: 0, medium: 1, low: 2 } as const;
    incidents.sort((a, b) => order[a.severity] - order[b.severity]);

    return NextResponse.json({
      ok: true,
      incidents,
      counts: {
        total: incidents.length,
        high: incidents.filter((item) => item.severity === 'high').length,
        medium: incidents.filter((item) => item.severity === 'medium').length,
        low: incidents.filter((item) => item.severity === 'low').length,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('superadmin/incidents error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudieron calcular las incidencias.' }, { status: 500 });
  }
}
