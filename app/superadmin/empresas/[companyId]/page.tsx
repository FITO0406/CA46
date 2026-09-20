'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Member = {
  userId: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
};

type Tag = {
  id: string;
  productName: string;
  origin: string;
  source: string;
  status: string;
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
};

type Settings = {
  businessName: string;
  legalName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  contactFirstName: string;
  contactLastName: string;
  contactPhone: string;
  contactEmail: string;
  selectedBankIds: string[];
  screenName: string;
  publicScreenEnabled: boolean;
  publicScreenToken: string;
  driveConnected: boolean;
  driveFolderId: string;
  driveFolderUrl: string;
  driveLastSyncAt: string | null;
};

type Company = {
  id: string;
  name: string;
  slug: string;
  plan: 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  ownerEmail: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  settings: Settings | null;
  members: Member[];
  tags: Tag[];
  summary: { members: number; activeTags: number; totalTags: number };
};

type Payload = { ok: boolean; company?: Company; error?: string };
type UpdatePayload = { ok: boolean; company?: { id: string; plan: Company['plan']; status: Company['status']; updatedAt: string }; error?: string };

const planLabels: Record<Company['plan'], string> = {
  gratis: 'Gratis',
  autonomo: 'Autónomo',
  empresa: 'Empresa',
  personalizado: 'Personalizado',
};

