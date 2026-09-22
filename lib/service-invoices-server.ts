import { supabaseAdmin } from '@/lib/supabase';

export type ServicePlan = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
export type PaymentProvider = 'stripe' | 'manual';

type InvoiceSettingsRow = {
  enabled: boolean;
  issuer_legal_name: string;
  issuer_tax_id: string;
  issuer_address: string;
  issuer_postal_code: string;
  issuer_city: string;
  issuer_province: string;
  issuer_country: string;
  issuer_email: string;
  series_prefix: string;
  vat_rate: number | string;
  auto_email: boolean;
};

type IssueInput = {
  companyId: string;
  paymentProvider: PaymentProvider;
  paymentReference?: string | null;
  plan: ServicePlan;
  description: string;
  totalCents: number;
  subtotalCents?: number | null;
  vatCents?: number | null;
  currency?: string;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  createdByUserId?: string | null;
};

export type ServiceInvoice = {
  id: string;
  company_id: string;
  invoice_number: string;
  fiscal_year: number;
  sequence_number: number;
  status: 'issued' | 'rectified';
  payment_provider: PaymentProvider;
  payment_reference: string | null;
  plan: ServicePlan;
  description: string;
  service_period_start: string | null;
  service_period_end: string | null;
  currency: string;
  subtotal_cents: number;
  vat_rate: number | string;
  vat_cents: number;
  total_cents: number;
  issuer_snapshot: Record<string, any>;
  customer_snapshot: Record<string, any>;
  issued_at: string;
  email_to: string | null;
  email_status: 'pending' | 'sent' | 'failed' | 'disabled';
  emailed_at: string | null;
  email_error: string | null;
  rectifies_invoice_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

const planNames: Record<ServicePlan, string> = {
  gratis: 'Gratis',
  autonomo: 'Autónomo',
  empresa: 'Empresa',
  personalizado: 'Personalizado',
};

export async function getServiceInvoiceSettings() {
  const { data, error } = await supabaseAdmin
    .from('service_invoice_settings')
    .select('*')
    .eq('id', true)
    .single();
  if (error) throw error;
  return data as InvoiceSettingsRow;
}

export function serviceInvoiceSettingsReady(settings: InvoiceSettingsRow | null | undefined) {
  if (!settings?.enabled) return false;
  return Boolean(
    settings.issuer_legal_name?.trim() &&
    settings.issuer_tax_id?.trim() &&
    settings.issuer_address?.trim() &&
    settings.issuer_postal_code?.trim() &&
    settings.issuer_city?.trim() &&
    settings.issuer_email?.trim() &&
    settings.series_prefix?.trim(),
  );
}

async function companyBillingSnapshot(companyId: string) {
  const [{ data: company, error: companyError }, { data: settings, error: settingsError }] = await Promise.all([
    supabaseAdmin.from('companies').select('id, name, plan').eq('id', companyId).single(),
    supabaseAdmin
      .from('company_settings')
      .select('business_name, legal_name, tax_id, email, address, postal_code, city, province, contact_email')
      .eq('company_id', companyId)
      .maybeSingle(),
  ]);
  if (companyError) throw companyError;
  if (settingsError) throw settingsError;

  const customer = {
    companyId,
    businessName: settings?.business_name || company.name || '',
    legalName: settings?.legal_name || company.name || '',
    taxId: settings?.tax_id || '',
    email: settings?.email || settings?.contact_email || '',
    address: settings?.address || '',
    postalCode: settings?.postal_code || '',
    city: settings?.city || '',
    province: settings?.province || '',
    country: 'España',
  };

  return { company, customer };
}

function centsBreakdown(totalCents: number, vatRate: number, subtotalCents?: number | null, vatCents?: number | null) {
  const total = Math.max(0, Math.round(totalCents));
  if (Number.isFinite(subtotalCents) && subtotalCents !== null && subtotalCents! >= 0) {
    const subtotal = Math.round(subtotalCents!);
    const vat = Number.isFinite(vatCents) && vatCents !== null ? Math.max(0, Math.round(vatCents!)) : Math.max(0, total - subtotal);
    return { subtotal, vat, total };
  }
  const divisor = 1 + vatRate / 100;
  const subtotal = divisor > 0 ? Math.round(total / divisor) : total;
  return { subtotal, vat: Math.max(0, total - subtotal), total };
}

export async function issueServiceInvoice(input: IssueInput) {
  if (!input.companyId || !input.description.trim() || input.totalCents < 0) {
    return { invoice: null as ServiceInvoice | null, skippedReason: 'INVALID_INPUT' };
  }

  if (input.paymentReference) {
    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from('service_invoices')
      .select('*')
      .eq('payment_provider', input.paymentProvider)
      .eq('payment_reference', input.paymentReference)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return { invoice: duplicate as ServiceInvoice, skippedReason: 'DUPLICATE' };
  }

  const settings = await getServiceInvoiceSettings();
  if (!serviceInvoiceSettingsReady(settings)) {
    return { invoice: null as ServiceInvoice | null, skippedReason: 'SETTINGS_NOT_READY' };
  }

  const { customer } = await companyBillingSnapshot(input.companyId);
  const vatRate = Number(settings.vat_rate || 0);
  const amounts = centsBreakdown(input.totalCents, vatRate, input.subtotalCents, input.vatCents);
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

  const { data, error } = await supabaseAdmin.rpc('ca46_issue_service_invoice', {
    p_company_id: input.companyId,
    p_payment_provider: input.paymentProvider,
    p_payment_reference: input.paymentReference || '',
    p_plan: input.plan,
    p_description: input.description.trim(),
    p_service_period_start: input.servicePeriodStart || null,
    p_service_period_end: input.servicePeriodEnd || null,
    p_currency: (input.currency || 'EUR').toUpperCase().slice(0, 3),
    p_subtotal_cents: amounts.subtotal,
    p_vat_rate: vatRate,
    p_vat_cents: amounts.vat,
    p_total_cents: amounts.total,
    p_issuer_snapshot: issuer,
    p_customer_snapshot: customer,
    p_email_to: customer.email || '',
    p_email_status: emailStatus,
    p_created_by_user_id: input.createdByUserId || null,
    p_status: 'issued',
    p_rectifies_invoice_id: null,
  });
  if (error) {
    if (error.code === '23505' && input.paymentReference) {
      const { data: duplicate } = await supabaseAdmin
        .from('service_invoices')
        .select('*')
        .eq('payment_provider', input.paymentProvider)
        .eq('payment_reference', input.paymentReference)
        .maybeSingle();
      if (duplicate) return { invoice: duplicate as ServiceInvoice, skippedReason: 'DUPLICATE' };
    }
    throw error;
  }

  const invoice = data as ServiceInvoice;
  if (settings.auto_email) await sendServiceInvoiceEmail(invoice).catch(() => null);
  return { invoice, skippedReason: null as string | null };
}

function money(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(cents / 100);
}

function dateEs(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function latin1(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function pdfEscape(value: unknown) {
  return latin1(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function pdfText(value: unknown, x: number, y: number, size = 10, bold = false) {
  if (!String(value ?? '').trim()) return '';
  return `BT ${bold ? '/F2' : '/F1'} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`;
}

function wrapPdfText(value: unknown, maxChars = 62) {
  const words = latin1(value).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export function buildServiceInvoicePdf(invoice: ServiceInvoice) {
  const issuer = invoice.issuer_snapshot || {};
  const customer = invoice.customer_snapshot || {};
  const vatLabel = Number(invoice.vat_rate).toFixed(2).replace('.00', '');
  const paymentLabel = invoice.payment_provider === 'stripe' ? 'Stripe' : 'Pago manual';
  const period = invoice.service_period_start || invoice.service_period_end
    ? `${dateEs(invoice.service_period_start) || '-'} - ${dateEs(invoice.service_period_end) || '-'}`
    : 'Servicio mensual';
  const docTitle = invoice.status === 'rectified' ? 'FACTURA RECTIFICATIVA' : 'FACTURA';
  const paymentReference = invoice.payment_reference ? latin1(invoice.payment_reference).slice(0, 54) : '';
  const descriptionLines = wrapPdfText(invoice.description, 56).slice(0, 3);

  const commands: string[] = [
    'q 0.035 0.047 0.055 rg 0 744 595 98 re f Q',
    'q 0.95 0.42 0.08 rg 0 738 595 6 re f Q',
    pdfText('K46', 42, 792, 30, true),
    pdfText('FACTURACION DE SERVICIOS', 42, 770, 10, true),
    pdfText(docTitle, 400, 798, 10, true),
    pdfText(invoice.invoice_number, 400, 778, 14, true),
    pdfText(`Fecha de emision: ${dateEs(invoice.issued_at)}`, 400, 759, 9),

    'q 0.965 0.97 0.975 rg 42 596 244 116 re f Q',
    'q 0.82 0.84 0.86 RG 42 596 244 116 re S Q',
    pdfText('EMISOR DE LA FACTURA', 56, 691, 9, true),
    pdfText(issuer.legalName || 'Emisor no configurado', 56, 670, 11, true),
    pdfText(`NIF/CIF: ${issuer.taxId || '-'}`, 56, 653, 9),
    pdfText(`${issuer.address || ''}`, 56, 636, 9),
    pdfText(`${issuer.postalCode || ''} ${issuer.city || ''}${issuer.province ? ` · ${issuer.province}` : ''}`, 56, 619, 9),
    pdfText(issuer.email || '', 56, 603, 8),

    'q 0.965 0.97 0.975 rg 309 596 244 116 re f Q',
    'q 0.82 0.84 0.86 RG 309 596 244 116 re S Q',
    pdfText('CLIENTE', 323, 691, 9, true),
    pdfText(customer.legalName || customer.businessName || 'Cliente', 323, 670, 11, true),
    pdfText(`NIF/CIF: ${customer.taxId || '-'}`, 323, 653, 9),
    pdfText(`${customer.address || ''}`, 323, 636, 9),
    pdfText(`${customer.postalCode || ''} ${customer.city || ''}${customer.province ? ` · ${customer.province}` : ''}`, 323, 619, 9),
    pdfText(customer.email || '', 323, 603, 8),

    pdfText('DETALLE DEL SERVICIO', 42, 558, 10, true),
    'q 0.035 0.047 0.055 rg 42 520 511 28 re f Q',
    pdfText('Concepto', 54, 530, 9, true),
    pdfText('Plan', 332, 530, 9, true),
    pdfText('Periodo', 411, 530, 9, true),
    pdfText('Importe', 502, 530, 9, true),
    'q 0.82 0.84 0.86 RG 42 446 511 74 re S Q',
    ...descriptionLines.map((line, index) => pdfText(line, 54, 500 - index * 15, 9)),
    pdfText(planNames[invoice.plan] || invoice.plan, 332, 500, 9),
    pdfText(period, 411, 500, 8),
    pdfText(money(invoice.total_cents, invoice.currency), 502, 500, 9, true),

    'q 0.93 0.94 0.95 rg 330 338 223 90 re f Q',
    pdfText('Base imponible', 348, 400, 9),
    pdfText(money(invoice.subtotal_cents, invoice.currency), 472, 400, 9, true),
    pdfText(`IVA ${vatLabel}%`, 348, 380, 9),
    pdfText(money(invoice.vat_cents, invoice.currency), 472, 380, 9, true),
    'q 0.035 0.047 0.055 rg 330 326 223 38 re f Q',
    pdfText('TOTAL FACTURA', 348, 339, 11, true),
    pdfText(money(invoice.total_cents, invoice.currency), 468, 339, 13, true),

    'q 0.97 0.97 0.97 rg 42 326 265 102 re f Q',
    'q 0.84 0.85 0.86 RG 42 326 265 102 re S Q',
    pdfText('PAGO', 56, 404, 9, true),
    pdfText(`Forma de pago: ${paymentLabel}`, 56, 382, 9),
    pdfText(`Estado: Pagada`, 56, 363, 9, true),
    paymentReference ? pdfText(`Referencia: ${paymentReference}`, 56, 344, 8) : '',

    'q 0.90 0.91 0.92 RG 42 287 511 0 re S Q',
    pdfText('Documento generado electronicamente por K46.', 42, 265, 8),
    pdfText(`Factura ${invoice.invoice_number} · ${dateEs(invoice.issued_at)}`, 42, 248, 8),
    pdfText('Conserva este documento como justificante de la prestacion del servicio y del pago.', 42, 231, 8),
  ].filter(Boolean);

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

export async function sendServiceInvoiceEmail(invoice: ServiceInvoice) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.INVOICE_FROM_EMAIL || '').trim();
  const to = String(invoice.email_to || invoice.customer_snapshot?.email || '').trim();

  if (!apiKey || !from) {
    await supabaseAdmin.from('service_invoices').update({
      email_status: 'disabled',
      email_error: 'Falta configurar RESEND_API_KEY o INVOICE_FROM_EMAIL.',
    }).eq('id', invoice.id);
    return { sent: false, reason: 'EMAIL_NOT_CONFIGURED' };
  }
  if (!to) {
    await supabaseAdmin.from('service_invoices').update({
      email_status: 'failed',
      email_error: 'La empresa no tiene email de facturación.',
    }).eq('id', invoice.id);
    return { sent: false, reason: 'CUSTOMER_EMAIL_MISSING' };
  }

  const pdf = buildServiceInvoicePdf(invoice);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Factura ${invoice.invoice_number} · CA46`,
      html: `<p>Hola,</p><p>Adjuntamos la factura <strong>${invoice.invoice_number}</strong> correspondiente a ${invoice.description}.</p><p>Total: <strong>${money(invoice.total_cents, invoice.currency)}</strong>.</p><p>Gracias por utilizar CA46.</p>`,
      attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdf.toString('base64') }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const errorText = `Error al enviar email (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`;
    await supabaseAdmin.from('service_invoices').update({ email_status: 'failed', email_error: errorText }).eq('id', invoice.id);
    throw new Error(errorText);
  }

  const now = new Date().toISOString();
  await supabaseAdmin.from('service_invoices').update({ email_status: 'sent', emailed_at: now, email_error: null }).eq('id', invoice.id);
  return { sent: true };
}

export async function getServiceInvoice(invoiceId: string) {
  const { data, error } = await supabaseAdmin.from('service_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error) throw error;
  return (data || null) as ServiceInvoice | null;
}
