'use client';

import { useEffect, useState } from 'react';
import { decodeTraceability } from '@/lib/traceability';

interface Tag {
  id: string;
  product_name: string;
  origin: string | null;
  category: string;
  is_active: boolean;
  drive_file_id?: string;
  expires_at?: string;
  source?: 'invoice' | 'physical_label' | 'legacy' | 'kitchen' | null;
  status?: 'definitive' | 'provisional' | null;
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
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    if (tag.source !== 'kitchen') return;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [tag.source]);
  const trace = decodeTraceability(tag.category);
  const accent = accentStyles[accentIndex % accentStyles.length];
  const productName = trace?.description || tag.product_name;
  const weight = trace?.netWeight
    ? /\bkg\b/i.test(trace.netWeight) ? trace.netWeight : `${trace.netWeight} kg`
    : '';
  const isDefrosted = /descongelad/i.test(trace?.freshness || '');
  const isTemporaryChild = tag.status === 'provisional' && tag.source === 'kitchen';
  const isKitchen = tag.source === 'kitchen';
  const consumptionDate = trace?.extraFields.find((field) => field.label === 'Fecha límite de consumo')?.value;
  const consumptionElapsed = consumptionDate ? new Date(consumptionDate).getTime() <= currentTime : false;
  const consumerNotice = (trace?.consumerNotice || '').split(' · ').filter((notice) => !/etiqueta provisional|factura pendiente/i.test(notice)).join(' · ') || (isDefrosted ? 'Consumir preferentemente en 3 días' : '');
  const expiresLabel = tag.expires_at
    ? new Date(tag.expires_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

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
      <div className={`absolute left-0 top-0 h-full w-1 bg-orange-400`} />

      {isKitchen ? (
        <div className="flex flex-col gap-1 border-b border-amber-300/20 bg-amber-400/[.10] px-5 py-3 text-amber-100 sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:px-8">
          <strong className="text-xs font-black uppercase tracking-[.16em]">
            {isTemporaryChild ? 'ELABORACIÓN PROPIA · 10 DÍAS EN VISOR · ORIGEN PROVISIONAL' : 'ELABORACIÓN PROPIA · 10 DÍAS EN VISOR'}
          </strong>
          {expiresLabel ? <span className="text-xs font-bold text-amber-200">{isKitchen ? 'Fin de exposición' : 'Caduca'} {expiresLabel}</span> : null}
        </div>
      ) : null}
      {isKitchen && consumptionElapsed ? <p className="border-b border-rose-400/30 bg-rose-500/10 px-5 py-3 font-bold text-rose-200">Plazo de consumo indicado superado. La exposición en el visor conserva la información de trazabilidad.</p> : null}

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
          <p className={`mb-3 text-[10px] font-black uppercase tracking-[.2em] ${accent.label}`}>
            Datos del documento y expedidor
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {invoiceFields.map(([label, value]) => <Field key={label} label={label} value={value} />)}
          </div>
        </section>

        {extraFields.length > 0 ? (
          <section className="mt-6 border-t border-white/[.08] pt-5">
            <p className={`mb-3 text-[10px] font-black uppercase tracking-[.2em] ${accent.label}`}>Otros datos de trazabilidad</p>
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
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full bg-emerald-400`} />
          {isTemporaryChild ? 'Temporal hija activa' : 'Ficha activa'}
        </span>
        <span className="text-right">{!isKitchen && (tag.source === 'invoice' || tag.source === 'physical_label') ? <span className="block">{tag.source === 'physical_label' ? 'Etiqueta de caja · 24 h' : 'Factura · 72 h'}{expiresLabel ? ` · Hasta ${expiresLabel}` : ''}</span> : null}CA46 · Trazabilidad alimentaria</span>
      </footer>
    </article>
  );
}
