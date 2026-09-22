'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Company = {
  id: string;
  name: string;
  registeredName: string;
  slug: string;
  plan: 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  ownerEmail: string;
  city: string;
  province: string;
  driveConnected: boolean;
  publicScreenEnabled: boolean;
  membersCount: number;
  activeTagsCount: number;
  createdAt: string;
  updatedAt: string;
};

type CompaniesPayload = {
  ok: boolean;
  companies?: Company[];
  error?: string;
};

const planLabels: Record<Company['plan'], string> = {
  gratis: 'Gratis',
  autonomo: 'Autónomo',
  empresa: 'Empresa',
  personalizado: 'Personalizado',
};

export default function SuperAdminPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError('La sesión SuperAdmin no está disponible.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/superadmin/companies', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as CompaniesPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo cargar el cuadro de mando.');
      setCompanies(payload.companies || []);
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudo cargar el cuadro de mando.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const metrics = useMemo(() => {
    const plans: Record<Company['plan'], number> = { gratis: 0, autonomo: 0, empresa: 0, personalizado: 0 };
    let users = 0;
    let activeTags = 0;
    let drive = 0;
    let screens = 0;
    let active = 0;
    let trial = 0;
    let suspended = 0;
    let cancelled = 0;

    for (const company of companies) {
      plans[company.plan] += 1;
      users += company.membersCount;
      activeTags += company.activeTagsCount;
      if (company.driveConnected) drive += 1;
      if (company.publicScreenEnabled) screens += 1;
      if (company.status === 'active') active += 1;
      if (company.status === 'trial') trial += 1;
      if (company.status === 'suspended') suspended += 1;
      if (company.status === 'cancelled') cancelled += 1;
    }

    return { total: companies.length, active, trial, suspended, cancelled, users, activeTags, drive, screens, plans };
  }, [companies]);

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/92 px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-orange-400/20 bg-black">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-xl font-black">CA46</p>
              <p className="text-xs font-semibold text-slate-500">SuperAdmin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300 disabled:opacity-50"
          >
            {loading ? 'Actualizando…' : 'Actualizar panel'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="max-w-4xl">
          <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.2em] text-emerald-300">Núcleo seguro activo</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">Administración global de CA46</h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-400">Vista general de todas las empresas de CA46. Los datos se leen desde la base multiempresa y esta zona continúa separada de los administradores de cada negocio.</p>
        </section>

        {error ? (
          <section className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</section>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Empresas" value={metrics.total} detail={`${metrics.active} activas`} />
          <MetricCard label="Usuarios" value={metrics.users} detail="Usuarios activos vinculados" />
          <MetricCard label="Etiquetas activas" value={metrics.activeTags} detail="En todas las empresas" />
          <MetricCard label="Drive conectado" value={`${metrics.drive}/${metrics.total}`} detail="Empresas con Drive" />
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatusMetric label="Activas" value={metrics.active} tone="green" />
          <StatusMetric label="En prueba" value={metrics.trial} tone="amber" />
          <StatusMetric label="Suspendidas" value={metrics.suspended} tone="rose" />
          <StatusMetric label="Canceladas" value={metrics.cancelled} tone="slate" />
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Distribución</p>
                <h2 className="mt-1 text-2xl font-black">Planes</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-400">{metrics.total} empresas</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(Object.keys(planLabels) as Company['plan'][]).map((plan) => (
                <div key={plan} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{planLabels[plan]}</p>
                  <p className="mt-2 text-3xl font-black">{metrics.plans[plan]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Servicios conectados</p>
            <h2 className="mt-1 text-2xl font-black">Operativa</h2>
            <div className="mt-5 space-y-3">
              <ConnectionRow label="Google Drive" connected={metrics.drive} total={metrics.total} />
              <ConnectionRow label="Pantalla de etiquetas" connected={metrics.screens} total={metrics.total} />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Últimas altas</p>
              <h2 className="mt-1 text-2xl font-black">Empresas recientes</h2>
            </div>
            <Link href="/superadmin/empresas" className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black">Ver todas →</Link>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[.03]" /> : null}
            {!loading && companies.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm font-bold text-slate-600">Todavía no hay empresas.</p> : null}
            {!loading && companies.slice(0, 5).map((company) => (
              <div key={company.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-black">{company.name}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black text-slate-400">{planLabels[company.plan]}</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-slate-600">{company.ownerEmail || 'Sin email'} · {formatDate(company.createdAt)}</p>
                </div>
                <Link href={`/superadmin/empresas/${company.id}`} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300">Abrir ficha →</Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <Link href="/superadmin/empresas" className="rounded-[2rem] border border-orange-400/30 bg-orange-500/[.08] p-7 transition hover:border-orange-300/50 hover:bg-orange-500/[.11] active:scale-[.99]">
            <div className="text-4xl">🏢</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-orange-400">Activo</p>
            <h2 className="mt-2 text-2xl font-black">Empresas</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Listado global, ficha individual, cambio de plan y control de acceso.</p>
            <span className="mt-6 inline-flex rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black">Abrir Empresas →</span>
          </Link>

          <Link href="/superadmin/planes" className="rounded-[2rem] border border-amber-400/25 bg-amber-400/[.06] p-7 transition hover:border-amber-300/45 hover:bg-amber-400/[.09] active:scale-[.99]">
            <div className="text-4xl">💳</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-amber-300">Activo</p>
            <h2 className="mt-2 text-2xl font-black">Planes y cobros</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Suscripciones, situación de cobro y motor Stripe preparado para producción.</p>
            <span className="mt-6 inline-flex rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-black text-amber-200">Abrir Planes →</span>
          </Link>

          <Link href="/superadmin/sistema" className="rounded-[2rem] border border-sky-400/20 bg-sky-400/[.05] p-7 transition hover:border-sky-300/40 hover:bg-sky-400/[.08] active:scale-[.99]">
            <div className="text-4xl">🛠️</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-sky-300">Activo</p>
            <h2 className="mt-2 text-2xl font-black">Sistema</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Estado de servicios, contadores globales y diagnóstico seguro de CA46.</p>
            <span className="mt-6 inline-flex rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-200">Abrir Sistema →</span>
          </Link>
        </section>

        <section className="mt-8 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-5 py-4 text-sm font-bold text-emerald-200">
          Paso 8.1 activo: Empresas, Planes y cobros y Sistema ya están conectados desde el SuperAdmin. Sistema funciona en modo diagnóstico de solo lectura.
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[.035] p-5">
      <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
      <p className="mt-2 text-xs font-bold text-slate-600">{detail}</p>
    </div>
  );
}

function StatusMetric({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' | 'rose' | 'slate' }) {
  const classes = tone === 'green'
    ? 'border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300'
    : tone === 'amber'
      ? 'border-amber-400/15 bg-amber-400/[.06] text-amber-300'
      : tone === 'rose'
        ? 'border-rose-400/15 bg-rose-500/[.06] text-rose-300'
        : 'border-white/10 bg-white/[.035] text-slate-400';

  return (
    <div className={`rounded-[1.5rem] border p-5 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-[.16em] opacity-75">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function ConnectionRow({ label, connected, total }: { label: string; connected: number; total: number }) {
  const percent = total > 0 ? Math.round((connected / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-black">{label}</p>
        <p className="text-sm font-black text-emerald-300">{connected}/{total}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs font-bold text-slate-600">{percent}% conectado</p>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}
