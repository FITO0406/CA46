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

const fields = [
  ['Lote', 'lot'], ['Marca', 'brand'], ['Peso neto', 'netWeight'],
  ['Método de producción', 'productionMethod'], ['Presentación', 'presentation'],
  ['Procedencia', 'origin'], ['Zona FAO', 'fao'], ['Frescura', 'freshness'],
  ['Arte de pesca', 'fishingGear'], ['Registro sanitario (CE)', 'ceCode'],
] as const;

export default function TagCard({ tag }: { tag: Tag }) {
  const trace = decodeTraceability(tag.category);
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
      <div className="border-b border-orange-500/40 bg-gradient-to-r from-orange-500/15 to-transparent p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950">Trazabilidad</span>
          <span className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />Información verificada
          </span>
        </div>
        <h2 className="text-2xl font-black uppercase leading-tight text-white">{trace?.description || tag.product_name}</h2>
      </div>
      <dl className="grid grid-cols-1 gap-px bg-slate-700 sm:grid-cols-2">
        {trace ? fields.map(([label, key]) => (
          <div key={key} className="min-h-20 bg-slate-900 p-4">
            <dt className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="text-sm font-semibold text-slate-100">{trace[key] || 'No indicado'}</dd>
          </div>
        )) : (
          <div className="bg-slate-900 p-4 sm:col-span-2">
            <dt className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Procedencia</dt>
            <dd className="font-semibold text-slate-100">{tag.origin || 'No indicada'}</dd>
          </div>
        )}
      </dl>
      <footer className="flex items-center justify-between gap-4 bg-slate-950 px-5 py-3 text-[11px] font-medium text-slate-500">
        <span>CA46 · Trazabilidad alimentaria</span>
        <span>{tag.drive_file_id ? 'Origen documental: Drive' : 'Registro manual'}</span>
      </footer>
    </article>
  );
}
