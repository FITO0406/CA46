'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BANKS,
  COMPANY_STORAGE_KEY,
  DEFAULT_COMPANY_CONFIG,
  loadCompanyConfig,
  type CompanyConfig,
} from '@/lib/company-config';
import {
  loadTenantCompanyConfig,
  saveTenantCompanyConfig,
  tenantAuthorizationHeader,
} from '@/lib/tenant-company-config';
import TenantCompanyCard from '@/components/TenantCompanyCard';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-orange-400';

type DriveStatus = {
  connected: boolean;
  mode: 'none' | 'legacy' | 'oauth';
  accountEmail: string;
  folderId: string;
  folderUrl: string;
  historyUrl?: string;
  oauthReady: boolean;
  archiveReady?: boolean;
  archivedAt?: string;
  archiveError?: string;
  pendingLabels?: number;
};

const EMPTY_DRIVE_STATUS: DriveStatus = {
  connected: false,
  mode: 'none',
  accountEmail: '',
  folderId: '',
  folderUrl: '',
  oauthReady: false,
};

function hasLegacyData(config: CompanyConfig) {
  return Boolean(
    config.businessName.trim() ||
      config.legalName.trim() ||
      config.taxId.trim() ||
      config.marketBuyerNumber.trim() ||
      config.contactFirstName.trim() ||
      config.contactLastName.trim() ||
      config.selectedBankIds.length ||
      config.driveConnected,
  );
}

