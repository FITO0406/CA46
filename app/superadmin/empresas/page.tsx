'use client';

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

type Summary = { total: number; active: number; trial: number; suspended: number };

type Payload = { ok: boolean; companies?: Company[]; summary?: Summary; error?: string };

const planLabels: Record<Company['plan'], string> = {
  gratis: 'Gratis',
  autonomo: 'Autónomo',
  empresa: 'Empresa',
  personalizado: 'Personalizado',
};

const statusLabels: Record<Company['status'], string> = {
  active: 'Activa',
  trial: 'Prueba',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

export default function SuperAdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, trial: 0, suspended: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadCompanies() {
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
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo cargar Empresas.');

      setCompanies(payload.companies || []);
      setSummary(payload.summary || { total: 0, active: 0, trial: 0, suspended: 0 });
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudo cargar Empresas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  const filteredCompanies = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return companies.filter((company) => {
      const statusMatch = status === 'all' || company.status === status;
      const searchMatch =
        !needle ||
        [company.name, company.registeredName, company.ownerEmail, company.city, company.province, company.slug]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return statusMatch && searchMatch;
    });
  }, [companies, search, status]);

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46 · SuperAdmin</p>
            <h1 className="mt-1 text-2xl font-black">Empresas</h1>
          </div>
          <Link href="/superadmin" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Panel</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Empresas" value={summary.total} />
          <StatCard label="Activas" value={summary.active} accent="text-emerald-300" />
          <StatCard label="En prueba" value={summary.trial} accent="text-amber-300" />
          <StatCard label="Suspendidas" value={summary.suspended} accent="text-rose-300" />
        </section>

        <section className="mt-6 grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[.035] p-4 md:grid-cols-[1fr_220px_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar empresa, email, ciudad…"
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-bold text-white outline-none focus:border-orange-400"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-white/10 bg-[#11161a] px-4 py-3 font-bold text-white outline-none focus:border-orange-400"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="trial">En prueba</option>
            <option value="suspended">Suspendidas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          <button type="button" onClick={() => void loadCompanies()} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-black text-slate-200">Actualizar</button>
        </section>

        {error ? (
          <section className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</section>
        ) : null}

        <section className="mt-6 space-y-4">
          {loading ? <LoadingRows /> : null}

          {!loading && !error && filteredCompanies.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[.03] p-10 text-center text-slate-500">No hay empresas que coincidan con la búsqueda.</div>
          ) : null}

          {!loading && filteredCompanies.map((company) => (
            <article key={company.id} className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 shadow-xl shadow-black/20 sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-black">{company.name}</h2>
                    <StatusBadge status={company.status} />
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{planLabels[company.plan]}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-500">{company.ownerEmail || 'Propietario sin email disponible'}</p>
                  <p className="mt-1 text-sm text-slate-600">{[company.city, company.province].filter(Boolean).join(' · ') || 'Ubicación no configurada'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
                  <MiniStat label="Usuarios" value={company.membersCount} />
                  <MiniStat label="Etiquetas activas" value={company.activeTagsCount} />
                  <MiniState label="Drive" on={company.driveConnected} />
                  <MiniState label="Pantalla" on={company.publicScreenEnabled} />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 text-xs font-bold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>Alta: {formatDate(company.createdAt)}</span>
                <span className="truncate">ID: {company.id}</span>
                <span className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-slate-500">Ficha de empresa → siguiente paso</span>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-5 py-4 text-sm font-bold text-emerald-200">
          Paso 3: listado global de empresas conectado a la base multiempresa. Solo lectura por ahora; todavía no cambiamos planes ni estados desde SuperAdmin.
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent = 'text-white' }: { label: string; value: number; accent?: string }) {
  return <div className="rounded-[1.5rem] border border-white/10 bg-white/[.035] p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">{label}</p><p className={`mt-2 text-4xl font-black ${accent}`}>{value}</p></div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}

function MiniState({ label, on }: { label: string; on: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className={`mt-1 text-sm font-black ${on ? 'text-emerald-300' : 'text-slate-600'}`}>{on ? 'Conectado' : 'No'}</p></div>;
}

function StatusBadge({ status }: { status: Company['status'] }) {
  const classes = status === 'active' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : status === 'trial' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : status === 'suspended' ? 'border-rose-400/20 bg-rose-500/10 text-rose-300' : 'border-white/10 bg-white/5 text-slate-500';
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes}`}>{statusLabels[status]}</span>;
}

function LoadingRows() {
  return <>{[0, 1].map((item) => <div key={item} className="h-40 animate-pulse rounded-[2rem] border border-white/10 bg-white/[.03]" />)}</>;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}
