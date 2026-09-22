'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Incident = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  type: string;
  title: string;
  detail: string;
  companyId?: string;
  companyName?: string;
  href: string;
};
type Payload = { ok: boolean; incidents?: Incident[]; counts?: { total: number; high: number; medium: number; low: number }; error?: string };

export default function SuperAdminIncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [counts, setCounts] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('La sesión SuperAdmin no está disponible.');
      const response = await fetch('/api/superadmin/incidents', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudieron cargar las incidencias.');
      setItems(payload.incidents || []);
      setCounts(payload.counts || { total: 0, high: 0, medium: 0, low: 0 });
    } catch (e: any) { setError(e?.message || 'No se pudieron cargar las incidencias.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46 · SuperAdmin</p><h1 className="mt-1 text-2xl font-black">Incidencias</h1></div>
          <Link href="/superadmin" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Panel</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="rounded-[2rem] border border-orange-400/20 bg-orange-500/[.06] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Paso 8.2 · Incidencias básicas</p><h2 className="mt-2 text-3xl font-black">Solo problemas que requieren atención</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">CA46 revisa accesos, cobros, pantallas, facturas y configuración esencial. No es un sistema de tickets: es una lista corta para saber qué debes revisar.</p></div>
            <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-300 disabled:opacity-50">{loading ? 'Revisando…' : 'Revisar ahora'}</button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4"><Stat label="Total" value={counts.total} /><Stat label="Importantes" value={counts.high} tone="high" /><Stat label="Revisar" value={counts.medium} tone="medium" /><Stat label="Avisos" value={counts.low} tone="low" /></div>
        </section>

        {error ? <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div> : null}
        {loading ? <div className="mt-6 h-40 animate-pulse rounded-[2rem] border border-white/10 bg-white/[.03]" /> : null}

        {!loading && !error ? <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Estado actual</p><h2 className="mt-1 text-2xl font-black">Pendientes de revisar</h2></div>{items.length === 0 ? <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">✓ Todo correcto</span> : null}</div>
          <div className="mt-5 space-y-3">
            {items.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-400/20 bg-emerald-400/[.04] px-5 py-10 text-center"><p className="text-lg font-black text-emerald-300">No hay incidencias activas.</p><p className="mt-2 text-sm font-bold text-slate-500">Los controles básicos de CA46 están correctos.</p></div> : items.map((item) => <div key={item.id} className={`rounded-2xl border p-4 ${incidentClass(item.severity)}`}><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-current/20 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em]">{severityLabel(item.severity)}</span><p className="font-black">{item.title}</p></div>{item.companyName ? <p className="mt-2 text-sm font-black text-slate-300">{item.companyName}</p> : null}<p className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</p></div><Link href={item.href} className="shrink-0 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-white">Revisar →</Link></div></div>)}
          </div>
        </section> : null}
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'high' | 'medium' | 'low' }) { const cls = tone === 'high' ? 'border-rose-400/20 bg-rose-500/[.06] text-rose-300' : tone === 'medium' ? 'border-amber-400/20 bg-amber-400/[.06] text-amber-300' : tone === 'low' ? 'border-sky-400/20 bg-sky-400/[.06] text-sky-300' : 'border-white/10 bg-black/20 text-white'; return <div className={`rounded-xl border px-4 py-4 ${cls}`}><p className="text-[10px] font-black uppercase tracking-[.14em] opacity-70">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>; }
function severityLabel(value: Incident['severity']) { return value === 'high' ? 'Importante' : value === 'medium' ? 'Revisar' : 'Aviso'; }
function incidentClass(value: Incident['severity']) { return value === 'high' ? 'border-rose-400/20 bg-rose-500/[.05] text-rose-300' : value === 'medium' ? 'border-amber-400/20 bg-amber-400/[.05] text-amber-300' : 'border-sky-400/20 bg-sky-400/[.04] text-sky-300'; }
