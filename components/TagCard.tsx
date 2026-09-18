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
  { glow: 'from-orange-500/25', icon: 'text-orange-300', line: 'bg-orange-400' },
  { glow: 'from-cyan-500/20', icon: 'text-cyan-300', line: 'bg-cyan-300' },
  { glow: 'from-emerald-500/20', icon: 'text-emerald-300', line: 'bg-emerald-300' },
];

export default function TagCard({ tag, accentIndex = 0 }: { tag: Tag; accentIndex?: number }) {
  const trace = decodeTraceability(tag.category);
  const accent = accentStyles[accentIndex % accentStyles.length];
  const productName = trace?.description || tag.product_name;
  const weight = trace?.netWeight
    ? /\bkg\b/i.test(trace.netWeight) ? trace.netWeight : `${trace.netWeight} kg`
    : '';

  const requiredDetails = [
    ['Especie', trace?.description || tag.product_name],
    ['Nombre científico', trace?.scientificName],
    ['Procedencia', trace?.origin || tag.origin],
    ['Subzona', trace?.subzone],
    ['Primer expedidor', trace?.firstShipper],
    ['Población', trace?.population],
    ['Fecha de captura', trace?.captureDate],
    ['N.º factura', trace?.invoiceNumber],
    ['Fecha de factura', trace?.invoiceDate],
    ['Expedidor', trace?.shipper],
    ['CIF expedidor', trace?.shipperTaxId],
    ['Registro sanitario del expedidor', trace?.shipperHealthRegistration],
  ].filter(([, value]) => Boolean(value));

  const complementaryDetails = [
    ['Zona FAO', trace?.fao],
    ['Método de producción', trace?.productionMethod],
    ['Arte de pesca', trace?.fishingGear],
    ['Peso neto', weight],
    ['Marca', trace?.brand],
    ['Presentación', trace?.presentation],
    ['Registro CE', trace?.ceCode],
    ['Comprador', trace?.buyer],
    ['N.º comprador', trace?.buyerNumber],
    ...(trace?.extraFields || []).map(({ label, value }) => [label, value]),
  ].filter(([, value]) => Boolean(value));

  const isDefrosted = /descongelad/i.test(trace?.freshness || '');
  const consumerNotice = trace?.consumerNotice || (isDefrosted ? 'Consumir preferentemente en 3 días' : '');

  return (
    <article className="group relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#12171a] shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-black/40">
      <div className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b ${accent.glow} to-transparent opacity-80`} />
      <div className={`absolute left-0 top-10 h-20 w-1 rounded-r-full ${accent.line}`} />

      <div className="p-6 sm:p-7">
        <header className="border-b border-white/[.08] pb-6">
          <h3 className="text-balance text-3xl font-black uppercase leading-[1.03] tracking-[-.03em] text-white sm:text-4xl">
            {productName}
          </h3>
        </header>

        {trace?.lot ? (
          <section className="mt-5 rounded-2xl border border-orange-400/40 bg-orange-500/10 p-4 shadow-lg shadow-orange-950/10">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-300">Lote · IMPORTANTE</p>
            <p className="mt-2 break-words text-xl font-black text-white">{trace.lot}</p>
          </section>
        ) : null}

        {requiredDetails.length > 0 ? (
          <section className="mt-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {requiredDetails.map(([label, value]) => (
                <div key={`${label}-${value}`} className="rounded-xl border border-white/[.08] bg-black/20 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-100">{value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {complementaryDetails.length > 0 ? (
          <section className="mt-5 border-t border-white/[.08] pt-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {complementaryDetails.map(([label, value]) => (
                <div key={`${label}-${value}`} className="rounded-xl border border-white/[.07] bg-white/[.035] px-3 py-2.5">
                  <p className={`text-[10px] font-black uppercase tracking-[.14em] ${accent.icon}`}>{label}</p>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {isDefrosted || consumerNotice ? (
          <section className="mt-6 border-t border-white/[.08] pt-5">
            {isDefrosted ? (
              <div className="rounded-t-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-base font-black uppercase tracking-[.14em] text-amber-200">
                DESCONGELADO
              </div>
            ) : null}
            {consumerNotice ? (
              <div className={`${isDefrosted ? 'rounded-b-2xl border-x border-b' : 'rounded-2xl border'} border-amber-400/30 bg-amber-400/[.07] px-4 py-3 text-center text-sm font-black uppercase tracking-wide text-amber-100`}>
                ⚠ {consumerNotice}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-white/[.07] bg-black/20 px-6 py-4 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500 sm:px-7">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Ficha activa</span>
        <span>{tag.drive_file_id ? 'Documento verificado' : 'Registro manual'}</span>
      </footer>
    </article>
  );
}
