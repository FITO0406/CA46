'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BANKS, DEFAULT_COMPANY_CONFIG, type CompanyConfig } from '@/lib/company-config';
import { loadTenantCompanyConfig } from '@/lib/tenant-company-config';

export default function BancosPage() {
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const settings = await loadTenantCompanyConfig();
        if (!active) return;
        setConfig(settings ? { ...DEFAULT_COMPANY_CONFIG, ...settings } : DEFAULT_COMPANY_CONFIG);
        setError('');
      } catch (requestError: any) {
        if (!active) return;
        setConfig(DEFAULT_COMPANY_CONFIG);
        setError(requestError?.message || 'No se pudieron cargar los bancos de tu empresa.');
      }
    };

    void refresh();
    const onUpdated = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('ca46-tenant-settings-updated', onUpdated as EventListener);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.removeEventListener('ca46-tenant-settings-updated', onUpdated as EventListener);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const selectedBanks = useMemo(() => {
    if (!config) return [];
    return BANKS.filter((bank) => config.selectedBankIds.includes(bank.id));
  }, [config]);

  return (
    <div className="min-h-screen bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(249,115,22,.16),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(148,163,184,.08),transparent_24%)]" />
      <header className="relative border-b border-white/10 bg-[#0c1013]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-orange-400/20 bg-black"><Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" /></div>
            <div><p className="text-xl font-black">CA46</p><p className="text-xs font-semibold text-slate-500">Mis bancos</p></div>
          </Link>
          <div className="flex gap-2"><Link href="/mi-empresa" className="rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300">Configurar</Link><Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Inicio</Link></div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Acceso rápido</p>
          <h1 className="mt-2 text-4xl font-black sm:text-6xl">Mis bancos</h1>
          <p className="mt-4 text-slate-400">Aquí aparecen únicamente los bancos seleccionados en Mi empresa. La selección se carga desde tu empresa en CA46, no desde este dispositivo.</p>
        </section>

        {error ? <p className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 text-sm font-bold text-rose-200">{error}</p> : null}

        {!config ? (
          <div className="mt-8 h-40 animate-pulse rounded-[2rem] bg-white/5" />
        ) : selectedBanks.length === 0 ? (
          <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[.03] p-8 text-center sm:p-12">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-orange-500/10 text-3xl">🏦</div>
            <h2 className="mt-5 text-2xl font-black">Todavía no has seleccionado ningún banco</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">Entra en Mi empresa, marca los bancos que utilizas y pulsa Guardar. La selección quedará asociada a tu empresa.</p>
            <Link href="/mi-empresa" className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 font-black text-[#111416]">Seleccionar bancos</Link>
          </section>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
              <div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">{config.businessName || 'Mi empresa'}</p><h2 className="mt-1 text-2xl font-black">{selectedBanks.length} {selectedBanks.length === 1 ? 'entidad configurada' : 'entidades configuradas'}</h2></div>
              <Link href="/mi-empresa" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">Cambiar selección</Link>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {selectedBanks.map((bank) => (
                <article key={bank.id} className="rounded-[2rem] border border-white/10 bg-white/[.04] p-6 shadow-xl shadow-black/20">
                  <div className="flex items-start justify-between gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-2xl">🏦</div><span className="rounded-full border border-emerald-400/15 bg-emerald-400/[.07] px-3 py-1 text-xs font-black text-emerald-300">Seleccionado</span></div>
                  <h3 className="mt-7 text-3xl font-black">{bank.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">Acceso externo a la web oficial. La autenticación y cualquier operación se realizan directamente en el banco.</p>
                  <a href={bank.url} target="_blank" rel="noreferrer" className="mt-6 flex items-center justify-between rounded-2xl bg-orange-500 px-5 py-4 font-black text-[#111416]"><span>Acceder a {bank.name}</span><span>↗</span></a>
                </article>
              ))}
            </div>
          </>
        )}

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[.03] p-5 text-sm leading-6 text-slate-500">
          <strong className="text-slate-300">Seguridad:</strong> CA46 no solicita ni guarda usuario, contraseña, firma, PIN, IBAN o datos de acceso bancario. Los enlaces llevan al dominio oficial de cada entidad.
        </section>
      </main>
    </div>
  );
}
