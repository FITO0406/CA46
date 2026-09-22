'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PlanId = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
type InvoiceItem = {
  id: string;
  number: string;
  description: string;
  totalCents: number;
  currency: string;
  issuedAt: string;
  paymentProvider: 'stripe' | 'manual';
  emailStatus: string;
};
type BillingPayload = {
  ok: boolean;
  error?: string;
  company?: { id: string; name: string; plan: PlanId; effectivePlan: PlanId };
  complimentaryAccess?: {
    active: boolean;
    plan: PlanId;
    endsAt: string | null;
    features: Record<string, boolean>;
  } | null;
  subscription?: {
    plan: PlanId;
    status: string;
    provider: string;
    priceCents: number | null;
    currency: string;
    startedAt: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    cancelledAt: string | null;
    hasStripeCustomer: boolean;
    hasStripeSubscription: boolean;
  } | null;
  invoices?: InvoiceItem[];
  stripe?: {
    secretKeyConfigured: boolean;
    webhookConfigured: boolean;
    prices: { autonomo: boolean; empresa: boolean };
    ready: boolean;
  };
};

const planNames: Record<PlanId, string> = {
  gratis: 'Gratis',
  autonomo: 'Autónomo',
  empresa: 'Empresa',
  personalizado: 'Personalizado',
};

const statusNames: Record<string, string> = {
  none: 'Sin suscripción',
  trial: 'En prueba',
  active: 'Activa',
  pending: 'Pago pendiente',
  unpaid: 'Impagada',
  cancelled: 'Cancelada',
};

