'use client';

import Link from 'next/link';
import { useEffect, useState, type ComponentProps } from 'react';
import TagCard from '@/components/TagCard';
import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';
import { decodeTraceability } from '@/lib/traceability';

type Label = ComponentProps<typeof TagCard>['tag'] & {
  created_at: string; expires_at: string; annulled_at: string | null; annulled_reason: string | null;
};
const dateText = (value: string) => new Date(value).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
function state(label: Label) {
  return label.annulled_at ? 'Anulada' : new Date(label.expires_at).getTime() <= Date.now() ? 'Caducada' : label.is_active ? 'Vigente' : 'Inactiva';
}

export default function RecuperarEtiquetasPage() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Label | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ q: query, type, date, page: String(page) });
        const response = await fetch(`/api/label-history?${params}`, { headers: await tenantAuthorizationHeader(), cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        if (!controller.signal.aborted) { setLabels(payload.labels); setHasMore(payload.hasMore); }
      } catch (failure) {
        if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : 'No se pudo cargar el historial.'); setLabels([]); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, type, date, page, refresh]);

  async function download(label: Label) {
    setDownloading(true);
    setError('');
    try {
      const response = await fetch(`/api/label-history?id=${label.id}`, { headers: await tenantAuthorizationHeader(), cache: 'no-store' });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.error); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `CA46_etiqueta_${label.id}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo recuperar la etiqueta.'); }
    finally { setDownloading(false); }
  }

  return (
    <main className="min-h-screen bg-[#080b0d] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/crear" className="text-sm font-bold text-orange-300">← Etiquetas</Link>
        <h1 className="mt-5 text-3xl font-black">Recuperar etiquetas</h1>
        <p className="mt-3 text-slate-400">Etiquetas de 24 y 72 horas creadas en los últimos 15 días. Recuperarlas conserva sus fechas y lotes originales.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-bold">Producto o lote<input value={query} onChange={event => { setQuery(event.target.value); setPage(0); setSelected(null); }} placeholder="Buscar producto o lote" className="mt-2 w-full rounded-xl border border-white/15 bg-[#12171a] p-3" /></label>
          <label className="text-sm font-bold">Tipo<select value={type} onChange={event => { setType(event.target.value); setPage(0); setSelected(null); }} className="mt-2 w-full rounded-xl border border-white/15 bg-[#12171a] p-3"><option value="">24 y 72 horas</option><option value="24">Etiqueta de caja · 24 h</option><option value="72">Factura · 72 h</option></select></label>
          <label className="text-sm font-bold">Fecha de creación<input type="date" value={date} onChange={event => { setDate(event.target.value); setPage(0); setSelected(null); }} className="mt-2 w-full rounded-xl border border-white/15 bg-[#12171a] p-3" /></label>
        </div>
        {error ? <div role="alert" className="mt-5 text-rose-300">{error}<button onClick={() => setRefresh(value => value + 1)} className="ml-3 underline">Reintentar</button></div> : null}
        {selected ? (
          <section className="mt-6">
            <button onClick={() => setSelected(null)} className="mb-4 rounded-xl border border-white/15 px-4 py-3">← Resultados</button>
            <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4">
              <strong>{state(selected)} · Copia del historial</strong>
              <p className="mt-2 text-sm">Creada: {dateText(selected.created_at)} · Fin original: {dateText(selected.expires_at)}</p>
              {selected.annulled_reason ? <p className="mt-2 text-sm">Motivo de anulación: {selected.annulled_reason}</p> : null}
              <p className="mt-2 text-sm">La recuperación no reinicia la vigencia ni publica la etiqueta en el visor.</p>
            </div>
            <div className="[&_article_footer]:hidden"><TagCard tag={selected} /></div>
            <button disabled={downloading} onClick={() => void download(selected)} className="mt-5 rounded-xl bg-orange-500 px-5 py-3 font-black text-black disabled:opacity-50">{downloading ? 'Preparando…' : 'Descargar etiqueta PDF'}</button>
            <p className="mt-3 text-sm text-slate-400">Abre el PDF descargado para imprimirlo.</p>
          </section>
        ) : loading ? <p role="status" className="mt-8 text-slate-400">Cargando historial…</p> : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {labels.map(label => <button key={label.id} onClick={() => setSelected(label)} className="rounded-2xl border border-white/15 bg-[#12171a] p-5 text-left">
                <p className="text-xs font-bold text-amber-300">{state(label)} · {label.source === 'physical_label' ? '24 h' : '72 h'}</p>
                <h2 className="mt-2 text-2xl font-black">{label.product_name}</h2>
                <p className="mt-3 text-sm text-slate-300">Lote: {decodeTraceability(label.category)?.lot || '—'}</p>
                <p className="mt-2 text-xs text-slate-400">Creada: {dateText(label.created_at)}</p>
                <span className="mt-4 inline-block font-bold text-orange-300">Recuperar etiqueta →</span>
              </button>)}
            </section>
            {!labels.length && !error ? <p className="mt-8 text-slate-400">No hay etiquetas de los últimos 15 días con estos filtros.</p> : null}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button disabled={page === 0} onClick={() => setPage(value => value - 1)} className="rounded-xl border border-white/15 p-3 disabled:opacity-30">Anterior</button>
              <span className="text-sm text-slate-400">Página {page + 1}</span>
              <button disabled={!hasMore} onClick={() => setPage(value => value + 1)} className="rounded-xl border border-white/15 p-3 disabled:opacity-30">Siguiente</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
