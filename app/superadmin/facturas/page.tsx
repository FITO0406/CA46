'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PlanId = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
type Settings = {
  enabled: boolean;
  issuerLegalName: string;
  issuerTaxId: string;
  issuerAddress: string;
  issuerPostalCode: string;
  issuerCity: string;
  issuerProvince: string;
  issuerCountry: string;
  issuerEmail: string;
  seriesPrefix: string;
  rectificationSeriesPrefix: string;
  vatRate: number;
  autoEmail: boolean;
  verifactuMode: 'off' | 'prepared' | 'active';
  verifactuConnectorReady: boolean;
  ready: boolean;
  emailProviderReady: boolean;
};
type Invoice = {
  id: string;
  invoice_number: string;
  company_id: string;
  companyName: string;
  status: 'issued' | 'rectified' | 'voided';
  invoice_kind?: 'standard' | 'rectification';
  payment_provider: 'stripe' | 'manual';
  plan: PlanId;
  description: string;
  currency: string;
  subtotal_cents: number;
  vat_rate: number;
  vat_cents: number;
  total_cents: number;
  issued_at: string;
  email_status: 'pending' | 'sent' | 'failed' | 'disabled';
  emailed_at: string | null;
  customer_snapshot?: Record<string, any>;
  service_period_start?: string | null;
  service_period_end?: string | null;
  rectifies_invoice_id?: string | null;
  rectifies_invoice_number?: string | null;
  rectification_reason?: string | null;
  void_reason?: string | null;
  fiscal_mode?: 'standard' | 'verifactu';
  verifactu_status?: 'not_applicable' | 'pending' | 'accepted' | 'rejected';
};
type Company = { id: string; name: string; plan: PlanId; status: string };
type Payload = { ok: boolean; settings?: Settings; invoices?: Invoice[]; companies?: Company[]; error?: string };

type RectifyForm = {
  reason: string;
  plan: PlanId;
  description: string;
  total: string;
  legalName: string;
  taxId: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
};

const planNames: Record<PlanId, string> = { gratis: 'Gratis', autonomo: 'Autónomo', empresa: 'Empresa', personalizado: 'Personalizado' };
const inputClass = 'w-full rounded-xl border border-white/10 bg-[#11161a] px-4 py-3 font-bold text-white outline-none focus:border-orange-400';

