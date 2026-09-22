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
  vatRate: number;
  autoEmail: boolean;
  ready: boolean;
  emailProviderReady: boolean;
};
type Invoice = {
  id: string;
  invoice_number: string;
  company_id: string;
  companyName: string;
  status: 'issued' | 'rectified';
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
};
type Company = { id: string; name: string; plan: PlanId; status: string };
type Payload = { ok: boolean; settings?: Settings; invoices?: Invoice[]; companies?: Company[]; error?: string };

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

  const metrics = useMemo(() => {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    let monthTotal = 0;
    let emailProblems = 0;
    for (const invoice of invoices) {
      const date = new Date(invoice.issued_at);
      if (date.getMonth() === month && date.getFullYear() === year) monthTotal += invoice.total_cents;
      if (invoice.email_status === 'failed' || invoice.email_status === 'disabled') emailProblems += 1;
    }
    return { total: invoices.length, monthTotal, emailProblems };
  }, [invoices]);

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
          <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Paso 7.5 · Facturación automática</p>
          <h2 className="mt-2 text-3xl font-black">Cobro confirmado → factura → PDF → email</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Stripe genera la factura al confirmar el pago. Los cobros manuales se pueden registrar aquí. CA46 guarda una copia fiscal de los datos usados en cada factura para que el PDF no cambie después.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="Facturas" value={metrics.total} /><Stat label="Facturado este mes" value={money(metrics.monthTotal)} /><Stat label="Emails pendientes/error" value={metrics.emailProblems} /></div>
        </section>

        {error ? <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div> : null}
        {message ? <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[.07] px-5 py-4 font-bold text-emerald-300">{message}</div> : null}
        {loading ? <div className="mt-6 h-52 animate-pulse rounded-[2rem] border border-white/10 bg-white/[.03]" /> : null}

        {!loading && settings ? <>
          <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Datos del emisor</p><h2 className="mt-1 text-2xl font-black">Configuración fiscal</h2></div>
              <div className="flex gap-2"><Badge ok={settings.ready} text={settings.ready ? 'Facturación activa' : 'Faltan datos'} /><Badge ok={settings.emailProviderReady} text={settings.emailProviderReady ? 'Email listo' : 'Email pendiente'} /></div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Razón social"><input className={inputClass} value={settings.issuerLegalName} onChange={(e) => setSettings({ ...settings, issuerLegalName: e.target.value })} /></Field>
              <Field label="NIF / CIF"><input className={inputClass} value={settings.issuerTaxId} onChange={(e) => setSettings({ ...settings, issuerTaxId: e.target.value })} /></Field>
              <Field label="Email fiscal"><input className={inputClass} value={settings.issuerEmail} onChange={(e) => setSettings({ ...settings, issuerEmail: e.target.value })} /></Field>
              <Field label="Dirección"><input className={inputClass} value={settings.issuerAddress} onChange={(e) => setSettings({ ...settings, issuerAddress: e.target.value })} /></Field>
              <Field label="Código postal"><input className={inputClass} value={settings.issuerPostalCode} onChange={(e) => setSettings({ ...settings, issuerPostalCode: e.target.value })} /></Field>
              <Field label="Ciudad"><input className={inputClass} value={settings.issuerCity} onChange={(e) => setSettings({ ...settings, issuerCity: e.target.value })} /></Field>
              <Field label="Provincia"><input className={inputClass} value={settings.issuerProvince} onChange={(e) => setSettings({ ...settings, issuerProvince: e.target.value })} /></Field>
              <Field label="Serie"><input className={inputClass} value={settings.seriesPrefix} onChange={(e) => setSettings({ ...settings, seriesPrefix: e.target.value })} /></Field>
              <Field label="IVA %"><input type="number" step="0.01" className={inputClass} value={settings.vatRate} onChange={(e) => setSettings({ ...settings, vatRate: Number(e.target.value) })} /></Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Toggle active={settings.enabled} onClick={() => setSettings({ ...settings, enabled: !settings.enabled })} text="Emitir facturas automáticamente" />
              <Toggle active={settings.autoEmail} onClick={() => setSettings({ ...settings, autoEmail: !settings.autoEmail })} text="Enviar email automáticamente" />
              <button onClick={() => void saveSettings()} disabled={savingSettings} className="rounded-xl bg-orange-500 px-5 py-3 font-black text-black disabled:opacity-50">{savingSettings ? 'Guardando…' : 'Guardar configuración'}</button>
            </div>
            {!settings.emailProviderReady ? <p className="mt-4 text-xs font-bold leading-5 text-amber-300">El motor de facturas ya está operativo. Para el envío automático falta configurar en producción RESEND_API_KEY e INVOICE_FROM_EMAIL. Mientras tanto el PDF se genera y queda guardado en CA46.</p> : null}
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

          <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Historial</p><h2 className="mt-1 text-2xl font-black">Facturas emitidas</h2></div><button onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">Actualizar</button></div>
            <div className="mt-5 space-y-3">
              {invoices.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm font-bold text-slate-600">Todavía no hay facturas.</div> : invoices.map((invoice) => <div key={invoice.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="grid gap-3 lg:grid-cols-[.8fr_1.2fr_1.2fr_.65fr_.75fr_auto] lg:items-center"><Small label="Factura" value={invoice.invoice_number} /><Small label="Empresa" value={invoice.companyName} /><Small label="Concepto" value={invoice.description} /><Small label="Total" value={money(invoice.total_cents)} /><Small label="Email" value={emailLabel(invoice.email_status)} /><div className="flex flex-wrap gap-2"><button disabled={busyInvoice === invoice.id} onClick={() => void downloadPdf(invoice)} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-xs font-black text-orange-300">PDF</button><button disabled={busyInvoice === invoice.id} onClick={() => void resend(invoice)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-300">Enviar</button></div></div><p className="mt-3 border-t border-white/5 pt-3 text-xs font-bold text-slate-600">{formatDate(invoice.issued_at)} · {invoice.payment_provider === 'stripe' ? 'Stripe' : 'Manual'} · Base {money(invoice.subtotal_cents)} · IVA {money(invoice.vat_cents)}</p></div>)}
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
function money(cents: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100); }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)); }
function emailLabel(status: Invoice['email_status']) { if (status === 'sent') return 'Enviado'; if (status === 'failed') return 'Error'; if (status === 'disabled') return 'Email no configurado'; return 'Pendiente'; }
