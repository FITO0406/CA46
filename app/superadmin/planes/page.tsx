'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PlanId = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
type StatusId = 'active' | 'trial' | 'suspended' | 'cancelled';

type Company = {
  id: string;
  name: string;
  plan: PlanId;
  status: StatusId;
  ownerEmail: string;
  createdAt: string;
};

type CompaniesPayload = {
  ok: boolean;
  companies?: Company[];
  error?: string;
};

const plans: Record<PlanId, { name: string; price: string; note: string }> = {
  gratis: { name: 'Gratis', price: '0 €', note: 'Hasta 20 etiquetas/mes' },
  autonomo: { name: 'Autónomo', price: '19,99 €/mes', note: '1 establecimiento · hasta 3 usuarios' },
  empresa: { name: 'Empresa', price: '35,99 €/mes', note: 'Varios establecimientos y usuarios' },
  personalizado: { name: 'Personalizado', price: 'A medida', note: 'Configuración e integraciones especiales' },
};

const statusLabels: Record<StatusId, string> = {
  active: 'Activa',
  trial: 'Prueba',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

export default function SuperAdminPlansPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadPlans() {
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
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudieron cargar los planes.');
      setCompanies(payload.companies || []);
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudieron cargar los planes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  const metrics = useMemo(() => {
    const byPlan: Record<PlanId, number> = { gratis: 0, autonomo: 0, empresa: 0, personalizado: 0 };
    let commercial = 0;

    for (const company of companies) {
      byPlan[company.plan] += 1;
      if (company.plan !== 'gratis') commercial += 1;
    }

    return { total: companies.length, commercial, byPlan };
  }, [companies]);

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46 · SuperAdmin</p>
            <h1 className="mt-1 text-2xl font-black">Planes y cobros</h1>
          </div>
          <Link href="/superadmin" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Panel</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="rounded-[2rem] border border-orange-400/20 bg-gradient-to-br from-orange-500/[.10] via-white/[.035] to-white/[.02] p-6 sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Paso 7.1</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">Control comercial de CA46</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Vista global de los planes asignados a cada empresa. En este paso no se realiza ningún cobro ni se guarda información de tarjetas.</p>
            </div>
            <button type="button" onClick={() => void loadPlans()} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 disabled:opacity-50">
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Empresas" value={metrics.total} />
            <Stat label="Planes comerciales" value={metrics.commercial} />
            <Stat label="Cobro automático" value="No conectado" compact />
          </div>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div> : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(plans) as PlanId[]).map((planId) => {
            const plan = plans[planId];
            return (
              <div key={planId} className="rounded-[1.6rem] border border-white/10 bg-[#0d1215] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">{plan.name}</p>
                    <p className="mt-2 text-2xl font-black text-orange-300">{plan.price}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-slate-300">{metrics.byPlan[planId]}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400">{plan.note}</p>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[.12em] text-slate-600">Precio mostrado actualmente en el alta</p>
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Empresas</p>
              <h2 className="mt-1 text-2xl font-black">Situación comercial</h2>
            </div>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300">Stripe pendiente</span>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[.03]" /> : null}
            {!loading && companies.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm font-bold text-slate-600">Todavía no hay empresas.</div> : null}
            {!loading && companies.map((company) => (
              <div key={company.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 md:grid-cols-[1.5fr_.7fr_.7fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-black">{company.name}</p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-600">{company.ownerEmail || 'Sin email'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-600">Plan</p>
                  <p className="mt-1 text-sm font-black text-slate-300">{plans[company.plan].name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-600">Estado</p>
                  <p className="mt-1 text-sm font-black text-slate-300">{statusLabels[company.status]}</p>
                </div>
                <Link href={`/superadmin/empresas/${company.id}`} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-center text-sm font-black text-orange-300">Abrir ficha →</Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-5 py-4 text-sm font-bold leading-6 text-emerald-200">
          Paso 7.1 activo: Planes y cobros ya está conectado a las empresas reales. Todavía no hay cargos automáticos. El siguiente bloque será preparar el modelo de suscripción y estados de cobro antes de conectar Stripe.
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: number | string; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p>
      <p className={`mt-1 font-black ${compact ? 'text-xl' : 'text-3xl'}`}>{value}</p>
    </div>
  );
}