export default function SuperAdminInvoicesPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [busyInvoice, setBusyInvoice] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [manualCompanyId, setManualCompanyId] = useState('');
  const [manualPlan, setManualPlan] = useState<PlanId>('personalizado');
  const [manualDescription, setManualDescription] = useState('Servicio CA46');
  const [manualTotal, setManualTotal] = useState('');
  const [rectifyingInvoice, setRectifyingInvoice] = useState<Invoice | null>(null);
  const [rectifyForm, setRectifyForm] = useState<RectifyForm | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('La sesión SuperAdmin no está disponible.');
      const response = await fetch('/api/superadmin/invoices', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok || !payload.ok || !payload.settings) throw new Error(payload.error || 'No se pudo cargar facturación.');
      setSettings(payload.settings);
      setInvoices(payload.invoices || []);
      setCompanies(payload.companies || []);
      if (!manualCompanyId && payload.companies?.[0]) {
        setManualCompanyId(payload.companies[0].id);
        setManualPlan(payload.companies[0].plan);
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar facturación.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const replacedInvoiceIds = useMemo(() => new Set(invoices.map((invoice) => invoice.rectifies_invoice_id).filter(Boolean) as string[]), [invoices]);

  const metrics = useMemo(() => {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    let monthTotal = 0;
    let emailProblems = 0;
    for (const invoice of invoices) {
      const date = new Date(invoice.issued_at);
      if (invoice.status !== 'voided' && !replacedInvoiceIds.has(invoice.id) && date.getMonth() === month && date.getFullYear() === year) monthTotal += invoice.total_cents;
      if (invoice.status !== 'voided' && (invoice.email_status === 'failed' || invoice.email_status === 'disabled')) emailProblems += 1;
    }
    return { total: invoices.length, monthTotal, emailProblems };
  }, [invoices, replacedInvoiceIds]);

  async function saveSettings() {
    if (!settings || savingSettings) return;
    setSavingSettings(true); setError(''); setMessage('');
    try {
      const accessToken = await token();
      const response = await fetch('/api/superadmin/invoices/settings', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo guardar.');
      setMessage('Configuración fiscal guardada.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar.');
    } finally { setSavingSettings(false); }
  }

  async function issueManual() {
    if (issuing) return;
    const total = Number(String(manualTotal).replace(',', '.'));
    if (!manualCompanyId || !manualDescription.trim() || !Number.isFinite(total) || total <= 0) {
      setError('Selecciona empresa, concepto e importe.');
      return;
    }
    if (!window.confirm(`¿Confirmas que este cobro manual está realizado y quieres emitir una factura por ${total.toFixed(2)} €?`)) return;
    setIssuing(true); setError(''); setMessage('');
    try {
      const accessToken = await token();
      const response = await fetch('/api/superadmin/invoices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: manualCompanyId, plan: manualPlan, description: manualDescription, totalCents: Math.round(total * 100) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo emitir.');
      setManualTotal('');
      setMessage(`Factura ${payload.invoice?.invoice_number || ''} emitida.`);
      await load();
    } catch (e: any) { setError(e?.message || 'No se pudo emitir.'); }
    finally { setIssuing(false); }
  }

  async function downloadPdf(invoice: Invoice) {
    setBusyInvoice(invoice.id); setError('');
    try {
      const accessToken = await token();
      const response = await fetch(`/api/superadmin/invoices/${invoice.id}/pdf`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error('No se pudo generar el PDF.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${invoice.invoice_number}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e?.message || 'No se pudo descargar.'); }
    finally { setBusyInvoice(''); }
  }

  async function resend(invoice: Invoice) {
    if (invoice.status === 'voided') return;
    setBusyInvoice(invoice.id); setError(''); setMessage('');
    try {
      const accessToken = await token();
      const response = await fetch(`/api/superadmin/invoices/${invoice.id}/email`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo enviar.');
      setMessage(`Factura ${invoice.invoice_number} enviada por email.`);
      await load();
    } catch (e: any) { setError(e?.message || 'No se pudo enviar.'); }
    finally { setBusyInvoice(''); }
  }

  async function voidInvoice(invoice: Invoice) {
    if (invoice.status !== 'issued' || replacedInvoiceIds.has(invoice.id)) return;
    const reason = window.prompt(`Motivo de anulación de ${invoice.invoice_number}:`, 'Error en los datos de la factura');
    if (!reason?.trim()) return;
    if (!window.confirm(`¿Anular ${invoice.invoice_number}? La factura no se borrará y conservará su número.`)) return;
    setBusyInvoice(invoice.id); setError(''); setMessage('');
    try {
      const accessToken = await token();
      const response = await fetch(`/api/superadmin/invoices/${invoice.id}/void`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo anular.');
      setMessage(`Factura ${invoice.invoice_number} anulada. Se mantiene en el historial.`);
      await load();
    } catch (e: any) { setError(e?.message || 'No se pudo anular.'); }
    finally { setBusyInvoice(''); }
  }

  function startRectify(invoice: Invoice) {
    const customer = invoice.customer_snapshot || {};
    setRectifyingInvoice(invoice);
    setRectifyForm({
      reason: 'Corrección de datos de la factura',
      plan: invoice.plan,
      description: invoice.description,
      total: (invoice.total_cents / 100).toFixed(2).replace('.', ','),
      legalName: String(customer.legalName || customer.businessName || ''),
      taxId: String(customer.taxId || ''),
      email: String(customer.email || ''),
      address: String(customer.address || ''),
      postalCode: String(customer.postalCode || ''),
      city: String(customer.city || ''),
      province: String(customer.province || ''),
    });
    setError(''); setMessage('');
  }

  async function submitRectification() {
    if (!rectifyingInvoice || !rectifyForm || busyInvoice) return;
    const total = Number(rectifyForm.total.replace(',', '.'));
    if (!rectifyForm.reason.trim() || !rectifyForm.description.trim() || !Number.isFinite(total) || total < 0) {
      setError('Indica motivo, concepto e importe corregido.');
      return;
    }
    if (!window.confirm(`Se generará una factura rectificativa nueva que hará referencia a ${rectifyingInvoice.invoice_number}. La original no se editará ni se borrará. ¿Continuar?`)) return;
    setBusyInvoice(rectifyingInvoice.id); setError(''); setMessage('');
    try {
      const accessToken = await token();
      const response = await fetch(`/api/superadmin/invoices/${rectifyingInvoice.id}/rectify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rectifyForm.reason,
          plan: rectifyForm.plan,
          description: rectifyForm.description,
          totalCents: Math.round(total * 100),
          customer: {
            legalName: rectifyForm.legalName,
            businessName: rectifyForm.legalName,
            taxId: rectifyForm.taxId,
            email: rectifyForm.email,
            address: rectifyForm.address,
            postalCode: rectifyForm.postalCode,
            city: rectifyForm.city,
            province: rectifyForm.province,
            country: 'España',
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo rectificar.');
      setMessage(`Rectificativa ${payload.invoice?.invoice_number || ''} emitida para ${rectifyingInvoice.invoice_number}.`);
      setRectifyingInvoice(null); setRectifyForm(null);
      await load();
    } catch (e: any) { setError(e?.message || 'No se pudo rectificar.'); }
    finally { setBusyInvoice(''); }
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46 · SuperAdmin</p><h1 className="mt-1 text-2xl font-black">Facturación</h1></div>
          <Link href="/superadmin" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Panel</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="rounded-[2rem] border border-orange-400/20 bg-orange-500/[.06] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Facturación CA46</p>
          <h2 className="mt-2 text-3xl font-black">Cobro → factura → PDF → email</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Las facturas emitidas no se sobrescriben. Si hay un error puedes anularlas o emitir una rectificativa con los datos corregidos y trazabilidad completa.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="Documentos" value={metrics.total} /><Stat label="Facturado este mes" value={money(metrics.monthTotal)} /><Stat label="Emails pendientes/error" value={metrics.emailProblems} /></div>
        </section>

        {error ? <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div> : null}
        {message ? <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[.07] px-5 py-4 font-bold text-emerald-300">{message}</div> : null}
        {loading ? <div className="mt-6 h-52 animate-pulse rounded-[2rem] border border-white/10 bg-white/[.03]" /> : null}

        {!loading && settings ? <>
          <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Datos del emisor</p><h2 className="mt-1 text-2xl font-black">Configuración fiscal</h2></div>
              <div className="flex flex-wrap gap-2"><Badge ok={settings.ready} text={settings.ready ? 'Facturación activa' : 'Faltan datos'} /><Badge ok={settings.emailProviderReady} text={settings.emailProviderReady ? 'Email listo' : 'Email pendiente'} /></div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Razón social"><input className={inputClass} value={settings.issuerLegalName} onChange={(e) => setSettings({ ...settings, issuerLegalName: e.target.value })} /></Field>
              <Field label="NIF / CIF"><input className={inputClass} value={settings.issuerTaxId} onChange={(e) => setSettings({ ...settings, issuerTaxId: e.target.value })} /></Field>
              <Field label="Email fiscal"><input className={inputClass} value={settings.issuerEmail} onChange={(e) => setSettings({ ...settings, issuerEmail: e.target.value })} /></Field>
              <Field label="Dirección"><input className={inputClass} value={settings.issuerAddress} onChange={(e) => setSettings({ ...settings, issuerAddress: e.target.value })} /></Field>
              <Field label="Código postal"><input className={inputClass} value={settings.issuerPostalCode} onChange={(e) => setSettings({ ...settings, issuerPostalCode: e.target.value })} /></Field>
              <Field label="Ciudad"><input className={inputClass} value={settings.issuerCity} onChange={(e) => setSettings({ ...settings, issuerCity: e.target.value })} /></Field>
              <Field label="Provincia"><input className={inputClass} value={settings.issuerProvince} onChange={(e) => setSettings({ ...settings, issuerProvince: e.target.value })} /></Field>
              <Field label="Serie ordinaria"><input className={inputClass} value={settings.seriesPrefix} onChange={(e) => setSettings({ ...settings, seriesPrefix: e.target.value })} /></Field>
              <Field label="Serie rectificativa"><input className={inputClass} value={settings.rectificationSeriesPrefix} onChange={(e) => setSettings({ ...settings, rectificationSeriesPrefix: e.target.value })} /></Field>
              <Field label="IVA %"><input type="number" step="0.01" className={inputClass} value={settings.vatRate} onChange={(e) => setSettings({ ...settings, vatRate: Number(e.target.value) })} /></Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Toggle active={settings.enabled} onClick={() => setSettings({ ...settings, enabled: !settings.enabled })} text="Emitir facturas automáticamente" />
              <Toggle active={settings.autoEmail} onClick={() => setSettings({ ...settings, autoEmail: !settings.autoEmail })} text="Enviar email automáticamente" />
              <button onClick={() => void saveSettings()} disabled={savingSettings} className="rounded-xl bg-orange-500 px-5 py-3 font-black text-black disabled:opacity-50">{savingSettings ? 'Guardando…' : 'Guardar configuración'}</button>
            </div>
          </section>

          <section className="mt-6 rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[.04] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-400">VERI*FACTU</p>
                <h2 className="mt-1 text-2xl font-black">Distinción fiscal preparada</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Puedes dejar CA46 preparado para VERI*FACTU. La leyenda oficial solo aparecerá en una factura cuando exista remisión real a la AEAT y el registro esté aceptado. No marcamos como VERI*FACTU una factura que todavía no se haya enviado.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge ok={settings.verifactuMode !== 'off'} text={settings.verifactuMode === 'active' ? 'VERI*FACTU activo' : settings.verifactuMode === 'prepared' ? 'Preparado' : 'No preparado'} />
                <Badge ok={settings.verifactuConnectorReady} text={settings.verifactuConnectorReady ? 'Conector AEAT listo' : 'Conector AEAT pendiente'} />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Toggle active={settings.verifactuMode !== 'off'} onClick={() => setSettings({ ...settings, verifactuMode: settings.verifactuMode === 'off' ? 'prepared' : 'off' })} text="Preparar VERI*FACTU" />
              <button onClick={() => void saveSettings()} disabled={savingSettings} className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-300 disabled:opacity-50">Guardar estado VERI*FACTU</button>
            </div>
          </section>

          <section className="mt-6 rounded-[2rem] border border-sky-400/20 bg-sky-400/[.05] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-sky-400">Cobro manual</p><h2 className="mt-1 text-2xl font-black">Emitir factura tras confirmar un pago</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Empresa"><select className={inputClass} value={manualCompanyId} onChange={(e) => { const id = e.target.value; setManualCompanyId(id); const c = companies.find((x) => x.id === id); if (c) setManualPlan(c.plan); }}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
              <Field label="Plan"><select className={inputClass} value={manualPlan} onChange={(e) => setManualPlan(e.target.value as PlanId)}>{(Object.keys(planNames) as PlanId[]).map((p) => <option key={p} value={p}>{planNames[p]}</option>)}</select></Field>
              <Field label="Concepto"><input className={inputClass} value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} /></Field>
              <Field label="Total cobrado €"><input inputMode="decimal" className={inputClass} value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} placeholder="19,99" /></Field>
            </div>
            <button onClick={() => void issueManual()} disabled={issuing || !settings.ready} className="mt-5 rounded-xl bg-sky-400 px-5 py-3 font-black text-[#071014] disabled:opacity-40">{issuing ? 'Emitiendo…' : 'Pago recibido · Emitir factura'}</button>
          </section>

          {rectifyingInvoice && rectifyForm ? <section className="mt-6 rounded-[2rem] border border-amber-400/25 bg-amber-400/[.05] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[.16em] text-amber-300">Factura rectificativa</p><h2 className="mt-1 text-2xl font-black">Corregir {rectifyingInvoice.invoice_number}</h2><p className="mt-2 text-sm text-slate-400">La original se conserva. CA46 emitirá otra factura con serie rectificativa y referencia a la anterior.</p></div>
              <button onClick={() => { setRectifyingInvoice(null); setRectifyForm(null); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">Cerrar</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Motivo de rectificación"><input className={inputClass} value={rectifyForm.reason} onChange={(e) => setRectifyForm({ ...rectifyForm, reason: e.target.value })} /></Field>
              <Field label="Plan"><select className={inputClass} value={rectifyForm.plan} onChange={(e) => setRectifyForm({ ...rectifyForm, plan: e.target.value as PlanId })}>{(Object.keys(planNames) as PlanId[]).map((p) => <option key={p} value={p}>{planNames[p]}</option>)}</select></Field>
              <Field label="Total correcto €"><input className={inputClass} inputMode="decimal" value={rectifyForm.total} onChange={(e) => setRectifyForm({ ...rectifyForm, total: e.target.value })} /></Field>
              <Field label="Concepto correcto"><input className={inputClass} value={rectifyForm.description} onChange={(e) => setRectifyForm({ ...rectifyForm, description: e.target.value })} /></Field>
              <Field label="Razón social cliente"><input className={inputClass} value={rectifyForm.legalName} onChange={(e) => setRectifyForm({ ...rectifyForm, legalName: e.target.value })} /></Field>
              <Field label="NIF / CIF cliente"><input className={inputClass} value={rectifyForm.taxId} onChange={(e) => setRectifyForm({ ...rectifyForm, taxId: e.target.value })} /></Field>
              <Field label="Email cliente"><input className={inputClass} value={rectifyForm.email} onChange={(e) => setRectifyForm({ ...rectifyForm, email: e.target.value })} /></Field>
              <Field label="Dirección cliente"><input className={inputClass} value={rectifyForm.address} onChange={(e) => setRectifyForm({ ...rectifyForm, address: e.target.value })} /></Field>
              <Field label="Código postal"><input className={inputClass} value={rectifyForm.postalCode} onChange={(e) => setRectifyForm({ ...rectifyForm, postalCode: e.target.value })} /></Field>
              <Field label="Ciudad"><input className={inputClass} value={rectifyForm.city} onChange={(e) => setRectifyForm({ ...rectifyForm, city: e.target.value })} /></Field>
              <Field label="Provincia"><input className={inputClass} value={rectifyForm.province} onChange={(e) => setRectifyForm({ ...rectifyForm, province: e.target.value })} /></Field>
            </div>
            <button onClick={() => void submitRectification()} disabled={busyInvoice === rectifyingInvoice.id} className="mt-5 rounded-xl bg-amber-300 px-5 py-3 font-black text-black disabled:opacity-50">{busyInvoice === rectifyingInvoice.id ? 'Generando…' : 'Emitir factura rectificativa'}</button>
          </section> : null}

          <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Historial</p><h2 className="mt-1 text-2xl font-black">Facturas emitidas</h2></div><button onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">Actualizar</button></div>
            <div className="mt-5 space-y-3">
              {invoices.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm font-bold text-slate-600">Todavía no hay facturas.</div> : invoices.map((invoice) => {
                const replaced = replacedInvoiceIds.has(invoice.id);
                const canChange = invoice.status === 'issued' && !replaced;
                return <div key={invoice.id} className={`rounded-2xl border p-4 ${invoice.status === 'voided' ? 'border-rose-400/20 bg-rose-500/[.04]' : invoice.invoice_kind === 'rectification' ? 'border-amber-400/20 bg-amber-400/[.04]' : 'border-white/10 bg-black/20'}`}>
                  <div className="grid gap-3 lg:grid-cols-[.8fr_1.05fr_1.2fr_.65fr_.7fr_auto] lg:items-center">
                    <Small label="Factura" value={invoice.invoice_number} />
                    <Small label="Empresa" value={invoice.companyName} />
                    <Small label="Concepto" value={invoice.description} />
                    <Small label="Total" value={money(invoice.total_cents)} />
                    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-600">Estado</p><div className="mt-1 flex flex-wrap gap-1"><InvoiceStatus invoice={invoice} replaced={replaced} />{invoice.fiscal_mode === 'verifactu' ? <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-300">VERI*FACTU {invoice.verifactu_status === 'accepted' ? '✓' : '…'}</span> : null}</div></div>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busyInvoice === invoice.id} onClick={() => void downloadPdf(invoice)} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-xs font-black text-orange-300">PDF</button>
                      <button disabled={busyInvoice === invoice.id || invoice.status === 'voided'} onClick={() => void resend(invoice)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-30">Enviar</button>
                      {canChange ? <button disabled={busyInvoice === invoice.id} onClick={() => startRectify(invoice)} className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-300">Rectificar</button> : null}
                      {canChange ? <button disabled={busyInvoice === invoice.id} onClick={() => void voidInvoice(invoice)} className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-300">Anular</button> : null}
                    </div>
                  </div>
                  <p className="mt-3 border-t border-white/5 pt-3 text-xs font-bold text-slate-600">{formatDate(invoice.issued_at)} · {invoice.payment_provider === 'stripe' ? 'Stripe' : 'Manual'} · Base {money(invoice.subtotal_cents)} · IVA {money(invoice.vat_cents)}{invoice.rectifies_invoice_number ? ` · Rectifica ${invoice.rectifies_invoice_number}` : ''}{invoice.void_reason ? ` · Motivo: ${invoice.void_reason}` : ''}</p>
                </div>;
              })}
            </div>
          </section>
        </> : null}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-slate-500">{label}</span>{children}</label>; }
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>; }
function Small({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-1 truncate text-sm font-black text-slate-300">{value}</p></div>; }
function Badge({ ok, text }: { ok: boolean; text: string }) { return <span className={`rounded-full border px-3 py-1 text-xs font-black ${ok ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>{text}</span>; }
function Toggle({ active, onClick, text }: { active: boolean; onClick: () => void; text: string }) { return <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-3 text-sm font-black ${active ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-400'}`}>{active ? '✓ ' : '○ '}{text}</button>; }
function InvoiceStatus({ invoice, replaced }: { invoice: Invoice; replaced: boolean }) {
  if (invoice.status === 'voided') return <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-300">ANULADA</span>;
  if (replaced) return <span className="rounded-full border border-slate-400/20 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400">RECTIFICADA</span>;
  if (invoice.invoice_kind === 'rectification' || invoice.status === 'rectified') return <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300">RECTIFICATIVA</span>;
  return <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-300">EMITIDA</span>;
}
function money(cents: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100); }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)); }
