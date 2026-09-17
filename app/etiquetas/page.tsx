'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import TagCard from '@/components/TagCard';

interface Tag {
  id: string;
  product_name: string;
  origin: string | null;
  category: string;
  is_active: boolean;
  expires_at: string;
  drive_file_id?: string;
}

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .trim();

const AUTO_REFRESH_MS = 15_000;

export default function EtiquetasPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const fetchTags = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/digital-tags', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('No se pudieron cargar las etiquetas');
      const data: unknown = await response.json();
      if (Array.isArray(data)) {
        setTags(data as Tag[]);
        setLastUpdated(new Date());
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialFetchId = window.setTimeout(() => void fetchTags(controller.signal), 0);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchTags();
    }, AUTO_REFRESH_MS);

    return () => {
      controller.abort();
      window.clearTimeout(initialFetchId);
      window.clearInterval(intervalId);
    };
  }, [fetchTags]);

  const filteredTags = useMemo(() => {
    const term = normalize(deferredQuery);
    if (!term) return tags;
    return tags.filter((tag) => normalize(tag.product_name).includes(term));
  }, [deferredQuery, tags]);

  const suggestions = useMemo(() => {
    const term = normalize(query);
    if (!term) return [];
    return tags
      .map((tag) => tag.product_name)
      .filter((name, index, names) => names.indexOf(name) === index && normalize(name).includes(term))
      .slice(0, 5);
  }, [query, tags]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const response = await fetch('/api/sync-drive');
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Error de sincronización');
      setSyncMsg(`${data.synchronized || 0} etiquetas actualizadas`);
      await fetchTags();
    } catch (error) {
      setSyncMsg(error instanceof Error ? error.message : 'Error de sincronización');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#0a0d0f] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(249,115,22,.16),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(14,165,233,.10),transparent_25%)]" />

      <header className="relative border-b border-white/10 bg-[#0d1114]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg shadow-orange-950/40 sm:h-16 sm:w-16">
              <Image src="/ca46-logo.svg" alt="Logotipo CA46" fill priority sizes="64px" className="object-cover" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight sm:text-xl">Trazabilidad del mar</p>
              <p className="text-xs font-medium text-slate-400">Información clara, origen verdadero</p>
            </div>
          </div>
          <button onClick={handleSync} disabled={syncing} className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-orange-400/50 hover:bg-orange-500/10 disabled:opacity-50 sm:flex">
            <span className={syncing ? 'animate-spin' : ''}>↻</span>{syncing ? 'Actualizando' : 'Actualizar'}
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <section className="mx-auto mb-12 max-w-3xl text-center">
          <div className="relative mx-auto mb-6 h-24 w-24 overflow-hidden rounded-[1.8rem] border border-white/10 bg-black shadow-2xl shadow-orange-950/40 sm:h-28 sm:w-28">
            <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="112px" className="object-cover" />
          </div>
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Sistema activo
          </span>
          <h1 className="text-balance text-4xl font-black tracking-[-.04em] sm:text-6xl">
            Conoce lo que llega<br /><span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">a tu mesa</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
            Busca tu producto y consulta su procedencia, lote y método de producción de forma sencilla.
          </p>

          <div className="relative mx-auto mt-8 max-w-2xl text-left">
            <div className="group flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/[.07] p-2 pl-5 shadow-2xl shadow-black/30 backdrop-blur-xl transition focus-within:border-orange-400/60 focus-within:bg-white/[.09] focus-within:shadow-orange-950/30">
              <svg aria-hidden="true" className="h-6 w-6 shrink-0 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
              <input value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" inputMode="search" aria-label="Buscar producto" placeholder="Busca merluza, pescada, atún…" className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold text-white outline-none placeholder:text-slate-500 sm:text-lg" />
              {query ? <button onClick={() => setQuery('')} aria-label="Borrar búsqueda" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-slate-300 transition hover:bg-white/20">×</button> : null}
            </div>
            {suggestions.length > 0 && query ? (
              <div className="absolute inset-x-0 top-[calc(100%+.6rem)] z-20 overflow-hidden rounded-2xl border border-white/10 bg-[#171c20]/95 p-2 shadow-2xl backdrop-blur-xl">
                {suggestions.map((name) => <button key={name} onClick={() => setQuery(name)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold text-slate-200 transition hover:bg-orange-500/15 hover:text-orange-300"><span className="text-orange-400">↗</span>{name}</button>)}
              </div>
            ) : null}
          </div>
          {syncMsg ? <p className="mt-4 text-sm font-semibold text-slate-400">{syncMsg}</p> : null}
          <p className="mt-3 text-xs font-semibold text-slate-500" aria-live="polite">
            Actualización automática cada 15 segundos{lastUpdated ? ` · Última comprobación ${lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
          </p>
        </section>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-5">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-400">Productos trazados</p><h2 className="mt-1 text-2xl font-black">{query ? `Resultados para “${query}”` : 'Últimas etiquetas'}</h2></div>
          <p aria-live="polite" className="rounded-full bg-white/5 px-4 py-2 text-sm font-bold text-slate-400">{filteredTags.length} {filteredTags.length === 1 ? 'resultado' : 'resultados'}</p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2"><div className="h-96 animate-pulse rounded-[2rem] bg-white/5"/><div className="h-96 animate-pulse rounded-[2rem] bg-white/5"/></div>
        ) : filteredTags.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">{filteredTags.map((tag, index) => <TagCard key={tag.id} tag={tag} accentIndex={index} />)}</div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[.03] px-6 py-16 text-center"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-orange-500/10 text-3xl">🐟</div><h3 className="text-2xl font-black">No encontramos ese producto</h3><p className="mt-2 text-slate-400">Prueba escribiendo menos letras o comprueba el nombre.</p><button onClick={() => setQuery('')} className="mt-6 rounded-full bg-orange-500 px-5 py-2.5 font-black text-[#121416] transition hover:bg-orange-400">Ver todos</button></div>
        )}
      </main>

      <footer className="relative border-t border-white/10 bg-black/20 px-5 py-7 text-center text-xs font-semibold tracking-wide text-slate-500">CA46 · Ecosistema Inteligente de Trazabilidad Alimentaria</footer>
    </div>
  );
}