const statusLabels: Record<Company['status'], string> = {
  active: 'Activa',
  trial: 'Prueba',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

export default function SuperAdminCompanyDetailPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params?.companyId;
  const [company, setCompany] = useState<Company | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Company['plan']>('gratis');
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [changingStatus, setChangingStatus] = useState<Company['status'] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadCompany() {
    if (!companyId) return;
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
      const response = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok || !payload.ok || !payload.company) throw new Error(payload.error || 'No se pudo cargar la empresa.');
      setCompany(payload.company);
      setSelectedPlan(payload.company.plan);
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudo cargar la empresa.');
    } finally {
      setLoading(false);
    }
  }

  async function patchCompany(body: Partial<Pick<Company, 'plan' | 'status'>>) {
    if (!companyId) throw new Error('Empresa no válida.');

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('La sesión SuperAdmin no está disponible.');

    const response = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as UpdatePayload;
    if (!response.ok || !payload.ok || !payload.company) {
      throw new Error(payload.error || 'No se pudo actualizar la empresa.');
    }

    setCompany((current) => current ? {
      ...current,
      plan: payload.company!.plan,
      status: payload.company!.status,
      updatedAt: payload.company!.updatedAt,
    } : current);
    setSelectedPlan(payload.company.plan);
    return payload.company;
  }

  async function savePlan() {
    if (!company || selectedPlan === company.plan || savingPlan) return;
    const confirmed = window.confirm(`¿Cambiar el plan de ${planLabels[company.plan]} a ${planLabels[selectedPlan]}?`);
    if (!confirmed) return;

    setSavingPlan(true);
    setError('');
    setMessage('');
    try {
      const updated = await patchCompany({ plan: selectedPlan });
      setMessage(`Plan actualizado a ${planLabels[updated.plan]}.`);
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo cambiar el plan.');
    } finally {
      setSavingPlan(false);
    }
  }

  async function changeStatus(nextStatus: Company['status']) {
    if (!company || nextStatus === company.status || changingStatus) return;

    const warning = nextStatus === 'suspended'
      ? 'Suspender la empresa bloqueará el uso normal de CA46 para sus usuarios.'
      : nextStatus === 'cancelled'
        ? 'Cancelar la empresa bloqueará el uso normal de CA46 para sus usuarios.'
        : nextStatus === 'trial'
          ? 'La empresa quedará marcada como periodo de prueba y seguirá teniendo acceso.'
          : 'La empresa volverá a estar activa y sus usuarios podrán utilizar CA46.';

    const confirmed = window.confirm(`${warning}\n\n¿Confirmas el cambio a “${statusLabels[nextStatus]}”?`);
    if (!confirmed) return;

    setChangingStatus(nextStatus);
    setError('');
    setMessage('');
    try {
      const updated = await patchCompany({ status: nextStatus });
      setMessage(`Estado actualizado a ${statusLabels[updated.status]}.`);
    } catch (statusError: any) {
      setError(statusError?.message || 'No se pudo cambiar el estado.');
    } finally {
      setChangingStatus(null);
    }
  }

  useEffect(() => {
    void loadCompany();
  }, [companyId]);

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46 · SuperAdmin</p>
            <h1 className="mt-1 text-2xl font-black">Ficha de empresa</h1>
          </div>
          <Link href="/superadmin/empresas" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Empresas</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {loading ? <div className="h-64 animate-pulse rounded-[2rem] border border-white/10 bg-white/[.03]" /> : null}
        {error ? <div className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div> : null}
        {message ? <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[.07] px-5 py-4 font-bold text-emerald-300">{message}</div> : null}

        {!loading && company ? (
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-orange-400/20 bg-gradient-to-br from-orange-500/[.10] via-white/[.035] to-white/[.02] p-6 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-3xl font-black sm:text-4xl">{company.settings?.businessName || company.name}</h2>
                    <StatusBadge status={company.status} />
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{planLabels[company.plan]}</span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-400">{company.ownerName || 'Propietario'} · {company.ownerEmail || 'Sin email'}</p>
                  <p className="mt-1 text-xs text-slate-600">ID: {company.id}</p>
                </div>
                <button type="button" onClick={() => void loadCompany()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200">Actualizar ficha</button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Stat label="Usuarios activos" value={company.summary.members} />
                <Stat label="Etiquetas activas" value={company.summary.activeTags} />
                <Stat label="Etiquetas recientes" value={company.summary.totalTags} />
              </div>
            </section>

            <Panel title="Control de la empresa">
              <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Plan</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <select
                      value={selectedPlan}
                      onChange={(event) => setSelectedPlan(event.target.value as Company['plan'])}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#11161a] px-4 py-3 font-bold text-white outline-none focus:border-orange-400"
                    >
                      <option value="gratis">Gratis</option>
                      <option value="autonomo">Autónomo</option>
                      <option value="empresa">Empresa</option>
                      <option value="personalizado">Personalizado</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void savePlan()}
                      disabled={savingPlan || selectedPlan === company.plan}
                      className="rounded-xl bg-orange-500 px-5 py-3 font-black text-black disabled:bg-slate-800 disabled:text-slate-600"
                    >
                      {savingPlan ? 'Guardando…' : 'Guardar plan'}
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">Este cambio es administrativo. Los cobros automáticos llegarán más adelante con Stripe.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Estado de acceso</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <StatusActionButton label="Activar" active={company.status === 'active'} busy={changingStatus === 'active'} onClick={() => void changeStatus('active')} tone="green" />
                    <StatusActionButton label="Prueba" active={company.status === 'trial'} busy={changingStatus === 'trial'} onClick={() => void changeStatus('trial')} tone="amber" />
                    <StatusActionButton label="Suspender" active={company.status === 'suspended'} busy={changingStatus === 'suspended'} onClick={() => void changeStatus('suspended')} tone="rose" />
                    <StatusActionButton label="Cancelar" active={company.status === 'cancelled'} busy={changingStatus === 'cancelled'} onClick={() => void changeStatus('cancelled')} tone="slate" />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">Suspender o cancelar impide el uso normal de CA46. Activar o poner en prueba devuelve el acceso.</p>
                </div>
              </div>
            </Panel>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel title="Datos de la empresa">
                <DataRow label="Nombre comercial" value={company.settings?.businessName || company.name} />
                <DataRow label="Razón social" value={company.settings?.legalName || company.name} />
                <DataRow label="CIF / NIF" value={company.settings?.taxId} />
                <DataRow label="Teléfono" value={company.settings?.phone} />
                <DataRow label="Email" value={company.settings?.email} />
                <DataRow label="Dirección" value={company.settings?.address} />
                <DataRow label="Localidad" value={[company.settings?.postalCode, company.settings?.city, company.settings?.province].filter(Boolean).join(' · ')} />
                <DataRow label="Alta" value={formatDate(company.createdAt)} />
              </Panel>

              <Panel title="Responsable">
                <DataRow label="Nombre" value={[company.settings?.contactFirstName, company.settings?.contactLastName].filter(Boolean).join(' ')} />
                <DataRow label="Teléfono" value={company.settings?.contactPhone} />
                <DataRow label="Email" value={company.settings?.contactEmail} />
                <DataRow label="Propietario de la cuenta" value={company.ownerEmail} />
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <Panel title="Drive">
                <StateRow label="Conexión" on={Boolean(company.settings?.driveConnected)} />
                <DataRow label="Última sincronización" value={company.settings?.driveLastSyncAt ? formatDateTime(company.settings.driveLastSyncAt) : ''} />
                {company.settings?.driveFolderUrl ? (
                  <a href={company.settings.driveFolderUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black">Abrir carpeta Drive ↗</a>
                ) : null}
              </Panel>

              <Panel title="Pantalla de etiquetas">
                <StateRow label="Pantalla" on={Boolean(company.settings?.publicScreenEnabled)} />
                <DataRow label="Nombre" value={company.settings?.screenName} />
                {company.settings?.publicScreenToken ? (
                  <a href={`/etiquetas?screen=${company.settings.publicScreenToken}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300">Abrir visor ↗</a>
                ) : null}
              </Panel>

              <Panel title="Bancos">
                <DataRow label="Seleccionados" value={(company.settings?.selectedBankIds || []).join(', ')} />
              </Panel>
            </section>

            <Panel title="Usuarios de la empresa">
              <div className="space-y-3">
                {company.members.length === 0 ? <Empty text="No hay usuarios vinculados." /> : company.members.map((member) => (
                  <div key={member.userId} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">{member.name || member.email || member.userId}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{member.email || 'Email no disponible'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{roleLabel(member.role)}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${member.active ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-600'}`}>{member.active ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Últimas etiquetas">
              <div className="space-y-3">
                {company.tags.length === 0 ? <Empty text="Esta empresa todavía no tiene etiquetas." /> : company.tags.slice(0, 20).map((tag) => (
                  <div key={tag.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-4 md:grid-cols-[1.2fr_1fr_auto_auto] md:items-center">
                    <div>
                      <p className="font-black">{tag.productName || 'Producto sin nombre'}</p>
                      <p className="mt-1 text-xs text-slate-600">{tag.origin || 'Sin procedencia'}</p>
                    </div>
                    <p className="text-xs font-bold text-slate-500">{tag.source === 'physical_label' ? 'Etiqueta física' : 'Factura'} · {tag.status === 'provisional' ? 'Provisional' : 'Definitiva'}</p>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${tag.active ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-600'}`}>{tag.active ? 'Activa' : 'Caducada'}</span>
                    <p className="text-xs font-bold text-slate-600">{formatDateTime(tag.createdAt)}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <section className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-5 py-4 text-sm font-bold text-emerald-200">
              Paso 5 activo: SuperAdmin ya puede cambiar el plan y controlar el estado de acceso de cada empresa con confirmación antes de aplicar el cambio.
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-6"><h3 className="text-xl font-black">{title}</h3><div className="mt-5 space-y-3">{children}</div></section>;
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex flex-col gap-1 border-b border-white/5 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"><span className="text-xs font-black uppercase tracking-[.12em] text-slate-600">{label}</span><span className="break-all text-sm font-bold text-slate-300 sm:max-w-[62%] sm:text-right">{value || 'No configurado'}</span></div>;
}

function StateRow({ label, on }: { label: string; on: boolean }) {
  return <div className="flex items-center justify-between border-b border-white/5 pb-3"><span className="text-xs font-black uppercase tracking-[.12em] text-slate-600">{label}</span><span className={`rounded-full border px-3 py-1 text-xs font-black ${on ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-600'}`}>{on ? 'Activo' : 'No'}</span></div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

function StatusBadge({ status }: { status: Company['status'] }) {
  const classes = status === 'active' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : status === 'trial' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : status === 'suspended' ? 'border-rose-400/20 bg-rose-500/10 text-rose-300' : 'border-white/10 bg-white/5 text-slate-500';
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes}`}>{statusLabels[status]}</span>;
}

function StatusActionButton({ label, active, busy, onClick, tone }: { label: string; active: boolean; busy: boolean; onClick: () => void; tone: 'green' | 'amber' | 'rose' | 'slate' }) {
  const toneClasses = tone === 'green'
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
    : tone === 'amber'
      ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
      : tone === 'rose'
        ? 'border-rose-400/25 bg-rose-500/10 text-rose-300'
        : 'border-white/10 bg-white/5 text-slate-300';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active || busy}
      className={`rounded-xl border px-4 py-3 text-sm font-black transition ${toneClasses} disabled:cursor-default disabled:opacity-45`}
    >
      {busy ? 'Aplicando…' : active ? `${label} ✓` : label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm font-bold text-slate-600">{text}</div>;
}

function roleLabel(role: string) {
  if (role === 'admin_empresa') return 'Admin empresa';
  if (role === 'encargado') return 'Encargado';
  if (role === 'asesor') return 'Asesor';
  return 'Empleado';
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}
