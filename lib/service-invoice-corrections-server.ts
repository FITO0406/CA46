import { supabaseAdmin } from '@/lib/supabase';
import {
  getServiceInvoiceSettings,
  sendServiceInvoiceEmail,
  serviceInvoiceSettingsReady,
  type ServiceInvoice,
  type ServicePlan,
} from '@/lib/service-invoices-server';

type RectifyInput = {
  originalInvoice: ServiceInvoice;
  reason: string;
  plan: ServicePlan;
  description: string;
  totalCents: number;
  customer: Record<string, any>;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  createdByUserId?: string | null;
};

function centsBreakdown(totalCents: number, vatRate: number) {
  const total = Math.max(0, Math.round(totalCents));
  const divisor = 1 + vatRate / 100;
  const subtotal = divisor > 0 ? Math.round(total / divisor) : total;
  return { subtotal, vat: Math.max(0, total - subtotal), total };
}

export async function issueRectifyingServiceInvoice(input: RectifyInput) {
  const original: any = input.originalInvoice;
  const reason = input.reason.trim();
  if (!original?.id || original.status !== 'issued' || !reason || !input.description.trim() || !Number.isFinite(input.totalCents) || input.totalCents < 0) {
    return { invoice: null as ServiceInvoice | null, skippedReason: 'INVALID_INPUT' };
  }
  if (original.fiscal_mode === 'verifactu' && original.verifactu_status !== 'not_applicable') {
    return { invoice: null as ServiceInvoice | null, skippedReason: 'VERIFACTU_REQUIRES_AEAT' };
  }

  const settings = await getServiceInvoiceSettings();
  if (!serviceInvoiceSettingsReady(settings)) {
    return { invoice: null as ServiceInvoice | null, skippedReason: 'SETTINGS_NOT_READY' };
  }

  const vatRate = Number(settings.vat_rate || 0);
  const amounts = centsBreakdown(input.totalCents, vatRate);
  const customer = {
    ...(original.customer_snapshot || {}),
    ...input.customer,
    companyId: original.company_id,
    country: input.customer?.country || original.customer_snapshot?.country || 'España',
  };
  const issuer = {
    legalName: settings.issuer_legal_name,
    taxId: settings.issuer_tax_id,
    email: settings.issuer_email,
    address: settings.issuer_address,
    postalCode: settings.issuer_postal_code,
    city: settings.issuer_city,
    province: settings.issuer_province,
    country: settings.issuer_country || 'España',
  };
  const emailStatus = settings.auto_email ? 'pending' : 'disabled';

  const { data, error } = await supabaseAdmin.rpc('ca46_issue_rectifying_service_invoice', {
    p_company_id: original.company_id,
    p_payment_provider: original.payment_provider,
    p_payment_reference: `rectify-${original.id}-${Date.now()}`,
    p_plan: input.plan,
    p_description: input.description.trim(),
    p_service_period_start: input.servicePeriodStart || original.service_period_start || null,
    p_service_period_end: input.servicePeriodEnd || original.service_period_end || null,
    p_currency: original.currency || 'EUR',
    p_subtotal_cents: amounts.subtotal,
    p_vat_rate: vatRate,
    p_vat_cents: amounts.vat,
    p_total_cents: amounts.total,
    p_issuer_snapshot: issuer,
    p_customer_snapshot: customer,
    p_email_to: customer.email || original.email_to || '',
    p_email_status: emailStatus,
    p_rectifies_invoice_id: original.id,
    p_rectifies_invoice_number: original.invoice_number,
    p_rectification_reason: reason,
    p_created_by_user_id: input.createdByUserId || null,
  });
  if (error) throw error;
  if (!data) return { invoice: null as ServiceInvoice | null, skippedReason: 'INSERT_FAILED' };

  const inserted: any = data;
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('service_invoices')
    .update({ status: 'rectified' })
    .eq('id', inserted.id)
    .select('*')
    .single();
  if (updateError) throw updateError;

  const invoice = updated as ServiceInvoice;
  if (settings.auto_email) await sendServiceInvoiceEmail(invoice).catch(() => null);
  return { invoice, skippedReason: null as string | null };
}

export async function voidServiceInvoice(invoiceInput: ServiceInvoice, reason: string, userId?: string | null) {
  const invoice: any = invoiceInput;
  const cleanReason = reason.trim();
  if (!invoice?.id || invoice.status !== 'issued' || !cleanReason) {
    return { invoice: null as ServiceInvoice | null, skippedReason: 'INVALID_INPUT' };
  }
  if (invoice.fiscal_mode === 'verifactu' && invoice.verifactu_status !== 'not_applicable') {
    return { invoice: null as ServiceInvoice | null, skippedReason: 'VERIFACTU_REQUIRES_AEAT' };
  }

  const { data, error } = await supabaseAdmin
    .from('service_invoices')
    .update({
      status: 'voided',
      void_reason: cleanReason.slice(0, 800),
      voided_at: new Date().toISOString(),
      voided_by_user_id: userId || null,
    })
    .eq('id', invoice.id)
    .eq('status', 'issued')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return { invoice: (data || null) as ServiceInvoice | null, skippedReason: data ? null : 'ALREADY_CHANGED' };
}
