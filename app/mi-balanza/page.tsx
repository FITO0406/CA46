'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type InventoryTag = {
  id: string; name: string; type: string; source: string;
  lot: string; createdAt: string; expiresAt: string;
  state: string; parentTagId: string | null;
};

export default function MiBalanzaPage() {
  const [items, setItems] = useState<InventoryTag[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Inicia sesión para consultar las etiquetas de tu empresa.');
      const response = await fetch('/api/mi-balanza', {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar la información.');
      setItems(payload.tags || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => items.filter(tag =>
    (filter === 'todas' || (filter === 'cocina' ? tag.source === 'kitchen' :
      filter === 'activas' ? tag.state === 'Sin sincronizar' : tag.state !== 'Sin sincronizar')) &&
    (tag.name + ' ' + tag.lot).toLowerCase().includes(query.toLowerCase())
  ), [items, filter, query]);
  const totalActive = items.filter(tag => tag.state === 'Sin sincronizar').length;
  const kitchen = items.filter(tag => tag.source === 'kitchen').length;
  return (
    <main className="min-h-screen bg-[#10151b] text-white">
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-9 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.25em] text-orange-400">CA46 / Integraciones</p>
            <h1 className="mt-2 text-4xl font-black">Mi balanza</h1>
            <p className="mt-2 text-sm text-slate-400">Panel de preparación de artículos para Marqués BM5 ARM / ETPOS</p>
          </div>
          <Link href="/" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10">Pantalla de inicio</Link>
        </div>
        <section className="rounded-3xl border border-amber-400/25 bg-amber-400/10 p-5" aria-live="polite">
          <div className="font-black text-amber-200">Conexión ETPOS pendiente de validación</div>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            Esta pantalla consulta etiquetas de CA46, pero todavía no transmite artículos ni configura la balanza.
            No se ha establecido una conexión con ETPOS. No se modificarán los tickets, la fiscalidad ni las bases de datos del equipo.
          </p>
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Etiquetas consultadas', items.length],
            ['Activas y no vencidas', totalActive],
            ['Etiquetas hijas de Cocina', kitchen],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-black">{value}</p>
            </div>
          ))}
        </div>
        <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-xl font-black">Artículos candidatos a sincronización</h2>
              <p className="mt-1 text-sm text-slate-400">Vista informativa, sin escritura en ETPOS</p></div>
            <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-black disabled:opacity-50">
              {loading ? 'Actualizando…' : 'Actualizar lista'}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <input aria-label="Buscar producto o lote" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar producto o lote" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#161c24] px-4 py-3 outline-none focus:border-orange-500"/>
            <select aria-label="Filtrar etiquetas" value={filter} onChange={e => setFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#161c24] px-4 py-3">
              <option value="todas">Todas</option><option value="activas">Activas</option>
              <option value="cocina">Hijas de Cocina</option><option value="inactivas">Inactivas o vencidas</option>
            </select>
          </div>
          {error ? <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{error}</p> : null}
          <div className="space-y-2">
            {visible.map(tag => <div key={tag.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="min-w-0"><p className="font-bold">{tag.name}</p>
                <p className="mt-1 text-xs text-slate-400">{tag.type} · Lote: {tag.lot || 'Sin dato de lote'}{tag.parentTagId ? ' · Con etiqueta padre' : ''}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${tag.state === 'Sin sincronizar' ?
                'bg-orange-400/10 text-orange-200' : 'bg-slate-500/20 text-slate-300'}`}>{tag.state}</span>
            </div>)}
            {!loading && !error && !visible.length ? <p className="py-10 text-center text-slate-400">No hay etiquetas que coincidan.</p> : null}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 p-5">
          <h2 className="text-lg font-black">Próximas conexiones</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">En preparación: mapeo de familias y códigos PLU, cola de envíos,
            recuperación de etiquetas, confirmaciones por dispositivo y puente local seguro. Estos controles solo se habilitarán
            cuando ETPOS confirme una interfaz admitida y las pruebas con la BM5 ARM sean satisfactorias.</p>
        </section>
      </div>
    </main>
  );
}
