import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { encodeTraceability, type TraceabilityData } from '@/lib/traceability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LabelDraft = {
  description?: string;
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
  comprador?: string;
  nif?: string;
  needs_review?: boolean;
  review_fields?: string[];
};

type InvoiceDraft = {
  invoice_number?: string;
  invoice_date?: string;
  buyer?: string;
  buyer_nif?: string;
  labels?: LabelDraft[];
};

function clean(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function fingerprint(invoice: InvoiceDraft, label: LabelDraft) {
  const canonical = [
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
    const body = await request.json().catch(() => null);
    const invoices: InvoiceDraft[] = Array.isArray(body?.invoices) ? body.invoices : [];

    const flattened = invoices.flatMap((invoice) =>
      (Array.isArray(invoice.labels) ? invoice.labels : []).map((label) => ({ invoice, label }))
    );

    if (flattened.length === 0) {
      return NextResponse.json({ error: 'No hay etiquetas para publicar.' }, { status: 400 });
    }

    const invalid = flattened.find(({ label }) => {
      const reviewFields = Array.isArray(label.review_fields) ? label.review_fields.filter(Boolean) : [];
      return (
        !clean(label.description) ||
        !clean(label.lote) ||
        !clean(label.procedencia) ||
        Boolean(label.needs_review) ||
        reviewFields.length > 0
      );
    });

    if (invalid) {
      return NextResponse.json(
        { error: 'Hay etiquetas pendientes de revisión. Revisa descripción, lote y procedencia antes de publicar.', code: 'REVIEW_REQUIRED' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const records = flattened.map(({ invoice, label }) => {
      const buyer = clean(label.comprador || invoice.buyer);
      const buyerNumber = clean(label.nif || invoice.buyer_nif);

      const traceability: TraceabilityData = {
        establishment: 'CA46',
        description: clean(label.description),
        lot: clean(label.lote),
        brand: clean(label.marca),
        netWeight: clean(label.kg_neto),
        productionMethod: clean(label.metodo),
        presentation: clean(label.presentacion),
        origin: clean(label.procedencia),
        fao: clean(label.fao),
        freshness: clean(label.frescura),
        fishingGear: clean(label.arte),
        ceCode: clean(label.ce),
        buyer,
        buyerNumber,
        extraFields: [
          ...(clean(invoice.invoice_number) ? [{ label: 'Factura', value: clean(invoice.invoice_number) }] : []),
          ...(clean(invoice.invoice_date) ? [{ label: 'Fecha factura', value: clean(invoice.invoice_date) }] : []),
        ],
      };

      return {
        drive_file_id: fingerprint(invoice, label),
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
      .select('drive_file_id, product_name, expires_at')
      .in('drive_file_id', ids);

    if (duplicateError) {
      console.error('Duplicate check error:', duplicateError);
      return NextResponse.json({ error: duplicateError.message }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error: 'CA46 ha detectado etiquetas de esta misma factura que ya fueron publicadas.',
          code: 'DUPLICATE_LABELS',
          duplicates: existing,
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('digital_tags')
      .insert(records)
      .select('id, product_name, expires_at');

    if (error) {
      console.error('Publish labels error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        published: data?.length || records.length,
        expires_at: expiresAt.toISOString(),
        labels: data || [],
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Publish labels unexpected error:', error);
    return NextResponse.json({ error: error?.message || 'Error inesperado al publicar las etiquetas.' }, { status: 500 });
  }
}
