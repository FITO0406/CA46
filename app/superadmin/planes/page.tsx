'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PlanId = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
type CompanyStatus = 'active' | 'trial' | 'suspended' | 'cancelled';
type SubscriptionStatus = 'none' | 'trial' | 'active' | 'pending' | 'unpaid' | 'cancelled';
type Provider = 'none' | 'manual' | 'stripe';

type Subscription = {
  plan: PlanId;
  status: SubscriptionStatus;
  provider: Provider;
  priceCents: number | null;
  currency: string;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  notes: string;
  updatedAt: string;
};

type Item = {
  companyId: string;
  companyName: string;
  ownerEmail: string;
  companyPlan: PlanId;
  companyStatus: CompanyStatus;
  createdAt: string;
  subscription: Subscription | null;
};

type Payload = { ok: boolean; items?: Item[]; error?: string };
type StripeStatus = {
  secretKeyConfigured: boolean;
  webhookConfigured: boolean;
  prices: { autonomo: boolean; empresa: boolean };
  ready: boolean;
};

type StripePayload = { ok: boolean; stripe?: StripeStatus; error?: string };

const plans: Record<PlanId, { name: string; price: string; note: string }> = {
  gratis: { name: 'Gratis', price: '0 €', note: 'Hasta 20 etiquetas/mes' },
  autonomo: { name: 'Autónomo', price: '19,99 €/mes', note: '1 establecimiento · hasta 3 usuarios' },
  empresa: { name: 'Empresa', price: '35,99 €/mes', note: 'Varios establecimientos y usuarios' },
  personalizado: { name: 'Personalizado', price: 'A medida', note: 'Configuración e integraciones especiales' },
};

const subscriptionLabels: Record<SubscriptionStatus, string> = {
  none: 'Sin suscripción',
  trial: 'En prueba',
  active: 'Activa',
  pending: 'Pago pendiente',
  unpaid: 'Impagada',
  cancelled: 'Cancelada',
};

const providerLabels: Record<Provider, string> = {
  none: 'Sin proveedor',
  manual: 'Manual',
  stripe: 'Stripe',
};

const emptyStripe: StripeStatus = {
  secretKeyConfigured: false,
  webhookConfigured: false,
  prices: { autonomo: false, empresa: false },
  ready: false,
};

