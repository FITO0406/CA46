'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PlanId = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
type CompanyStatus = 'active' | 'trial' | 'suspended' | 'cancelled';

type Company = {
  id: string;
  name: string;
  registeredName: string;
  slug: string;
  plan: PlanId;
  status: CompanyStatus;
  ownerEmail: string;
  city: string;
  province: string;
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

type PlanDefinition = {
  id: PlanId;
  name: string;
  priceLabel: string;
  monthlyPrice: number | null;
  note: string;
};

const PLANS: PlanDefinition[] = [
  { id: 'gratis', name: 'Gratis', priceLabel: '0 €', monthlyPrice: 0, note: 'Hasta 20 etiquetas/mes' },
  { id: 'autonomo', name: 'Autónomo', priceLabel: '19,99 €/mes', monthlyPrice: 19.99, note: '1 establecimiento · hasta 3 usuarios' },
  { id: 'empresa', name: 'Empresa', priceLabel: '35,99 €/mes', monthlyPrice: 35.99, note: 'Varios establecimientos y usuarios' },
  { id: 'personalizado', name: 'Personalizado', priceLabel: 'A medida', monthlyPrice: null, note: 'Configuración e integraciones especiales' },
];

const statusLabels: Record<CompanyStatus, string> = {
  active: 'Activa',
  trial: 'Prueba',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

export default function SuperAdminPlanesCobrosPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | PlanId>('all');

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
    void loadCompanies();
  }, []);

  const metrics = useMemo(() => {
    const byPlan: Record<PlanId, number> = { gratis: 0, autonomo: 0, empresa: 0, personalizado: 0 };
    let paidActive = 0;
    let referenceMrr = 0;

    for (const company of companies) {
      byPlan[company.plan] += 1;
      if (company.status !== 'active') continue;
      const plan = PLANS.find((item) => item.id === company.plan);
      if (plan?.monthlyPrice && plan.monthlyPrice > 0) {
        paidActive += 1;
        referenceMrr += plan.monthlyPrice;
      }
    }

    return {
      total: companies.length,
      paidActive,
      referenceMrr,
      byPlan,
    };
  }, [companies]);

  const visibleCompanies = useMemo(() => {
    if (planFilter === 'all') return companies;
    return companies.filter((company) => company.plan === planFilter);
  }, [companies, planFilter]);

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
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-amber-300">Paso 7 · Preparación comercial</span>
              <h2 className="mt-4 text-3xl font-black sm:text-4xl">Control de planes antes de conectar Stripe</h2>
              <p className="mt-3 leading-7 text-slate-400">Esta pantalla usa los planes que ya existen en CA46. Todavía no ejecuta cobros ni guarda tarjetas. Sirve para comprobar la estructura comercial y dejar claro qué falta antes de activar pagos reales.</p>
            </div>
            <button type="button" onClick={() => void loadCompanies()} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 disabled:opacity-50">{loading ? 'Actualizando…' : 'Actualizar'}</button>
          </div>
        </section>

        {error ? <section className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</section> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Empresas" value={metrics.total} detail="Con plan asignado" />
          <Metric label="Planes de pago activos" value={metrics.paidActive} detail="Autónomo + Empresa, estado Activa" />
          <Metric label="MRR de referencia" value={formatEuro(metrics.referenceMrr)} detail="Estimación comercial, no cobro real" />
          <Metric label="Stripe" value="Pendiente" detail="No hay cargos automáticos todavía" />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <div key={plan.id} className="rounded-[1.6rem] border border-white/10 bg-[#0d1215] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Plan</p>
                  <h3 className="mt-1 text-2xl font-black">{plan.name}</h3>
                </div>
                <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">{metrics.byPlan[plan.id]} empresas</span>
              </div>
              <p className="mt-5 text-2xl font-black text-orange-300">{plan.priceLabel}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{plan.note}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Preparación Stripe</p>
            <h2 className="mt-1 text-2xl font-black">Qué está listo</h2>
            <div className="mt-5 space-y-3">
              <ReadyRow done label="Cada empresa tiene un plan" detail="El plan ya está vinculado a la empresa multiempresa." />
              <ReadyRow done label="SuperAdmin puede cambiar el plan" detail="El cambio administrativo ya está probado." />
              <ReadyRow done label="Estados de acceso funcionando" detail="Activa, Prueba, Suspendida y Cancelada ya están validados." />
              <ReadyRow label="Cliente y suscripción Stripe" detail="Pendiente de crear customer/subscription por empresa." />
              <ReadyRow label="Checkout, webhooks y portal" detail="Pendiente de conectar el cobro real y sincronizar sus estados." />
            </div>
          </div>

          <div className="rounded-[2rem] border border-amber-400/15 bg-amber-400/[.05] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-amber-300">Importante</p>
            <h2 className="mt-1 text-2xl font-black">Todavía no se cobra a nadie</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">Los importes mostrados son la referencia comercial que ya aparece actualmente en el alta de CA46. El MRR es una estimación teórica basada en empresas activas; no representa dinero cobrado ni facturas emitidas.</p>
            <p className="mt-4 text-sm leading-7 text-slate-400">Antes de conectar Stripe podremos confirmar definitivamente precios, IVA, periodicidad y qué sucede con las pruebas, impagos y cancelaciones.</p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Empresas</p>
              <h2 className="mt-1 text-2xl font-black">Plan asignado</h2>
            </div>
            <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value as 'all' | PlanId)} className="rounded-xl border border-white/10 bg-[#11161a] px-4 py-3 font-bold text-white outline-none focus:border-orange-400">
              <option value="all">Todos los planes</option>
              {PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[.03]" /> : null}
            {!loading && visibleCompanies.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm font-bold text-slate-600">No hay empresas en este plan.</div> : null}
            {!loading && visibleCompanies.map((company) => {
              const plan = PLANS.find((item) => item.id === company.plan) || PLANS[0];
              return (
                <div key={company.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 lg:grid-cols-[1.4fr_.7fr_.7fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-black">{company.name}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-600">{company.ownerEmail || 'Sin email'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-600">Plan</p>
                    <p className="mt-1 font-black text-slate-300">{plan.name} · {plan.priceLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-600">Estado</p>
                    <StatusBadge status={company.status} />
                  </div>
                  <Link href={`/superadmin/empresas/${company.id}`} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-center text-sm font-black text-orange-300">Abrir ficha →</Link>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-5 py-4 text-sm font-bold text-emerald-200">
          Paso 7 activo: catálogo comercial, distribución por planes y estimación de referencia preparados. El cobro real sigue desactivado hasta el siguiente bloque de Stripe.
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return <div className="rounded-[1.5rem] border border-white/10 bg-white/[.035] p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-2 text-xs font-bold leading-5 text-slate-600">{detail}</p></div>;
}

function ReadyRow({ done = false, label, detail }: { done?: boolean; label: string; detail: string }) {
  return <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-black ${done ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>{done ? '✓' : '·'}</span><div><p className="font-black">{label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p></div></div>;
}

function StatusBadge({ status }: { status: CompanyStatus }) {
  const classes = status === 'active' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : status === 'trial' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : status === 'suspended' ? 'border-rose-400/20 bg-rose-500/10 text-rose-300' : 'border-white/10 bg-white/5 text-slate-500';
  return <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-black ${classes}`}>{statusLabels[status]}</span>;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}
