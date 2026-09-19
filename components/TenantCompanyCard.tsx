'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Tenant = {
  company: {
    id: string;
    name: string;
    slug: string;
    plan: 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
    status: string;
    created_at?: string;
    updated_at?: string;
  };
  membership: {
    role: string;
    isActive: boolean;
  };
};

const PLAN_LABELS: Record<Tenant['company']['plan'], string> = {
  gratis: 'Gratis',
  autonomo: 'Autónomo',
  empresa: 'Empresa',
  personalizado: 'Personalizado',
};

export default function TenantCompanyCard({ companyName }: { companyName: string }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const requestTenant = useCallback(async (method: 'GET' | 'POST' = 'GET') => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      return null;
    }

    const plan = typeof window !== 'undefined' ? window.localStorage.getItem('ca46:selected-plan') || 'gratis' : 'gratis';
    const response = await fetch('/api/tenant/me', {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify({ companyName, plan }) } : {}),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || 'No se pudo consultar la empresa.');
    }

    const nextTenant = (payload?.tenant || null) as Tenant | null;
    setTenant(nextTenant);
    return nextTenant;
  }, [companyName]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    requestTenant('GET')
      .catch((requestError: Error) => {
        if (active) setError(requestError.message || 'No se pudo consultar la empresa.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [requestTenant]);

  async function createCompany() {
    if (!companyName.trim()) {
      setError('Guarda primero el nombre comercial de la empresa.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      await requestTenant('POST');
    } catch (requestError: any) {
      setError(requestError?.message || 'No se pudo crear la empresa.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <section className="mb-6 rounded-[2rem] border border-white/10 bg-white/[.035] p-6">
        <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Cuenta de empresa</p>
        <p className="mt-3 text-sm font-bold text-slate-500">Comprobando empresa y plan…</p>
      </section>
    );
  }

  if (!tenant) {
    return (
      <section className="mb-6 rounded-[2rem] border border-amber-400/20 bg-amber-400/[.05] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Cuenta de empresa</p>
            <h2 className="mt-2 text-2xl font-black">Activa tu empresa independiente</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Esta cuenta todavía no está vinculada a un empresa_id. Al activarla, CA46 creará la empresa y te asignará como administrador.</p>
          </div>
          <button type="button" onClick={createCompany} disabled={creating || !companyName.trim()} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">
            {creating ? 'Creando empresa…' : 'Activar empresa CA46'}
          </button>
        </div>
        {error ? <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/[.07] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[.045] p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Empresa multiempresa activa</p>
          <h2 className="mt-2 text-2xl font-black">{tenant.company.name}</h2>
          <p className="mt-2 text-sm text-slate-500">Cada dato que migremos a la nueva arquitectura quedará asociado a este empresa_id.</p>
        </div>
        <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300">Plan {PLAN_LABELS[tenant.company.plan]}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Empresa ID" value={tenant.company.id} mono />
        <Info label="Rol" value={tenant.membership.role === 'admin_empresa' ? 'Administrador' : tenant.membership.role} />
        <Info label="Estado" value={tenant.company.status === 'active' ? 'Activa' : tenant.company.status} />
        <Info label="Identificador" value={tenant.company.slug} mono />
      </div>
      {error ? <p className="mt-4 text-sm font-bold text-rose-300">{error}</p> : null}
    </section>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] font-black uppercase tracking-[.17em] text-slate-600">{label}</p>
      <p className={`mt-2 break-all text-sm font-black text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
