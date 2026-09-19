import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { encodeTraceability, type TraceabilityData } from '@/lib/traceability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExtraField = { label?: string; value?: string };
type SourceMode = 'invoice' | 'physical_label';

type LabelDraft = {
  description?: string;
  scientific_name?: string;
  lote?: string;
  marca?: string;
  kg_neto?: string;
  metodo?: string;
  presentacion?: string;
  procedencia?: string;
  fao?: string;
  frescura?: string;
  arte?: string;
  ce?: string;
  subzona?: string;
  primer_expedidor?: string;
  poblacion?: string;
  fecha_captura?: string;
  comprador?: string;
  nif?: string;
  extra_fields?: ExtraField[];
  needs_review?: boolean;
  review_fields?: string[];
};

type InvoiceDraft = {
  invoice_number?: string;
  invoice_date?: string;
  expedidor?: string;
  cif_expedidor?: string;
  registro_sanitario_expedidor?: string;
  buyer?: string;
  buyer_nif?: string;
  invoice_extra_fields?: ExtraField[];
  labels?: LabelDraft[];
};

const CRITICAL_REVIEW_FIELDS = new Set(['description', 'lote', 'procedencia']);

function clean(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function cleanExtras(values: ExtraField[] | undefined) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => ({ label: clean(item?.label), value: clean(item?.value) }))
    .filter((item) => item.label && item.value)
    .filter((item) => !/(precio|importe|total|iva|coste|€)/i.test(item.label));
}

function fingerprint(sourceMode: SourceMode, invoice: InvoiceDraft, label: LabelDraft) {
  const canonical = [
    sourceMode,
    clean(invoice.invoice_number),
    clean(invoice.invoice_date),
    clean(label.description),
    clean(label.lote),
    clean(label.procedencia),
    clean(label.fao),
    clean(label.ce),
    clean(label.comprador || invoice.buyer),
  ].join('|').toLowerCase();

  return `ca46:${createHash('sha256').update(canonical).digest('hex').slice(0, 40)}`;
}

export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) {
      return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const body = await request.json().catch(() => null);
    const sourceMode: SourceMode = body?.sourceMode === 'physical_label' ? 'physical_label' : 'invoice';
    const invoices: InvoiceDraft[] = Array.isArray(body?.invoices) ? body.invoices : [];

    const flattened = invoices.flatMap((invoice) =>
      (Array.isArray(invoice.labels) ? invoice.labels : []).map((label) => ({ invoice, label })),
    );

    if (flattened.length === 0) {
      return NextResponse.json({ error: 'No hay etiquetas para publicar.' }, { status: 400 });
    }

    const invalid = flattened.find(({ label }) => {
      const criticalReviewPending = Array.isArray(label.review_fields)
        ? label.review_fields.some((field) => CRITICAL_REVIEW_FIELDS.has(String(field)))
        : false;

      return !clean(label.description) || !clean(label.lote) || !clean(label.procedencia) || criticalReviewPending;
    });

    if (invalid) {
      return NextResponse.json(
        {
          error: 'Hay etiquetas con datos esenciales pendientes. Revisa especie, lote y procedencia antes de publicar.',
          code: 'REVIEW_REQUIRED',
        },
        { status: 400 },
      );
    }

    const validHours = sourceMode === 'physical_label' ? 24 : 72;
    const status = sourceMode === 'physical_label' ? 'provisional' : 'definitive';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validHours * 60 * 60 * 1000);

    const records = flattened.map(({ invoice, label }) => {
      const buyer = clean(label.comprador || invoice.buyer);
      const buyerNumber = clean(label.nif || invoice.buyer_nif);
      const freshness = clean(label.frescura);
      const notices: string[] = [];
      if (sourceMode === 'physical_label') notices.push('Etiqueta provisional · factura pendiente');
      if (/descongelad/i.test(freshness)) notices.push('Consumir preferentemente en 3 días');

      const traceability: TraceabilityData = {
        establishment: tenant.context.companyName || 'CA46',
        description: clean(label.description),
        lot: clean(label.lote),
        brand: clean(label.marca),
        netWeight: clean(label.kg_neto),
        productionMethod: clean(label.metodo),
        presentation: clean(label.presentacion),
        origin: clean(label.procedencia),
        fao: clean(label.fao),
        freshness,
        fishingGear: clean(label.arte),
        ceCode: clean(label.ce),
        buyer,
        buyerNumber,
        scientificName: clean(label.scientific_name),
        subzone: clean(label.subzona),
        firstShipper: clean(label.primer_expedidor),
        population: clean(label.poblacion),
        captureDate: clean(label.fecha_captura),
        invoiceNumber: sourceMode === 'invoice' ? clean(invoice.invoice_number) : '',
        invoiceDate: sourceMode === 'invoice' ? clean(invoice.invoice_date) : '',
        shipper: sourceMode === 'invoice' ? clean(invoice.expedidor) : '',
        shipperTaxId: sourceMode === 'invoice' ? clean(invoice.cif_expedidor) : '',
        shipperHealthRegistration: sourceMode === 'invoice' ? clean(invoice.registro_sanitario_expedidor) : '',
        consumerNotice: notices.join(' · '),
        extraFields: [
          ...cleanExtras(invoice.invoice_extra_fields),
          ...cleanExtras(label.extra_fields),
        ],
      };

      return {
        company_id: tenant.context.companyId,
        created_by_user_id: tenant.context.userId,
        source: sourceMode,
        status,
        drive_file_id: fingerprint(sourceMode, invoice, label),
        product_name: traceability.description,
        price: 0,
        unit: 'kg',
        origin: traceability.origin || null,
        category: encodeTraceability(traceability),
        is_active: true,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      };
    });

    const ids = records.map((record) => record.drive_file_id);
    const { data: existing, error: duplicateError } = await supabaseAdmin
      .from('digital_tags')
      .select('drive_file_id, product_name, expires_at, source, status')
      .eq('company_id', tenant.context.companyId)
      .in('drive_file_id', ids);

    if (duplicateError) {
      console.error('Duplicate check error:', duplicateError);
      return NextResponse.json({ error: 'No se pudo comprobar si estas etiquetas ya existen.' }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error: sourceMode === 'physical_label'
            ? 'CA46 ha detectado que esta etiqueta provisional ya fue publicada por tu empresa.'
            : 'CA46 ha detectado etiquetas de esta misma factura que ya fueron publicadas por tu empresa.',
          code: 'DUPLICATE_LABELS',
          duplicates: existing,
        },
        { status: 409 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('digital_tags')
      .insert(records)
      .select('id, product_name, expires_at, source, status');

    if (error) {
      console.error('Publish labels error:', error);
      return NextResponse.json({ error: 'No se pudieron publicar las etiquetas.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        published: data?.length || records.length,
        expires_at: expiresAt.toISOString(),
        valid_hours: validHours,
        source: sourceMode,
        status,
        company_id: tenant.context.companyId,
        labels: data || [],
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    console.error('Publish labels unexpected error:', error);
    return NextResponse.json({ error: error?.message || 'Error inesperado al publicar las etiquetas.' }, { status: 500 });
  }
}