export default function SuperAdminPlansPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [stripe, setStripe] = useState<StripeStatus>(emptyStripe);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formStatus, setFormStatus] = useState<SubscriptionStatus>('none');
  const [formProvider, setFormProvider] = useState<'none' | 'manual'>('none');
  const [formRenewal, setFormRenewal] = useState('');
  const [formTrialEnd, setFormTrialEnd] = useState('');
  const [formNotes, setFormNotes] = useState('');

  async function authToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function loadPlans() {
    setLoading(true);
    setError('');
    const token = await authToken();
    if (!token) {
      setError('La sesión SuperAdmin no está disponible.');
      setLoading(false);
      return;
    }

    try {
      const [subscriptionsResponse, stripeResponse] = await Promise.all([
        fetch('/api/superadmin/subscriptions', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/superadmin/stripe-status', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const payload = (await subscriptionsResponse.json().catch(() => ({}))) as Payload;
      const stripePayload = (await stripeResponse.json().catch(() => ({}))) as StripePayload;

      if (!subscriptionsResponse.ok || !payload.ok) throw new Error(payload.error || 'No se pudieron cargar las suscripciones.');
      if (!stripeResponse.ok || !stripePayload.ok) throw new Error(stripePayload.error || 'No se pudo consultar Stripe.');

      setItems(payload.items || []);
      setStripe(stripePayload.stripe || emptyStripe);
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudieron cargar las suscripciones.');
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
    let active = 0;
    let pending = 0;
    let unpaid = 0;

    for (const item of items) {
      const plan = item.subscription?.plan || item.companyPlan;
      byPlan[plan] += 1;
      if (plan !== 'gratis') commercial += 1;
      if (item.subscription?.status === 'active') active += 1;
      if (item.subscription?.status === 'pending') pending += 1;
      if (item.subscription?.status === 'unpaid') unpaid += 1;
    }

    return { total: items.length, commercial, active, pending, unpaid, byPlan };
  }, [items]);

  function beginEdit(item: Item) {
    const sub = item.subscription;
    setEditingId(item.companyId);
    setFormStatus(sub?.status || 'none');
    setFormProvider(sub?.provider === 'manual' ? 'manual' : 'none');
    setFormRenewal(toDateInput(sub?.currentPeriodEnd));
    setFormTrialEnd(toDateInput(sub?.trialEndsAt));
    setFormNotes(sub?.notes || '');
    setError('');
    setMessage('');
  }

  async function saveSubscription() {
    if (!editingId || saving) return;
    const item = items.find((entry) => entry.companyId === editingId);
    if (!item) return;

    const confirmed = window.confirm(`¿Guardar la situación de suscripción de ${item.companyName}?\n\nNo se realizará ningún cargo.`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const token = await authToken();
      if (!token) throw new Error('La sesión SuperAdmin no está disponible.');
      const response = await fetch('/api/superadmin/subscriptions', {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: editingId,
          status: formStatus,
          provider: formProvider,
          currentPeriodEnd: formRenewal || null,
          trialEndsAt: formTrialEnd || null,
          notes: formNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo actualizar la suscripción.');
      setMessage('Situación de suscripción actualizada. No se ha realizado ningún cobro.');
      setEditingId(null);
      await loadPlans();
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo actualizar la suscripción.');
    } finally {
      setSaving(false);
    }
  }

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
              <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Paso 7.3</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">Motor de cobro Stripe</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Checkout, portal de cliente y webhook de suscripciones ya están integrados en CA46. El panel solo muestra si las credenciales de producción están configuradas; nunca expone las claves.</p>
            </div>
            <button type="button" onClick={() => void loadPlans()} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 disabled:opacity-50">
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Empresas" value={metrics.total} />
            <Stat label="Planes comerciales" value={metrics.commercial} />
            <Stat label="Suscripción activa" value={metrics.active} />
            <Stat label="Pago pendiente" value={metrics.pending} />
            <Stat label="Impagadas" value={metrics.unpaid} />
          </div>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div> : null}
        {message ? <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/[.07] px-5 py-4 font-bold text-emerald-300">{message}</div> : null}

        <section className={`mt-6 rounded-[2rem] border p-5 sm:p-6 ${stripe.ready ? 'border-emerald-400/20 bg-emerald-400/[.05]' : 'border-amber-400/20 bg-amber-400/[.05]'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Conexión Stripe</p>
              <h2 className="mt-1 text-2xl font-black">{stripe.ready ? 'Preparado para cobrar' : 'Motor instalado · configuración pendiente'}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Webhook de CA46: <span className="font-black text-slate-300">/api/stripe/webhook</span>. Los planes Gratis y Personalizado no necesitan un Price ID automático.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${stripe.ready ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>{stripe.ready ? 'Stripe listo' : 'Faltan credenciales'}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Check label="Clave secreta" ok={stripe.secretKeyConfigured} />
            <Check label="Webhook secret" ok={stripe.webhookConfigured} />
            <Check label="Precio Autónomo" ok={stripe.prices.autonomo} />
            <Check label="Precio Empresa" ok={stripe.prices.empresa} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/facturacion" className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300">Abrir área cliente →</Link>
            <span className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-slate-500">Checkout y portal quedan bloqueados automáticamente mientras falte configuración.</span>
          </div>
        </section>

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
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Empresas</p>
              <h2 className="mt-1 text-2xl font-black">Situación de suscripción</h2>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${stripe.ready ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>{stripe.ready ? 'Stripe conectado' : 'Stripe pendiente'}</span>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[.03]" /> : null}
            {!loading && items.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm font-bold text-slate-600">Todavía no hay empresas.</div> : null}
            {!loading && items.map((item) => {
              const sub = item.subscription;
              const plan = sub?.plan || item.companyPlan;
              return (
                <div key={item.companyId} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-[1.35fr_.55fr_.75fr_.65fr_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-black">{item.companyName}</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-600">{item.ownerEmail || 'Sin email'}</p>
                    </div>
                    <SmallData label="Plan" value={plans[plan].name} />
                    <SmallData label="Suscripción" value={subscriptionLabels[sub?.status || 'none']} />
                    <SmallData label="Proveedor" value={providerLabels[sub?.provider || 'none']} />
                    <button type="button" onClick={() => beginEdit(item)} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300">Gestionar →</button>
                  </div>

                  <div className="mt-3 grid gap-2 border-t border-white/5 pt-3 text-xs font-bold text-slate-600 sm:grid-cols-3">
                    <span>Inicio: {formatDate(sub?.startedAt)}</span>
                    <span>Renovación: {formatDate(sub?.currentPeriodEnd)}</span>
                    <span>Fin prueba: {formatDate(sub?.trialEndsAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {editingId ? (
          <section className="mt-6 rounded-[2rem] border border-orange-400/25 bg-orange-500/[.06] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-orange-400">Gestión manual · sin cobro</p>
                <h2 className="mt-1 text-2xl font-black">{items.find((item) => item.companyId === editingId)?.companyName}</h2>
              </div>
              <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">Cerrar</button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Estado de suscripción">
                <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as SubscriptionStatus)} className={inputClass}>
                  {(Object.keys(subscriptionLabels) as SubscriptionStatus[]).map((status) => <option key={status} value={status}>{subscriptionLabels[status]}</option>)}
                </select>
              </Field>
              <Field label="Proveedor">
                <select value={formProvider} onChange={(e) => setFormProvider(e.target.value as 'none' | 'manual')} className={inputClass}>
                  <option value="none">Sin proveedor</option>
                  <option value="manual">Manual</option>
                </select>
              </Field>
              <Field label="Próxima renovación">
                <input type="date" value={formRenewal} onChange={(e) => setFormRenewal(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Fin del periodo de prueba">
                <input type="date" value={formTrialEnd} onChange={(e) => setFormTrialEnd(e.target.value)} className={inputClass} />
              </Field>
              <label className="md:col-span-2">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-slate-500">Notas internas</span>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} maxLength={1000} className={`${inputClass} resize-none`} placeholder="Ej.: pago por transferencia, acuerdo comercial, incidencia…" />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold leading-5 text-slate-500">Estas opciones siguen siendo administrativas. Stripe solo modifica suscripciones a través de Checkout y del webhook firmado.</p>
              <button type="button" onClick={() => void saveSubscription()} disabled={saving} className="rounded-xl bg-orange-500 px-5 py-3 font-black text-black disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar situación'}</button>
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-5 py-4 text-sm font-bold leading-6 text-emerald-200">
          Paso 7.3 activo: CA46 ya tiene Checkout, portal de cliente, webhook firmado e idempotencia para Stripe. La activación real depende únicamente de cargar las credenciales y Price IDs de Stripe en producción.
        </section>
      </main>
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-[#11161a] px-4 py-3 font-bold text-white outline-none focus:border-orange-400';

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`rounded-xl border px-4 py-4 ${ok ? 'border-emerald-400/15 bg-emerald-400/[.05]' : 'border-white/10 bg-black/20'}`}><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className={`mt-1 font-black ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{ok ? '✓ Configurado' : 'Pendiente'}</p></div>;
}

function SmallData({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-1 text-sm font-black text-slate-300">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-slate-500">{label}</span>{children}</label>;
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  } catch {
    return '—';
  }
}
