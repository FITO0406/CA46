'use client';

import { decodeTraceability } from '@/lib/traceability';

interface Tag {
  id: string;
  product_name: string;
  origin: string | null;
  category: string;
  is_active: boolean;
  drive_file_id?: string;
}

const accentStyles = [
  { glow: 'from-orange-500/20', border: 'border-orange-400/25', label: 'text-orange-300' },
  { glow: 'from-cyan-500/15', border: 'border-cyan-300/20', label: 'text-cyan-300' },
  { glow: 'from-emerald-500/15', border: 'border-emerald-300/20', label: 'text-emerald-300' },
];

function Field({ label, value, important = false }: { label: string; value?: string | null; important?: boolean }) {
  if (!value) return null;

  return (
    <div className={important
      ? 'rounded-2xl border border-orange-400/40 bg-orange-500/[.10] px-4 py-3 shadow-lg shadow-orange-950/20'
      : 'rounded-2xl border border-white/[.08] bg-black/20 px-4 py-3'}>
      <p className={important
        ? 'text-[10px] font-black uppercase tracking-[.18em] text-orange-300'
        : 'text-[10px] font-black uppercase tracking-[.16em] text-slate-500'}>
        {label}{important ? ' · IMPORTANTE' : ''}
      </p>
      <p className={important
        ? 'mt-1 break-words text-base font-black text-white'
        : 'mt-1 break-words text-sm font-bold leading-5 text-slate-100'}>
        {value}
      </p>
    </div>
  );
}

export default function TagCard({ tag, accentIndex = 0 }: { tag: Tag; accentIndex?: number }) {
  const trace = decodeTraceability(tag.category);
  const accent = accentStyles[accentIndex % accentStyles.length];
  const productName = trace?.description || tag.product_name;
  const weight = trace?.netWeight
    ? /\bkg\b/i.test(trace.netWeight) ? trace.netWeight : `${trace.netWeight} kg`
    : '';
  const isDefrosted = /descongelad/i.test(trace?.freshness || '');
  const consumerNotice = trace?.consumerNotice || (isDefrosted ? 'Consumir preferentemente en 3 días' : '');

  const traceFields = [
    ['Especie', trace?.description],
    ['Nombre científico', trace?.scientificName],
    ['Procedencia', trace?.origin || tag.origin],
    ['Subzona', trace?.subzone],
    ['Primer expedidor', trace?.firstShipper],
    ['Población', trace?.population],
    ['Fecha de captura', trace?.captureDate],
    ['Zona FAO', trace?.fao],
    ['Método de producción', trace?.productionMethod],
    ['Arte de pesca', trace?.fishingGear],
    ['Peso neto', weight],
    ['Presentación', trace?.presentation],
    ['Marca', trace?.brand],
    ['Registro CE', trace?.ceCode],
  ] as const;

  const invoiceFields = [
    ['Número de factura', trace?.invoiceNumber],
    ['Fecha de factura', trace?.invoiceDate],
    ['Expedidor', trace?.shipper],
    ['CIF expedidor', trace?.shipperTaxId],
    ['Registro sanitario del expedidor', trace?.shipperHealthRegistration],
    ['Comprador', trace?.buyer],
    ['N.º comprador', trace?.buyerNumber],
    ['Centro', trace?.establishment],
  ] as const;

  const extraFields = (trace?.extraFields || []).filter(({ label, value }) => label && value);

  return (
    <article className={`group relative isolate overflow-hidden rounded-[2rem] border ${accent.border} bg-[#12171a] shadow-2xl shadow-black/25`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 bg-gradient-to-b ${accent.glow} to-transparent`} />
      <div className="absolute left-0 top-0 h-full w-1 bg-orange-400" />

      <div className="p-5 sm:p-7 lg:p-8">
        <header className="border-b border-white/[.09] pb-5">
          <h3 className="text-balance text-3xl font-black uppercase leading-none tracking-[-.035em] text-white sm:text-4xl lg:text-5xl">
            {productName}
          </h3>
        </header>

        <div className="mt-5">
          <Field label="Lote" value={trace?.lot} important />
        </div>

        <section className="mt-5">
          <p className={`mb-3 text-[10px] font-black uppercase tracking-[.2em] ${accent.label}`}>Trazabilidad del producto</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {traceFields.map(([label, value]) => <Field key={label} label={label} value={value} />)}
          </div>
        </section>

        <section className="mt-6 border-t border-white/[.08] pt-5">
          <p className={`mb-3 text-[10px] font-black uppercase tracking-[.2em] ${accent.label}`}>Factura y expedidor</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {invoiceFields.map(([label, value]) => <Field key={label} label={label} value={value} />)}
          </div>
        </section>

        {extraFields.length > 0 ? (
          <section className="mt-6 border-t border-white/[.08] pt-5">
            <p className={`mb-3 text-[10px] font-black uppercase tracking-[.2em] ${accent.label}`}>Otros datos de la factura</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {extraFields.map(({ label, value }, index) => (
                <Field key={`${label}-${index}`} label={label} value={value} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {isDefrosted || consumerNotice ? (
        <div className="border-t border-amber-300/25 bg-amber-400/[.10] px-5 py-4 sm:px-7 lg:px-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
            {isDefrosted ? <strong className="text-base font-black uppercase tracking-[.12em] text-amber-200">DESCONGELADO</strong> : <span />}
            {consumerNotice ? <strong className="text-sm font-black uppercase tracking-[.08em] text-amber-100">⚠ {consumerNotice}</strong> : null}
          </div>
        </div>
      ) : null}

      <footer className="flex items-center justify-between gap-4 border-t border-white/[.07] bg-black/20 px-5 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500 sm:px-7 lg:px-8">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />Ficha activa</span>
        <span>CA46 · Trazabilidad verificada</span>
      </footer>
    </article>
  );
}