export default function MiEmpresaPage() {
  const [config, setConfig] = useState<CompanyConfig>(DEFAULT_COMPANY_CONFIG);
  const [legacyDraft, setLegacyDraft] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveStatus, setDriveStatus] = useState<DriveStatus>(EMPTY_DRIVE_STATUS);

  useEffect(() => {
    let active = true;
    const legacy = loadCompanyConfig();
    if (hasLegacyData(legacy)) setLegacyDraft(legacy);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const driveResult = params.get('drive');
      if (driveResult === 'connected') {
        const account = params.get('account') || '';
        setMessage(account ? `✓ Google Drive conectado con ${account}.` : '✓ Google Drive conectado correctamente.');
      } else if (driveResult === 'error') {
        setMessage(params.get('reason') || 'No se pudo conectar Google Drive.');
      }
      if (driveResult) window.history.replaceState({}, '', window.location.pathname);
    }

    Promise.all([
      loadTenantCompanyConfig(),
      tenantAuthorizationHeader()
        .then((headers) => fetch('/api/company-drive/status', { cache: 'no-store', headers }))
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.error || 'No se pudo consultar Google Drive.');
          return payload as DriveStatus;
        })
        .catch(() => EMPTY_DRIVE_STATUS),
    ])
      .then(([settings, status]) => {
        if (!active) return;
        if (settings) {
          setConfig({ ...DEFAULT_COMPANY_CONFIG, ...settings, labelsHours: 72 });
          setLegacyDraft(null);
        }
        setDriveStatus({ ...EMPTY_DRIVE_STATUS, ...status });
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message || 'No se pudo cargar Mi empresa.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedBanks = useMemo(
    () => BANKS.filter((bank) => config.selectedBankIds.includes(bank.id)),
    [config.selectedBankIds],
  );

  const screenUrl = config.publicScreenToken
    ? `/etiquetas?screen=${encodeURIComponent(config.publicScreenToken)}`
    : '/etiquetas';

  function patch<K extends keyof CompanyConfig>(key: K, value: CompanyConfig[K]) {
    setSaved(false);
    setMessage('');
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
    setConfig({ ...DEFAULT_COMPANY_CONFIG, ...legacyDraft, labelsHours: 72 });
    setLegacyDraft(null);
    setMessage('Datos anteriores recuperados. Revísalos y pulsa Guardar.');
  }

  async function handleSave() {
    if (saving) return;
    if (!config.businessName.trim()) {
      setMessage('Escribe el nombre comercial antes de guardar.');
      return;
    }

    setSaving(true);
    setSaved(false);
    setMessage('');
    try {
      const stored = await saveTenantCompanyConfig({ ...config, labelsHours: 72 });
      setConfig({ ...DEFAULT_COMPANY_CONFIG, ...stored, labelsHours: 72 });
      window.localStorage.removeItem(COMPANY_STORAGE_KEY);
      setLegacyDraft(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo guardar Mi empresa.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveDrive() {
    setDriveLoading(true);
    try {
      let pending = 1;
      let total = 0;
      // Each request is bounded; continue batches until the backlog is saved.
      while (pending > 0) {
        const response = await fetch('/api/company-drive/archive', { method: 'POST', headers: await tenantAuthorizationHeader() });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Conecta Google Drive para guardar el histórico.');
        total += result.archived || 0;
        pending = result.pending || 0;
        if (result.busy) { setMessage('El histórico ya se está guardando. Vuelve a revisar Drive en unos instantes.'); return; }
        if (!result.archived && pending) throw new Error('Hay etiquetas pendientes. Vuelve a intentar guardar el histórico.');
        if (result.archived === 30) pending = Math.max(1, pending);
      }
      setMessage(`✓ Histórico guardado en Drive: ${total} etiquetas nuevas. Las de 24 y 72 horas se conservan al caducar.`);
      const status = await fetch('/api/company-drive/status', { headers: await tenantAuthorizationHeader(), cache: 'no-store' });
      if (status.ok) setDriveStatus(await status.json());
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el histórico en Drive.');
    } finally { setDriveLoading(false); }
  }

  async function connectDrive() {
    if (!config.businessName.trim()) {
      setMessage('Escribe primero el nombre comercial.');
      return;
    }
    if (!driveStatus.oauthReady) {
      setMessage('La conexión por cuenta de Google todavía está pendiente de configurar en CA46.');
      return;
    }

    setDriveLoading(true);
    setMessage('');
    try {
      const stored = await saveTenantCompanyConfig({ ...config, labelsHours: 72 });
      setConfig({ ...DEFAULT_COMPANY_CONFIG, ...stored, labelsHours: 72 });

      const response = await fetch('/api/company-drive/connect', {
        method: 'POST',
        headers: await tenantAuthorizationHeader(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudo abrir Google Drive.');
      if (!payload?.url) throw new Error('Google Drive no devolvió la pantalla de conexión.');

      window.location.assign(payload.url);
    } catch (error: any) {
      setMessage(error?.message || 'No se pudo conectar Google Drive.');
      setDriveLoading(false);
    }
  }

  if (loadError) return (
    <main className="min-h-screen bg-[#080b0d] px-5 py-10 text-white">
      <h1 className="text-3xl font-black">No se pudo cargar Mi empresa</h1>
      <p role="alert" className="mt-4 text-amber-300">{loadError}</p>
      <p className="mt-3 text-slate-400">Tus datos guardados no se han modificado. Reintenta la carga antes de editar.</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-orange-500 px-5 py-3 font-bold text-black">Reintentar</button>
    </main>
  );

  return (
    <div className="min-h-screen bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(249,115,22,.15),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(148,163,184,.07),transparent_24%)]" />

      <header className="relative border-b border-white/10 bg-[#0c1013]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-orange-400/20 bg-black">
              <Image src="/ca46-logo.svg?v=20261006" alt="CA46" fill priority sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-xl font-black">CA46</p>
              <p className="text-xs font-semibold text-slate-500">Mi empresa</p>
            </div>
          </Link>
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">
            ← Inicio
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="mb-7">
          <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Una sola configuración</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Mi empresa</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Pon los datos de tu pescadería una vez y CA46 los usará siempre para tu empresa.
          </p>
        </section>

        <Link href="/mi-empresa/usuarios" className="inline-block rounded-xl border border-white/20 px-5 py-3 font-bold">Usuarios · acceso de empleados</Link>
        {!loading ? <TenantCompanyCard companyName={config.businessName || legacyDraft?.businessName || ''} /> : null}

        {loading ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[.035] p-5 text-sm font-black text-slate-400">
            Cargando tu empresa…
          </div>
        ) : null}

        {!loading && legacyDraft ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-5">
            <div>
              <p className="font-black text-amber-300">Hay datos anteriores en este dispositivo</p>
              <p className="mt-1 text-sm text-slate-400">Puedes recuperarlos y guardarlos en tu empresa.</p>
            </div>
            <button type="button" onClick={recoverLegacyData} className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-black">
              Recuperar datos
            </button>
          </div>
        ) : null}

        {message ? (
          <p className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/[.06] px-5 py-4 text-sm font-bold text-amber-100">{message}</p>
        ) : null}

        <div className="space-y-6">
          <section className="rounded-[1.7rem] border border-white/10 bg-white/[.035] p-5 sm:p-6">
            <h2 className="text-2xl font-black">1. Datos de la pescadería</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['businessName', 'Nombre comercial'],
                ['legalName', 'Razón social'],
                ['taxId', 'CIF / NIF'],
                ['phone', 'Teléfono'],
                ['email', 'Email'],
                ['address', 'Dirección'],
                ['postalCode', 'Código postal'],
                ['city', 'Población'],
                ['province', 'Provincia'],
              ].map(([key, label]) => (
                <label key={key}>
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">{label}</span>
                  <input
                    disabled={loading}
                    value={String(config[key as keyof CompanyConfig] || '')}
                    onChange={(event) => patch(key as keyof CompanyConfig, event.target.value as never)}
                    className={inputClass}
                  />
                </label>
              ))}
              <label className="sm:col-span-2">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-orange-300">N.º de comprador / cliente del Merca</span>
                <input
                  disabled={loading}
                  inputMode="numeric"
                  value={config.marketBuyerNumber}
                  onChange={(event) => patch('marketBuyerNumber', event.target.value)}
                  placeholder="Ej.: 494"
                  className={inputClass}
                />
                <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">CA46 compara este identificador con cada factura de 72 horas cuando el documento lo incluye. Si no coincide, la factura se rechaza y no genera etiquetas.</span>
              </label>
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/10 bg-white/[.035] p-5 sm:p-6">
            <h2 className="text-2xl font-black">2. Persona responsable</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Nombre</span><input value={config.contactFirstName} onChange={(e) => patch('contactFirstName', e.target.value)} className={inputClass} /></label>
              <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Apellidos</span><input value={config.contactLastName} onChange={(e) => patch('contactLastName', e.target.value)} className={inputClass} /></label>
              <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Teléfono</span><input value={config.contactPhone} onChange={(e) => patch('contactPhone', e.target.value)} className={inputClass} /></label>
              <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Email</span><input value={config.contactEmail} onChange={(e) => patch('contactEmail', e.target.value)} className={inputClass} /></label>
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/10 bg-white/[.035] p-5 sm:p-6">
            <h2 className="text-2xl font-black">3. Mis bancos</h2>
            <p className="mt-2 text-sm text-slate-400">Marca solo los bancos que utilizas. CA46 no guarda claves, usuarios ni IBAN.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {BANKS.map((bank) => {
                const active = config.selectedBankIds.includes(bank.id);
                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => toggleBank(bank.id)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left font-black ${active ? 'border-orange-400/45 bg-orange-500/10' : 'border-white/10 bg-black/20'}`}
                  >
                    <span>{bank.name}</span>
                    <span className={active ? 'text-orange-300' : 'text-slate-600'}>{active ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
            {selectedBanks.length > 0 ? <p className="mt-4 text-sm font-bold text-emerald-300">{selectedBanks.length} banco(s) seleccionado(s)</p> : null}
          </section>

          <section className="rounded-[1.7rem] border border-white/10 bg-white/[.035] p-5 sm:p-6">
            <h2 className="text-2xl font-black">4. Pantalla de etiquetas</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Sin configuraciones técnicas: las etiquetas de factura duran 72 horas y las provisionales 24 horas automáticamente.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Nombre que verá el cliente</span>
                <input value={config.screenName} onChange={(e) => patch('screenName', e.target.value)} placeholder={config.businessName || 'Mi pescadería'} className={inputClass} />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => patch('publicScreenEnabled', !config.publicScreenEnabled)}
                  className={`w-full rounded-xl border px-4 py-3 text-sm font-black ${config.publicScreenEnabled ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-black/30 text-slate-500'}`}
                >
                  {config.publicScreenEnabled ? '✓ Pantalla activa' : 'Pantalla desactivada'}
                </button>
              </div>
            </div>
            <div className="mt-4">
              <Link href={screenUrl} target="_blank" className="inline-flex rounded-xl border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300">
                🖥️ Abrir pantalla de etiquetas
              </Link>
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/10 bg-white/[.035] p-5 sm:p-6">
            <h2 className="text-2xl font-black">5. Accesos</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <h3 className="text-lg font-black">Mi histórico privado</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Conecta tu Drive una sola vez. Guardaremos automáticamente tus etiquetas de 24 y 72 horas en PDF. Al terminar su exposición y confirmar la copia, se retirarán de CA46. Tu histórico quedará en tu Drive.
                </p>

                {driveStatus.connected && driveStatus.accountEmail ? (
                  <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-2 text-sm font-bold text-emerald-200">
                    ✓ Guardado automático en: {driveStatus.accountEmail}
                  </p>
                ) : driveStatus.mode === 'legacy' ? (
                  <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[.06] px-3 py-2 text-sm font-bold text-amber-100">
                    Conecta tu Drive para activar tu histórico privado.
                  </p>
                ) : null}

                {!driveStatus.oauthReady ? (
                  <p className="mt-3 text-xs font-bold text-rose-300">La conexión está temporalmente pendiente de activación por CA46. Tus etiquetas siguen protegidas.</p>
                ) : null}
                {driveStatus.archiveError ? <p className="mt-3 text-xs text-amber-300">Hay etiquetas pendientes de guardar. Conservamos la copia temporal hasta completar el envío.</p> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {!driveStatus.connected ? <button type="button" onClick={connectDrive} disabled={driveLoading || loading || !driveStatus.oauthReady} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-[#111416] disabled:opacity-50">{driveLoading ? 'Abriendo Google…' : 'Conectar mi Drive'}</button> : <>
                    <a href={driveStatus.historyUrl || driveStatus.folderUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-[#111416]">Abrir mi histórico ↗</a>
                    <button type="button" onClick={connectDrive} disabled={driveLoading || !driveStatus.oauthReady} className="px-2 py-3 text-xs font-bold text-slate-400">Cambiar cuenta</button>
                    {driveStatus.archiveError ? <button type="button" onClick={archiveDrive} disabled={driveLoading} className="px-2 py-3 text-xs font-bold text-orange-300">Reintentar guardado</button> : null}
                  </>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <h3 className="text-lg font-black">Mi Merca</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Acceso directo al portal profesional de tu mercado habitual. CA46 no guarda usuarios ni contraseñas de plataformas externas.</p>
                <Link href="/mi-merca" className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">
                  Abrir Mi Merca ↗
                </Link>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-500"
          >
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar Mi empresa'}
          </button>

          <p className="pb-4 text-center text-xs font-bold text-slate-600">
            Todo queda vinculado a esta empresa. Las facturas de 72 h se validan contra su identificador de comprador cuando el documento lo incluye.
          </p>
        </div>
      </main>
    </div>
  );
}
