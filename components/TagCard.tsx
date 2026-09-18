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
  { glow: 'from-orange-500/25', badge: 'bg-orange-400 text-[#171717]', icon: 'text-orange-300', line: 'bg-orange-400' },
  { glow: 'from-cyan-500/20', badge: 'bg-cyan-300 text-[#102025]', icon: 'text-cyan-300', line: 'bg-cyan-300' },
  { glow: 'from-emerald-500/20', badge: 'bg-emerald-300 text-[#10201b]', icon: 'text-emerald-300', line: 'bg-emerald-300' },
];

const DetailIcon = ({ type }: { type: 'lot' | 'origin' | 'method' | 'weight' }) => {
  const paths = {
    lot: <><path d="M5 5h14v14H5z"/><path d="M9 9h6M9 13h4"/></>,
    origin: <><circle cx="12" cy="10" r="3"/><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/></>,
    method: <><path d="M3 12h18M7 7c2 0 3 2 5 2s3-2 5-2M7 17c2 0 3-2 5-2s3 2 5 2"/></>,
    weight: <><path d="M6 8h12l2 12H4L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">{paths[type]}</svg>;
};

export default function TagCard({ tag, accentIndex = 0 }: { tag: Tag; accentIndex?: number }) {
  const trace = decodeTraceability(tag.category);
  const accent = accentStyles[accentIndex % accentStyles.length];
  const productName = trace?.description || tag.product_name;
  const secondary = [trace?.scientificName, trace?.freshness, trace?.presentation].filter(Boolean).join(' · ');
  const weight = trace?.netWeight
    ? /\bkg\b/i.test(trace.netWeight) ? trace.netWeight : `${trace.netWeight} kg`
    : '';

  const primaryDetails = [
    { label: 'Lote', value: trace?.lot, icon: 'lot' as const },
    { label: 'Procedencia', value: trace?.origin || tag.origin, icon: 'origin' as const },
    { label: 'Método', value: trace?.productionMethod, icon: 'method' as const },
    { label: 'Peso neto', value: weight, icon: 'weight' as const },
  ];

  const extraDetails = [
    ['Nombre científico', trace?.scientificName],
    ['Zona FAO', trace?.fao],
    ['Subzona', trace?.subzone],
    ['Arte de pesca', trace?.fishingGear],
    ['Primer expedidor', trace?.firstShipper],
    ['Población', trace?.population],
    ['Fecha de captura', trace?.captureDate],
    ['Marca', trace?.brand],
    ['Registro CE', trace?.ceCode],
    ['N.º factura', trace?.invoiceNumber],
    ['Fecha factura', trace?.invoiceDate],
    ['Expedidor', trace?.shipper],
    ['CIF expedidor', trace?.shipperTaxId],
    ['Registro sanitario expedidor', trace?.shipperHealthRegistration],
    ['Comprador', trace?.buyer],
    ['N.º comprador', trace?.buyerNumber],
    ['Centro', trace?.establishment],
    ...(trace?.extraFields || []).map(({ label, value }) => [label, value]),
  ].filter(([, value]) => value);

  const consumerNotice = trace?.consumerNotice || (/descongelad/i.test(trace?.freshness || '') ? 'Consumir preferentemente en 3 días' : '');

  return (
    <article className="group relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#12171a] shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-black/40">
      <div className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b ${accent.glow} to-transparent opacity-80`} />
      <div className={`absolute left-0 top-10 h-20 w-1 rounded-r-full ${accent.line}`} />

      <div className="p-6 sm:p-7">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className={`mb-4 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] ${accent.badge}`}>Trazabilidad verificada</span>
            <h3 className="text-balance text-2xl font-black uppercase leading-[1.05] tracking-[-.025em] text-white sm:text-3xl">{productName}</h3>
            <p className="mt-2 min-h-5 text-sm font-semibold uppercase tracking-wider text-slate-400">{secondary || 'Producto del mar'}</p>
          </div>
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-[1.2rem] border border-white/10 bg-black/20 text-3xl ${accent.icon}`}>◇</div>
        </div>

        {consumerNotice ? (
          <div className="mb-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-black uppercase tracking-wide text-amber-200">
            ⚠ {consumerNotice}
          </div>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          {primaryDetails.map((detail) => (
            <div key={detail.label} className="rounded-2xl border border-white/[.07] bg-white/[.045] p-4 transition group-hover:bg-white/[.06]">
              <dt className={`mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] ${accent.icon}`}><DetailIcon type={detail.icon}/>{detail.label}</dt>
              <dd className="break-words text-sm font-bold leading-5 text-slate-100">{detail.value || 'No indicado'}</dd>
            </div>
          ))}
        </dl>

        {extraDetails.length > 0 ? (
          <div className="mt-5 grid gap-2 border-t border-white/[.08] pt-5 sm:grid-cols-2">
            {extraDetails.map(([label, value]) => (
              <div key={`${label}-${value}`} className="rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-xs leading-5 text-slate-400">
                <strong className="block text-[10px] uppercase tracking-[.14em] text-slate-500">{label}</strong>
                <span className="font-bold text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-white/[.07] bg-black/20 px-6 py-4 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500 sm:px-7">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Ficha activa</span>
        <span>{tag.drive_file_id ? 'Documento verificado' : 'Registro manual'}</span>
      </div>
    </article>
  );
}
