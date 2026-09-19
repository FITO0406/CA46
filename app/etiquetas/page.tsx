'use client';

import Image from 'next/image';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import TagCard from '@/components/TagCard';
import { decodeTraceability } from '@/lib/traceability';
import { loadTenantCompanyConfig } from '@/lib/tenant-company-config';

interface Tag {
  id: string;
  product_name: string;
  origin: string | null;
  category: string;
  is_active: boolean;
  expires_at: string;
  drive_file_id?: string;
  source?: 'invoice' | 'physical_label' | null;
  status?: 'definitive' | 'provisional' | null;
}

type ScreenMode = 'showcase' | 'search';

const AUTO_REFRESH_MS = 15_000;
const SHOWCASE_MS = 9_000;
const SEARCH_IDLE_MS = 30_000;

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .trim();

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
  const [screenReady, setScreenReady] = useState(false);
  const [screenToken, setScreenToken] = useState('');
  const [screenName, setScreenName] = useState('');
  const [mode, setMode] = useState<ScreenMode>('showcase');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function prepareScreen() {
      const url = new URL(window.location.href);
      const tokenFromUrl = url.searchParams.get('screen')?.trim() || '';

      if (tokenFromUrl) {
        if (active) {
          setScreenToken(tokenFromUrl);
          setScreenReady(true);
        }
        return;
      }

      try {
        const config = await loadTenantCompanyConfig();
        if (!active) return;
        if (config?.publicScreenToken && config.publicScreenEnabled) {
          setScreenToken(config.publicScreenToken);
          setScreenName(config.screenName || config.businessName || '');
          url.searchParams.set('screen', config.publicScreenToken);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // Sin sesión: se mantiene la compatibilidad con etiquetas antiguas.
      } finally {
        if (active) setScreenReady(true);
      }
    }

    void prepareScreen();
    return () => {
      active = false;
    };
  }, []);

  const fetchTags = useCallback(async (signal?: AbortSignal) => {
    if (!screenReady) return;

    try {
      const endpoint = screenToken
        ? `/api/digital-tags?screen=${encodeURIComponent(screenToken)}`
        : '/api/digital-tags';
      const response = await fetch(endpoint, { cache: 'no-store', signal });
      if (!response.ok) throw new Error('No se pudieron cargar las etiquetas');
      const data: unknown = await response.json();
      setTags(Array.isArray(data) ? data as Tag[] : []);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [screenReady, screenToken]);

  useEffect(() => {
    if (!screenReady) return;
    const controller = new AbortController();
    void fetchTags(controller.signal);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchTags();
    }, AUTO_REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [fetchTags, screenReady]);

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

  const currentTag = tags.length > 0 ? tags[currentIndex % tags.length] : null;
  const selectedTag = tags.find((tag) => tag.id === selectedTagId) || null;
  const currentTrace = currentTag ? decodeTraceability(currentTag.category) : null;
  const establishmentName = screenName || currentTrace?.establishment || 'CA46';

  if (mode === 'showcase') {
    return (
      <div
        className="relative min-h-screen cursor-pointer overflow-hidden bg-[#080b0d] text-white"
        onPointerDown={() => setMode('search')}
        role="button"
        tabIndex={0}
        onKeyDown={() => setMode('search')}
        aria-label="Toca para buscar una etiqueta"
      >
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_5%,rgba(249,115,22,.18),transparent_27%),radial-gradient(circle_at_88%_18%,rgba(14,165,233,.08),transparent_25%)]" />

        <header className="relative flex items-center justify-between gap-4 border-b border-white/10 bg-[#0c1013]/90 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-orange-400/20 bg-black">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-lg font-black sm:text-xl">{establishmentName}</p>
              <p className="text-xs font-bold text-slate-500">Trazabilidad alimentaria</p>
            </div>
          </div>
          {currentTag ? (
            <span className={`rounded-full px-3 py-2 text-xs font-black ${currentTag.status === 'provisional' ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>
              {currentTag.status === 'provisional' ? 'PROVISIONAL · 24 H' : 'ACTIVA · 72 H'}
            </span>
          ) : null}
        </header>

        <main className="relative flex min-h-[calc(100vh-136px)] items-center justify-center px-4 py-5 sm:px-7">
          {loading || !screenReady ? (
            <p className="text-lg font-black text-slate-500">Cargando etiquetas…</p>
          ) : currentTag ? (
            <div key={currentTag.id} className="w-full max-w-7xl animate-[fadeIn_.35s_ease-out]">
              <TagCard tag={currentTag} accentIndex={currentIndex} />
            </div>
          ) : (
            <div className="max-w-xl rounded-[2rem] border border-dashed border-white/15 bg-white/[.03] px-8 py-14 text-center">
              <div className="text-5xl">🐟</div>
              <h1 className="mt-5 text-3xl font-black">No hay etiquetas activas</h1>
              <p className="mt-3 text-slate-400">Cuando publiques una etiqueta aparecerá aquí automáticamente.</p>
            </div>
          )}
        </main>

        <footer className="relative flex items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-5 py-3 text-xs font-bold text-slate-500 sm:px-8">
          <span>{tags.length ? `${currentIndex + 1} / ${tags.length}` : '0 etiquetas'}</span>
          <span className="rounded-full bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300">👆 Toca para buscar</span>
          <span className="hidden sm:inline">Actualización automática</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013] px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Buscar etiqueta</p>
            <h1 className="mt-1 text-2xl font-black">Escribe el producto o lote</h1>
          </div>
          <button type="button" onClick={returnToShowcase} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black">Volver</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setSelectedTagId(''); }}
          placeholder="Merluza, lote, FAO, procedencia…"
          className="w-full rounded-2xl border border-orange-400/35 bg-white/[.06] px-5 py-4 text-lg font-bold outline-none focus:border-orange-400"
        />

        <p className="mt-3 text-sm font-semibold text-slate-500">Si no tocas la pantalla durante 30 segundos, vuelve sola al escaparate.</p>

        {selectedTag ? (
          <section className="mt-7">
            <button type="button" onClick={() => setSelectedTagId('')} className="mb-4 rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-slate-300">← Resultados</button>
            <TagCard tag={selectedTag} accentIndex={0} />
          </section>
        ) : (
          <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTags.map((tag) => {
              const trace = decodeTraceability(tag.category);
              return (
                <button key={tag.id} type="button" onClick={() => setSelectedTagId(tag.id)} className="rounded-2xl border border-white/10 bg-white/[.04] p-5 text-left active:scale-[.99]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-[.15em] text-orange-400">Ver etiqueta</span>
                    {tag.status === 'provisional' ? <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300">24 H</span> : null}
                  </div>
                  <h2 className="mt-2 text-2xl font-black uppercase">{trace?.description || tag.product_name}</h2>
                  <p className="mt-3 text-sm font-bold text-slate-400">Lote: <span className="text-white">{trace?.lot || '—'}</span></p>
                  <p className="mt-1 text-sm text-slate-500">{trace?.origin || tag.origin || 'Procedencia no indicada'}</p>
                </button>
              );
            })}
          </section>
        )}

        {!loading && filteredTags.length === 0 && !selectedTag ? (
          <div className="mt-10 rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">No encontramos ninguna etiqueta activa con esa búsqueda.</div>
        ) : null}
      </main>
    </div>
  );
}
