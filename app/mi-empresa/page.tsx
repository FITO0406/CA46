'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import TenantCompanyCard from '@/components/TenantCompanyCard';
import { BANKS, COMPANY_STORAGE_KEY, DEFAULT_COMPANY_CONFIG, loadCompanyConfig, type CompanyConfig } from '@/lib/company-config';
import { loadTenantCompanyConfig, saveTenantCompanyConfig, tenantAuthorizationHeader } from '@/lib/tenant-company-config';

const inputClass = 'w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-orange-400';

function hasLegacyData(config: CompanyConfig) {
  return Boolean(
    config.businessName.trim() ||
    config.legalName.trim() ||
    config.taxId.trim() ||
    config.contactFirstName.trim() ||
    config.contactLastName.trim() ||
    config.selectedBankIds.length ||
    config.driveConnected,
  );
}

export default function MiEmpresaPage() {
  const [config, setConfig] = useState<CompanyConfig>(DEFAULT_COMPANY_CONFIG);
  const [legacyDraft, setLegacyDraft] = useState<CompanyConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [tenantRefreshKey, setTenantRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const legacy = loadCompanyConfig();
    if (hasLegacyData(legacy)) setLegacyDraft(legacy);

    loadTenantCompanyConfig()
      .then((settings) => {
        if (!active) return;
        if (settings) {
          setConfig({ ...DEFAULT_COMPANY_CONFIG, ...settings });
          setLegacyDraft(null);
        } else {
          setConfig(DEFAULT_COMPANY_CONFIG);
        }
      })
      .catch((error: Error) => {
        if (active) setSaveError(error.message || 'No se pudo cargar Mi empresa.');
      })
      .finally(() => {
        if (active) setLoadingConfig(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedBanks = useMemo(() => BANKS.filter((bank) => config.selectedBankIds.includes(bank.id)), [config.selectedBankIds]);
  const configured = Boolean(config.businessName.trim() && config.contactFirstName.trim() && config.contactLastName.trim());

  function patch<K extends keyof CompanyConfig>(key: K, value: CompanyConfig[K]) {
    setSaved(false);
    setSaveError('');
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function toggleBank(id: string) {
    const next = config.selectedBankIds.includes(id)
      ? config.selectedBankIds.filter((bankId) => bankId !== id)
      : [...config.selectedBankIds, id];
    patch('selectedBankIds', next);
  }

  function recoverLegacyData() {
    if (!legacyDraft) return;
    setConfig({ ...DEFAULT_COMPANY_CONFIG, ...legacyDraft });
    setLegacyDraft(null);
    setSaved(false);
    setSaveError('Datos locales recuperados. Revisa la información y pulsa “Guardar Mi empresa” para pasarla a tu empresa en CA46.');
  }

  async function handleSave() {
    if (saving) return;
    if (!config.businessName.trim()) {
      setSaveError('Escribe el nombre comercial antes de guardar.');
      return;
    }

    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      const stored = await saveTenantCompanyConfig(config);
      setConfig({ ...DEFAULT_COMPANY_CONFIG, ...stored });
      window.localStorage.removeItem(COMPANY_STORAGE_KEY);
      setLegacyDraft(null);
      setTenantRefreshKey((value) => value + 1);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error: any) {
      setSaveError(error?.message || 'No se pudo guardar Mi empresa.');
    } finally {
      setSaving(false);
    }
  }

  async function prepareDrive() {
    if (!config.businessName.trim()) {
      setDriveError('Escribe primero el nombre comercial.');
      return;
    }

    setDriveLoading(true);
    setDriveError('');
    setSaveError('');
    try {
      const stored = await saveTenantCompanyConfig(config);
      setConfig({ ...DEFAULT_COMPANY_CONFIG, ...stored });
      setTenantRefreshKey((value) => value + 1);

      const response = await fetch('/api/company-drive', {
        method: 'POST',
        headers: await tenantAuthorizationHeader(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudo preparar Drive.');

      const next = {
        ...stored,
        driveConnected: true,
        driveFolderId: payload.folderId || '',
        driveFolderUrl: payload.folderUrl || '',
      };
      setConfig({ ...DEFAULT_COMPANY_CONFIG, ...next });
      window.localStorage.removeItem(COMPANY_STORAGE_KEY);
      setLegacyDraft(null);
      setSaved(true);
    } catch (error: any) {
      setDriveError(error?.message || 'No se pudo preparar Drive.');
    } finally {
      setDriveLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(249,115,22,.16),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(148,163,184,.08),transparent_24%)]" />
      <header className="relative border-b border-white/10 bg-[#0c1013]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-orange-400/20 bg-black"><Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" /></div>
            <div><p className="text-xl font-black">CA46</p><p className="text-xs font-semibold text-slate-500">Mi empresa</p></div>
          </Link>
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Inicio</Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="mb-8 max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Configuración central</p>
          <h1 className="mt-2 text-4xl font-black sm:text-6xl">Mi empresa</h1>
          <p className="mt-4 max-w-2xl text-slate-400">Configura una vez tu negocio. Los datos quedan vinculados a tu empresa y estarán disponibles al iniciar sesión desde cualquier dispositivo.</p>
        </section>

        {loadingConfig ? (
          <section className="mb-6 rounded-[2rem] border border-white/10 bg-white/[.035] p-6">
            <p className="text-sm font-black text-slate-400">Cargando configuración segura de la empresa…</p>
          </section>
        ) : null}

        {!loadingConfig && legacyDraft ? (
          <section className="mb-6 rounded-[2rem] border border-amber-400/20 bg-amber-400/[.05] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Configuración anterior encontrada</p>
                <h2 className="mt-2 text-xl font-black">Hay datos guardados solo en este dispositivo</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">CA46 no los importa automáticamente para evitar mezclar datos entre cuentas. Puedes recuperarlos, revisarlos y guardarlos en tu empresa.</p>
              </div>
              <button type="button" onClick={recoverLegacyData} className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-black">Recuperar datos locales</button>
            </div>
          </section>
        ) : null}

        <TenantCompanyCard key={tenantRefreshKey} companyName={config.businessName} />

        {saveError ? <p className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 text-sm font-bold text-rose-200">{saveError}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_.72fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6">
              <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">Datos de empresa</h2><span className="rounded-full border border-emerald-400/15 bg-emerald-400/[.07] px-3 py-1 text-xs font-black text-emerald-300">Supabase</span></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  ['businessName','Nombre comercial'],['legalName','Razón social'],['taxId','CIF / NIF'],['phone','Teléfono'],['email','Email'],['address','Dirección'],['postalCode','Código postal'],['city','Población'],['province','Provincia']
                ].map(([key,label]) => <label key={key}><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">{label}</span><input disabled={loadingConfig} value={String(config[key as keyof CompanyConfig] || '')} onChange={(e) => patch(key as keyof CompanyConfig, e.target.value as never)} className={inputClass} /></label>)}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6">
              <h2 className="text-2xl font-black">Responsable</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Nombre</span><input value={config.contactFirstName} onChange={(e) => patch('contactFirstName', e.target.value)} className={inputClass}/></label>
                <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Apellidos</span><input value={config.contactLastName} onChange={(e) => patch('contactLastName', e.target.value)} className={inputClass}/></label>
                <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Teléfono</span><input value={config.contactPhone} onChange={(e) => patch('contactPhone', e.target.value)} className={inputClass}/></label>
                <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Email</span><input value={config.contactEmail} onChange={(e) => patch('contactEmail', e.target.value)} className={inputClass}/></label>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Mis bancos</p><h2 className="mt-1 text-2xl font-black">Selecciona los que utilizas</h2></div><Link href="/bancos" className="rounded-full border border-orange-400/25 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300">Ir a Bancos →</Link></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {BANKS.map((bank) => {
                  const active = config.selectedBankIds.includes(bank.id);
                  return <button key={bank.id} type="button" onClick={() => toggleBank(bank.id)} className={`flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${active ? 'border-orange-400/45 bg-orange-500/10' : 'border-white/10 bg-black/20'}`}><span><span className="block font-black">{bank.name}</span><span className="mt-1 block text-xs text-slate-500">{bank.featured ? 'Principal' : 'Otros bancos'}</span></span><span className={`grid h-7 w-7 place-items-center rounded-full border text-sm ${active ? 'border-orange-300 bg-orange-500 text-black' : 'border-white/15 text-slate-600'}`}>{active ? '✓' : ''}</span></button>;
                })}
              </div>
              <p className="mt-4 text-sm text-slate-500">CA46 no guarda usuarios, claves, IBAN ni credenciales bancarias. Solo guarda qué accesos oficiales quieres tener disponibles.</p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6">
              <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Integraciones</p>
              <h2 className="mt-1 text-2xl font-black">Google Drive y GESICO</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black">Google Drive</h3><span className={`rounded-full px-3 py-1 text-xs font-black ${config.driveConnected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>{config.driveConnected ? 'Conectado' : 'Sin preparar'}</span></div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">La carpeta se crea para tu empresa autenticada con Facturas, Etiquetas e Histórico.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={prepareDrive} disabled={driveLoading || loadingConfig} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-[#111416] disabled:opacity-50">{driveLoading ? 'Preparando…' : config.driveConnected ? 'Revisar carpeta' : 'Crear carpeta CA46'}</button>
                    {config.driveFolderUrl ? <a href={config.driveFolderUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">📁 Abrir carpeta</a> : null}
                  </div>
                  {driveError ? <p className="mt-3 text-sm font-bold text-rose-300">{driveError}</p> : null}
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black">GESICO</h3><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">Disponible</span></div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">Acceso independiente para consultar información cuando la necesites.</p>
                  <a href="https://sevilla.gesicosistemas.es/login" target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">Abrir GESICO ↗</a>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6">
              <h2 className="text-2xl font-black">Etiquetas</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Nombre de la pantalla</span><input value={config.screenName} onChange={(e) => patch('screenName', e.target.value)} placeholder={config.businessName || 'Nombre del establecimiento'} className={inputClass}/></label>
                <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Horas visibles</span><input type="number" min={1} max={720} value={config.labelsHours} onChange={(e) => patch('labelsHours', Number(e.target.value || 72))} className={inputClass}/></label>
                <label className="flex items-end"><button type="button" onClick={() => patch('publicScreenEnabled', !config.publicScreenEnabled)} className={`w-full rounded-xl border px-4 py-3 text-sm font-black ${config.publicScreenEnabled ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-black/30 text-slate-500'}`}>{config.publicScreenEnabled ? '✓ Pantalla pública activa' : 'Pantalla pública desactivada'}</button></label>
              </div>
            </section>

            <button type="button" onClick={handleSave} disabled={saving || loadingConfig} className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-500">{saving ? 'Guardando en CA46…' : saved ? '✓ Guardado en tu empresa' : 'Guardar Mi empresa'}</button>
          </div>

          <aside className="space-y-6">
            <section className="sticky top-6 rounded-[2rem] border border-orange-400/20 bg-orange-500/[.06] p-6">
              <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Estado de CA46</p>
              <h2 className="mt-2 text-2xl font-black">Configuración</h2>
              <p className="mt-2 text-xs font-bold text-emerald-300">Datos sincronizados por empresa · no dependen de este dispositivo</p>
              <div className="mt-5 space-y-3 text-sm font-bold">
                <Status ok={configured} label="Empresa configurada" />
                <Status ok={config.driveConnected} label="Drive preparado" />
                <Status ok={selectedBanks.length > 0} label={`${selectedBanks.length || 0} banco${selectedBanks.length === 1 ? '' : 's'} seleccionado${selectedBanks.length === 1 ? '' : 's'}`} />
                <Status ok={config.publicScreenEnabled} label="Pantalla de etiquetas activa" />
              </div>
              <div className="mt-6 grid gap-3"><Link href="/bancos" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black">🏦 Abrir Mis bancos</Link><Link href="/etiquetas" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black">🖥️ Ver etiquetas</Link></div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3"><span className={`grid h-7 w-7 place-items-center rounded-full ${ok ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-slate-600'}`}>{ok ? '✓' : '·'}</span><span className={ok ? 'text-slate-200' : 'text-slate-500'}>{label}</span></div>;
}