export default function FacturacionPage() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function loadBilling() {
    setLoading(true);
    setError('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Inicia sesión para gestionar la facturación.');
      const response = await fetch('/api/billing/me', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json().catch(() => ({}))) as BillingPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo cargar la facturación.');
      setData(payload);
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudo cargar la facturación.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  async function checkout(plan: 'autonomo' | 'empresa') {
    if (action) return;
    setAction(plan);
    setError('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Inicia sesión para continuar.');
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.url) throw new Error(payload.error || 'No se pudo iniciar Stripe Checkout.');
      window.location.href = payload.url;
    } catch (checkoutError: any) {
      setError(checkoutError?.message || 'No se pudo iniciar Stripe Checkout.');
      setAction('');
    }
  }

  async function openPortal() {
    if (action) return;
    setAction('portal');
    setError('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Inicia sesión para continuar.');
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.url) throw new Error(payload.error || 'No se pudo abrir el portal de Stripe.');
      window.location.href = payload.url;
    } catch (portalError: any) {
      setError(portalError?.message || 'No se pudo abrir el portal de Stripe.');
      setAction('');
    }
  }

  async function downloadInvoice(invoice: InvoiceItem) {
    if (action) return;
    setAction(`invoice-${invoice.id}`);
    setError('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Inicia sesión para continuar.');
      const response = await fetch(`/api/billing/invoices/${invoice.id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('No se pudo descargar la factura.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoice.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (invoiceError: any) {
      setError(invoiceError?.message || 'No se pudo descargar la factura.');
    } finally {
      setAction('');
    }
  }

  const stripeReady = Boolean(data?.stripe?.ready);
  const subscription = data?.subscription;
  const complimentary = data?.complimentaryAccess;
  const effectivePlan = data?.company?.effectivePlan || subscription?.plan || data?.company?.plan || 'gratis';
  const checkoutDisabled = !stripeReady || Boolean(action) || Boolean(complimentary?.active);
  const invoices = data?.invoices || [];

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46</p>
            <h1 className="mt-1 text-2xl font-black">Facturación y suscripción</h1>
          </div>
          <Link href="/mi-empresa" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Mi empresa</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        {loading ? <div className="h-40 animate-pulse rounded-[2rem] border border-white/10 bg-white/[.03]" /> : null}
        {error ? <div className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div> : null}

        {!loading && data?.company ? (
          <>
            <section className="rounded-[2rem] border border-orange-400/20 bg-orange-500/[.06] p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">{data.company.name}</p>
              <h2 className="mt-2 text-3xl font-black">Plan efectivo {planNames[effectivePlan]}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Info label="Suscripción" value={statusNames[subscription?.status || 'none'] || subscription?.status || 'Sin suscripción'} />
                <Info label="Gestión del cobro" value={subscription?.provider === 'stripe' ? 'Stripe' : subscription?.provider === 'manual' ? 'Manual' : 'Sin gestión'} />
                <Info label="Renovación" value={formatDate(subscription?.currentPeriodEnd)} />
              </div>
            </section>

            {complimentary?.active ? (
              <section className="mt-6 rounded-[2rem] border border-sky-400/25 bg-sky-400/[.07] p-6">
                <p className="text-xs font-black uppercase tracking-[.16em] text-sky-400">Cortesía SuperAdmin</p>
                <h3 className="mt-2 text-2xl font-black">Acceso {planNames[complimentary.plan]} sin cobro</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Mientras esta cortesía esté activa no necesitas contratar otro plan. {complimentary.endsAt ? `Finaliza el ${formatDate(complimentary.endsAt)}.` : 'No tiene fecha de fin.'}</p>
              </section>
            ) : null}

            <section className="mt-6 grid gap-4 md:grid-cols-2">
              <PlanCard name="Autónomo" price="19,99 €/mes" detail="1 establecimiento · hasta 3 usuarios" active={effectivePlan === 'autonomo'} disabled={checkoutDisabled} onClick={() => void checkout('autonomo')} buttonText={complimentary?.active ? 'Incluido por cortesía' : action === 'autonomo' ? 'Abriendo Stripe…' : 'Contratar Autónomo'} />
              <PlanCard name="Empresa" price="35,99 €/mes" detail="Varios establecimientos y usuarios" active={effectivePlan === 'empresa'} disabled={checkoutDisabled} onClick={() => void checkout('empresa')} buttonText={complimentary?.active ? 'Cobro bloqueado por cortesía' : action === 'empresa' ? 'Abriendo Stripe…' : 'Contratar Empresa'} />
            </section>

            <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Stripe</p>
                  <h3 className="mt-1 text-xl font-black">Gestión de pagos</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Desde el portal de Stripe el cliente podrá gestionar su método de pago y su suscripción cuando exista un cliente Stripe asociado.</p>
                </div>
                <button type="button" disabled={!stripeReady || !subscription?.hasStripeCustomer || Boolean(action)} onClick={() => void openPortal()} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-black disabled:bg-slate-800 disabled:text-slate-600">
                  {action === 'portal' ? 'Abriendo…' : 'Abrir portal Stripe'}
                </button>
              </div>
            </section>

            <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Mis facturas</p>
                <h3 className="mt-1 text-xl font-black">Historial de facturas emitidas</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Cada factura se genera después de un cobro confirmado y queda disponible para descargar en PDF.</p>
              </div>
              <div className="mt-5 space-y-3">
                {invoices.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm font-bold text-slate-600">Todavía no tienes facturas emitidas.</div> : invoices.map((invoice) => (
                  <div key={invoice.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-black">{invoice.number}</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-400">{invoice.description}</p>
                      <p className="mt-1 text-xs font-bold text-slate-600">{formatDate(invoice.issuedAt)} · {invoice.paymentProvider === 'stripe' ? 'Stripe' : 'Pago manual'} · {money(invoice.totalCents, invoice.currency)}</p>
                    </div>
                    <button type="button" disabled={Boolean(action)} onClick={() => void downloadInvoice(invoice)} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300 disabled:opacity-50">
                      {action === `invoice-${invoice.id}` ? 'Generando…' : 'Descargar PDF'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {!stripeReady ? (
              <section className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[.07] px-5 py-4 text-sm font-bold leading-6 text-amber-200">
                El motor Stripe ya está integrado en CA46, pero faltan las credenciales y los precios de Stripe en producción. Hasta configurarlos, ningún botón puede iniciar un cobro.
              </section>
            ) : null}
          </>
        ) : null}

        {!loading && !data?.company ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[.03] p-8 text-center">
            <p className="font-black">Necesitas una sesión de administrador de empresa.</p>
            <Link href="/acceso" className="mt-4 inline-flex rounded-xl bg-orange-500 px-5 py-3 font-black text-black">Ir al acceso</Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1 font-black text-slate-200">{value}</p></div>;
}

function PlanCard({ name, price, detail, active, disabled, onClick, buttonText }: { name: string; price: string; detail: string; active: boolean; disabled: boolean; onClick: () => void; buttonText: string }) {
  return <div className={`rounded-[2rem] border p-6 ${active ? 'border-orange-400/35 bg-orange-500/[.07]' : 'border-white/10 bg-[#0d1215]'}`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-2xl font-black">{name}</h3><p className="mt-2 text-xl font-black text-orange-300">{price}</p></div>{active ? <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">Efectivo</span> : null}</div><p className="mt-4 text-sm text-slate-400">{detail}</p><button type="button" disabled={disabled} onClick={onClick} className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-black disabled:bg-slate-800 disabled:text-slate-600">{buttonText}</button></div>;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function money(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format((cents || 0) / 100);
}
