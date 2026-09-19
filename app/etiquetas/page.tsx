'use client';

import Image from 'next/image';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import TagCard from '@/components/TagCard';
import { decodeTraceability } from '@/lib/traceability';

interface Tag {
  id: string;
  product_name: string;
  origin: string | null;
  category: string;
  is_active: boolean;
  expires_at: string;
  drive_file_id?: string;
}

type ScreenMode = 'showcase' | 'search';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .trim();

const AUTO_REFRESH_MS = 15_000;
const SHOWCASE_MS = 9_000;
const SEARCH_IDLE_MS = 30_000;

function searchableText(tag: Tag) {
  const trace = decodeTraceability(tag.category);
  return normalize([
    tag.product_name,
    tag.origin || '',
    trace?.description || '',
    trace?.scientificName || '',
    trace?.lot || '',
    trace?.origin || '',
    trace?.fao || '',
  ].join(' '));
}

export default function EtiquetasPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mode, setMode] = useState<ScreenMode>('showcase');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    void fetchTags(controller.signal);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchTags();
    }, AUTO_REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [fetchTags]);

  useEffect(() => {
    if (currentIndex >= tags.length) setCurrentIndex(0);
  }, [currentIndex, tags.length]);

  useEffect(() => {
    if (mode !== 'showcase' || tags.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((current) => (current + 1) % tags.length);
    }, SHOWCASE_MS);
    return () => window.clearInterval(intervalId);
  }, [mode, tags.length]);

  const enterSearch = useCallback(() => {
    setMode('search');
  }, []);

  const returnToShowcase = useCallback(() => {
    setMode('showcase');
    setQuery('');
    setSelectedTagId('');
  }, []);

  useEffect(() => {
    if (mode !== 'search') return;
    const focusId = window.setTimeout(() => searchInputRef.current?.focus(), 80);
    let idleId = window.setTimeout(returnToShowcase, SEARCH_IDLE_MS);

    const resetIdle = () => {
      window.clearTimeout(idleId);
      idleId = window.setTimeout(returnToShowcase, SEARCH_IDLE_MS);
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'input', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdle, { passive: true }));

    return () => {
      window.clearTimeout(focusId);
      window.clearTimeout(idleId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdle));
    };
  }, [mode, returnToShowcase]);

  const filteredTags = useMemo(() => {
    const term = normalize(deferredQuery);
    if (!term) return tags;
    return tags.filter((tag) => searchableText(tag).includes(term));
  }, [deferredQuery, tags]);

  const suggestions = useMemo(() => {
    const term = normalize(query);
    if (!term) return [];
    return tags
      .map((tag) => tag.product_name)
      .filter((name, index, names) => names.indexOf(name) === index && normalize(name).includes(term))
      .slice(0, 6);
  }, [query, tags]);

  const currentTag = tags.length > 0 ? tags[currentIndex % tags.length] : null;
  const selectedTag = tags.find((tag) => tag.id === selectedTagId) || null;

  if (mode === 'showcase') {
    return (
      <div
        className="relative min-h-screen cursor-pointer overflow-hidden bg-[#080b0d] text-white selection:bg-orange-500/30"
        onPointerDown={enterSearch}
        role="button"
        tabIndex={0}
        onKeyDown={enterSearch}
        aria-label="Toca la pantalla para buscar una etiqueta"
      >
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_5%,rgba(249,115,22,.18),transparent_27%),radial-gradient(circle_at_88%_18%,rgba(14,165,233,.08),transparent_25%)]" />

        <header className="relative flex items-center justify-between gap-4 border-b border-white/10 bg-[#0c1013]/90 px-5 py-3 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-orange-400/20 bg-black sm:h-14 sm:w-14">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight sm:text-xl">CA46 · Trazabilidad alimentaria</p>
              <p className="text-xs font-bold text-slate-500">Información del producto disponible en pantalla</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[.15em] text-emerald-300 sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> En directo
          </div>
        </header>

        <main className="relative flex min-h-[calc(100vh-138px)] items-center justify-center px-4 py-5 sm:px-7">
          {loading ? (
            <div className="w-full max-w-7xl animate-pulse rounded-[2rem] border border-white/10 bg-white/5 p-10">
              <div className="h-12 w-2/3 rounded-xl bg-white/10" />
              <div className="mt-8 h-80 rounded-2xl bg-white/5" />
            </div>
          ) : currentTag ? (
            <div key={currentTag.id} className="w-full max-w-7xl animate-[fadeIn_.45s_ease-out]">
              <TagCard tag={currentTag} accentIndex={currentIndex} />
            </div>
          ) : (
            <div className="max-w-xl rounded-[2rem] border border-dashed border-white/15 bg-white/[.03] px-8 py-16 text-center">
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-orange-500/10 text-4xl">🐟</div>
              <h1 className="text-3xl font-black">No hay etiquetas activas</h1>
              <p className="mt-3 leading-7 text-slate-400">Cuando se publique una etiqueta de trazabilidad aparecerá aquí automáticamente.</p>
            </div>
          )}
        </main>

        <footer className="relative flex items-center justify-between gap-4 border-t border-white/10 bg-black/30 px-5 py-3 text-xs font-bold text-slate-500 sm:px-8">
          <span>{tags.length > 0 ? `${currentIndex + 1} / ${tags.length} etiquetas activas` : 'Esperando etiquetas'}</span>
          <span className="rounded-full border border-orange-400/25 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300">👆 Toca la pantalla para buscar</span>
          <span className="hidden sm:inline">{lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_8%,rgba(249,115,22,.16),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(14,165,233,.08),transparent_25%)]" />

      <header className="relative border-b border-white/10 bg-[#0d1114]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-black">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" />
            </div>
            <div>
              <p className="text-xl font-black">Buscar trazabilidad</p>
              <p className="text-xs font-semibold text-slate-500">La pantalla volverá sola al escaparate tras 30 segundos sin uso</p>
            </div>
          </div>
          <button type="button" onClick={returnToShowcase} className="rounded-full border border-orange-400/25 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300">Volver al escaparate</button>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Consulta táctil</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">¿Qué producto quieres consultar?</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Busca por especie, lote, procedencia, zona FAO o nombre científico.</p>

          <div className="relative mx-auto mt-7 max-w-2xl text-left">
            <div className="flex items-center gap-3 rounded-[1.4rem] border border-orange-400/40 bg-white/[.07] p-2 pl-5 shadow-2xl shadow-black/30">
              <svg aria-hidden="true" className="h-6 w-6 shrink-0 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
              <input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelectedTagId(''); }} autoComplete="off" inputMode="search" aria-label="Buscar producto" placeholder="Merluza, atún, lote, FAO…" className="min-w-0 flex-1 bg-transparent py-3 text-lg font-semibold text-white outline-none placeholder:text-slate-500" />
              {query ? <button type="button" onClick={() => { setQuery(''); setSelectedTagId(''); }} aria-label="Borrar búsqueda" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-slate-300">×</button> : null}
            </div>
            {suggestions.length > 0 && query && !selectedTag ? (
              <div className="absolute inset-x-0 top-[calc(100%+.6rem)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-[#171c20]/98 p-2 shadow-2xl backdrop-blur-xl">
                {suggestions.map((name) => <button type="button" key={name} onClick={() => setQuery(name)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold text-slate-200 hover:bg-orange-500/15 hover:text-orange-300"><span className="text-orange-400">↗</span>{name}</button>)}
              </div>
            ) : null}
          </div>
        </section>

        {selectedTag ? (
          <section className="mt-9">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setSelectedTagId('')} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Volver a resultados</button>
              <span className="text-xs font-bold text-slate-500">Etiqueta activa</span>
            </div>
            <TagCard tag={selectedTag} accentIndex={0} />
          </section>
        ) : (
          <section className="mt-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
              <div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Etiquetas activas</p><h2 className="mt-1 text-2xl font-black">{query ? `Resultados para “${query}”` : 'Productos disponibles'}</h2></div>
              <button type="button" onClick={() => void fetchTags()} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">↻ Actualizar</button>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="h-32 animate-pulse rounded-2xl bg-white/5"/><div className="h-32 animate-pulse rounded-2xl bg-white/5"/><div className="h-32 animate-pulse rounded-2xl bg-white/5"/></div>
            ) : filteredTags.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTags.map((tag) => {
                  const trace = decodeTraceability(tag.category);
                  return (
                    <button key={tag.id} type="button" onClick={() => setSelectedTagId(tag.id)} className="rounded-2xl border border-white/10 bg-white/[.035] p-5 text-left transition hover:border-orange-400/40 hover:bg-orange-500/[.07] active:scale-[.99]">
                      <p className="text-xs font-black uppercase tracking-[.16em] text-orange-400">Consultar etiqueta →</p>
                      <h3 className="mt-2 text-2xl font-black uppercase">{trace?.description || tag.product_name}</h3>
                      <p className="mt-3 text-sm font-bold text-slate-400">Lote: <span className="text-slate-200">{trace?.lot || '—'}</span></p>
                      <p className="mt-1 text-sm text-slate-500">{trace?.origin || tag.origin || 'Procedencia no indicada'}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[.03] px-6 py-14 text-center">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-orange-500/10 text-3xl">🐟</div>
                <h3 className="text-2xl font-black">No encontramos ese producto</h3>
                <p className="mt-2 text-slate-400">Prueba con menos letras, un lote distinto o la zona FAO.</p>
                <button type="button" onClick={() => setQuery('')} className="mt-6 rounded-full bg-orange-500 px-5 py-2.5 font-black text-[#121416]">Ver todos</button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
