'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Counter = { ok: boolean; count: number };
type SystemPayload = {
  ok: boolean;
  error?: string;
  checkedAt?: string;
  environment?: string;
  services?: {
    database: { healthy: boolean };
    auth: { healthy: boolean };
    stripe: {
      ready: boolean;
      secretKeyConfigured: boolean;
      webhookConfigured: boolean;
      autonomoPriceConfigured: boolean;
      empresaPriceConfigured: boolean;
    };
  };
  counters?: {
    companies: Counter;
    activeMembers: Counter;
    activeTags: Counter;
    subscriptions: Counter;
    webhookEvents: Counter;
    driveConnected: Counter;
    screensEnabled: Counter;
  };
  recentWebhooks?: Array<{ id: string; type: string; processedAt: string }>;
};

export default function SuperAdminSystemPage() {
  const [data, setData] = useState<SystemPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadSystem() {
    setLoading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('La sesión SuperAdmin no está disponible.');

      const response = await fetch('/api/superadmin/system', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as SystemPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo consultar el sistema.');
      setData(payload);
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudo consultar el sistema.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSystem();
  }, []);

  const stripe = data?.services?.stripe;
  const counters = data?.counters;

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46 · SuperAdmin</p>
            <h1 className="mt-1 text-2xl font-black">Sistema</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadSystem()} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300 disabled:opacity-50">{loading ? 'Comprobando…' : 'Actualizar'}</button>
            <Link href="/superadmin" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Panel</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="rounded-[2rem] border border-orange-400/20 bg-gradient-to-br from-orange-500/[.10] via-white/[.035] to-white/[.02] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Paso 8.1</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">Estado global de CA46</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Panel de diagnóstico de solo lectura. Comprueba servicios y contadores globales sin mostrar claves ni mezclar datos privados entre empresas.</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-black">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-slate-400">Entorno: {data?.environment || '—'}</span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-slate-400">Última comprobación: {formatDateTime(data?.checkedAt)}</span>
          </div>
        </section>

        {error ? <section className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</section> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceCard label="Base de datos" ok={Boolean(data?.services?.database.healthy)} detail="Supabase · tablas principales" />
          <ServiceCard label="Autenticación" ok={Boolean(data?.services?.auth.healthy)} detail="Validación SuperAdmin" />
          <ServiceCard label="Stripe" ok={Boolean(stripe?.ready)} detail={stripe?.ready ? 'Checkout y webhook configurados' : 'Motor instalado · configuración pendiente'} warning={!stripe?.ready} />
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Base multiempresa</p>
              <h2 className="mt-1 text-2xl font-black">Contadores del sistema</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-500">Solo lectura</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CounterCard label="Empresas" counter={counters?.companies} />
            <CounterCard label="Usuarios activos" counter={counters?.activeMembers} />
            <CounterCard label="Etiquetas activas" counter={counters?.activeTags} />
            <CounterCard label="Suscripciones" counter={counters?.subscriptions} />
            <CounterCard label="Drive conectado" counter={counters?.driveConnected} />
            <CounterCard label="Pantallas activas" counter={counters?.screensEnabled} />
            <CounterCard label="Eventos Stripe" counter={counters?.webhookEvents} />
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Stripe</p>
            <h2 className="mt-1 text-2xl font-black">Configuración técnica</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Check label="Clave secreta" ok={Boolean(stripe?.secretKeyConfigured)} />
              <Check label="Webhook secret" ok={Boolean(stripe?.webhookConfigured)} />
              <Check label="Precio Autónomo" ok={Boolean(stripe?.autonomoPriceConfigured)} />
              <Check label="Precio Empresa" ok={Boolean(stripe?.empresaPriceConfigured)} />
            </div>
            <Link href="/superadmin/planes" className="mt-5 inline-flex rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300">Abrir Planes y cobros →</Link>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Stripe webhook</p>
            <h2 className="mt-1 text-2xl font-black">Últimos eventos procesados</h2>
            <div className="mt-5 space-y-3">
              {loading ? <div className="h-24 animate-pulse rounded-2xl bg-white/[.03]" /> : null}
              {!loading && (data?.recentWebhooks || []).length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm font-bold text-slate-600">Todavía no hay eventos Stripe procesados.</div> : null}
              {(data?.recentWebhooks || []).map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="truncate text-sm font-black text-slate-300">{event.type}</p>
                  <p className="mt-1 text-xs font-bold text-slate-600">{formatDateTime(event.processedAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-5 py-4 text-sm font-bold leading-6 text-emerald-200">Paso 8.1 activo: SuperAdmin ya dispone de diagnóstico global de CA46. Este módulo es de solo lectura y no puede modificar empresas ni credenciales.</section>
      </main>
    </div>
  );
}

function ServiceCard({ label, ok, detail, warning = false }: { label: string; ok: boolean; detail: string; warning?: boolean }) {
  const classes = ok ? 'border-emerald-400/20 bg-emerald-400/[.05]' : warning ? 'border-amber-400/20 bg-amber-400/[.05]' : 'border-rose-400/20 bg-rose-500/[.05]';
  const text = ok ? 'Operativo' : warning ? 'Pendiente' : 'Revisar';
  return <div className={`rounded-[1.5rem] border p-5 ${classes}`}><p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black ${ok ? 'text-emerald-300' : warning ? 'text-amber-300' : 'text-rose-300'}`}>{text}</p><p className="mt-2 text-xs font-bold text-slate-600">{detail}</p></div>;
}

function CounterCard({ label, counter }: { label: string; counter?: Counter }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-2 text-3xl font-black">{counter?.ok ? counter.count : '—'}</p><p className={`mt-1 text-xs font-bold ${counter?.ok ? 'text-emerald-400' : 'text-rose-300'}`}>{counter?.ok ? 'Disponible' : 'No disponible'}</p></div>;
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`rounded-xl border px-4 py-4 ${ok ? 'border-emerald-400/15 bg-emerald-400/[.05]' : 'border-white/10 bg-black/20'}`}><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className={`mt-1 font-black ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{ok ? '✓ Configurado' : 'Pendiente'}</p></div>;
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
