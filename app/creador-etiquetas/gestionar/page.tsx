'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { decodeTraceability } from '@/lib/traceability';
import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';

type LabelRow = {
  id: string;
  product_name: string;
  origin: string | null;
  category: string;
  source: 'invoice' | 'physical_label' | 'legacy' | null;
  status: 'definitive' | 'provisional' | null;
  is_active: boolean;
  created_at: string;
  expires_at: string;
  annulled_at: string | null;
  annulled_reason: string | null;
  annulled_note: string | null;
};

type ViewMode = 'active' | 'annulled';

const REASONS = [
  ['wrong', 'Etiqueta equivocada'],
  ['duplicate', 'Etiqueta duplicada'],
  ['reading', 'Lectura incorrecta'],
  ['other', 'Otro motivo'],
] as const;

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-ES');
}

export default function GestionarEtiquetasPage() {
  const [view, setView] = useState<ViewMode>('active');
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('wrong');
  const [note, setNote] = useState('');
  const [annulling, setAnnulling] = useState(false);
  const [success, setSuccess] = useState('');

  const selected = useMemo(() => labels.find((label) => label.id === selectedId) || null, [labels, selectedId]);

  const load = useCallback(async (nextView: ViewMode = view) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/manage-labels?state=${nextView}`, {
        headers: await tenantAuthorizationHeader(),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudieron cargar las etiquetas.');
      setLabels(Array.isArray(payload?.labels) ? payload.labels : []);
    } catch (requestError: any) {
      setError(requestError?.message || 'No se pudieron cargar las etiquetas.');
      setLabels([]);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load(view);
  }, [load, view]);

  function changeView(nextView: ViewMode) {
    setView(nextView);
    setSelectedId('');
    setSuccess('');
  }

  function openAnnul(label: LabelRow) {
    setSelectedId(label.id);
    setReason('wrong');
    setNote('');
    setError('');
    setSuccess('');
  }

  async function annul() {
    if (!selected || annulling) return;
    if (reason === 'other' && note.trim().length < 3) {
      setError('Indica brevemente el motivo de la anulación.');
      return;
    }

    const trace = decodeTraceability(selected.category);
    const product = trace?.description || selected.product_name;
    const lot = trace?.lot || 'sin lote visible';
    const confirmed = window.confirm(`Vas a anular ${product} · lote ${lot}.\n\nLa etiqueta desaparecerá del visor, pero quedará registrada en el historial. ¿Continuar?`);
    if (!confirmed) return;

    setAnnulling(true);
    setError('');
    try {
      const response = await fetch('/api/manage-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await tenantAuthorizationHeader()) },
        body: JSON.stringify({ id: selected.id, reason, note }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudo anular la etiqueta.');

      setLabels((current) => current.filter((label) => label.id !== selected.id));
      setSuccess(`Etiqueta anulada: ${product}. Ya no aparecerá en el visor.`);
      setSelectedId('');
      setNote('');
    } catch (requestError: any) {
      setError(requestError?.message || 'No se pudo anular la etiqueta.');
    } finally {
      setAnnulling(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-rose-300">Control de etiquetas</p>
            <h1 className="mt-2 text-4xl font-black sm:text-5xl">Gestionar y anular</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Una etiqueta anulada desaparece del visor inmediatamente, pero se conserva en el historial con fecha, usuario y motivo. No se borra la trazabilidad.
            </p>
          </div>
          <Link href="/etiquetas" className="rounded-xl border border-emerald-400/25 bg-emerald-400/[.06] px-4 py-3 text-sm font-black text-emerald-300">👁️ Abrir visor</Link>
        </section>

        <div className="mt-8 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-2 sm:max-w-md">
          <button onClick={() => changeView('active')} className={`rounded-xl px-4 py-3 text-sm font-black ${view === 'active' ? 'bg-emerald-400 text-black' : 'text-slate-400'}`}>Activas</button>
          <button onClick={() => changeView('annulled')} className={`rounded-xl px-4 py-3 text-sm font-black ${view === 'annulled' ? 'bg-rose-400 text-black' : 'text-slate-400'}`}>Historial anuladas</button>
        </div>

        {success ? <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.07] px-5 py-4 text-sm font-bold text-emerald-200">✓ {success}</div> : null}
        {error ? <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/[.07] px-5 py-4 text-sm font-bold text-rose-200">{error}</div> : null}

        <section className="mt-7 space-y-4">
          {loading ? <div className="rounded-2xl border border-white/10 bg-white/[.03] p-8 text-center font-black text-slate-500">Cargando etiquetas…</div> : null}

          {!loading && labels.map((label) => {
            const trace = decodeTraceability(label.category);
            const product = trace?.description || label.product_name;
            const isTemporary = label.status === 'provisional' || label.source === 'physical_label';

            return (
              <article key={label.id} className={`rounded-2xl border p-5 ${label.annulled_at ? 'border-rose-400/20 bg-rose-400/[.04]' : 'border-white/10 bg-white/[.035]'}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] ${isTemporary ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>
                        {isTemporary ? 'Temporal · 24 h' : 'Factura · 72 h'}
                      </span>
                      {label.annulled_at ? <span className="rounded-full bg-rose-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-rose-300">Anulada</span> : null}
                    </div>
                    <h2 className="mt-3 truncate text-2xl font-black uppercase">{product}</h2>
                    <div className="mt-2 grid gap-1 text-sm text-slate-400 sm:grid-cols-2 sm:gap-x-8">
                      <p>Lote: <strong className="text-white">{trace?.lot || '—'}</strong></p>
                      <p>Procedencia: <strong className="text-white">{trace?.origin || label.origin || '—'}</strong></p>
                      <p>Creada: <strong className="text-slate-300">{formatDate(label.created_at)}</strong></p>
                      <p>Caduca: <strong className="text-slate-300">{formatDate(label.expires_at)}</strong></p>
                    </div>
                    {label.annulled_at ? (
                      <div className="mt-4 rounded-xl border border-rose-400/15 bg-black/20 px-4 py-3 text-sm">
                        <p><strong className="text-rose-200">Motivo:</strong> {label.annulled_reason || '—'}</p>
                        {label.annulled_note ? <p className="mt-1 text-slate-400">{label.annulled_note}</p> : null}
                        <p className="mt-1 text-xs text-slate-500">Anulada: {formatDate(label.annulled_at)}</p>
                      </div>
                    ) : null}
                  </div>

                  {!label.annulled_at ? (
                    <button onClick={() => openAnnul(label)} className="shrink-0 rounded-xl border border-rose-400/30 bg-rose-400/[.08] px-5 py-3 text-sm font-black text-rose-200">
                      🗑️ Anular etiqueta
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}

          {!loading && labels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-slate-400">
              {view === 'active' ? 'No hay etiquetas activas para gestionar.' : 'Todavía no hay etiquetas anuladas.'}
            </div>
          ) : null}
        </section>

        {selected ? (
          <section className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-4 backdrop-blur-sm sm:place-items-center">
            <div className="w-full max-w-xl rounded-[2rem] border border-rose-400/25 bg-[#111416] p-6 shadow-2xl sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.2em] text-rose-300">Anular etiqueta</p>
              <h2 className="mt-2 text-3xl font-black">{decodeTraceability(selected.category)?.description || selected.product_name}</h2>
              <p className="mt-2 text-sm text-slate-400">Lote: {decodeTraceability(selected.category)?.lot || '—'}</p>

              <label className="mt-6 block text-xs font-black uppercase tracking-[.15em] text-slate-500">Motivo</label>
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-bold outline-none focus:border-rose-400">
                {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>

              <label className="mt-5 block text-xs font-black uppercase tracking-[.15em] text-slate-500">Nota opcional</label>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Ej.: lote leído incorrectamente…" className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-bold outline-none focus:border-rose-400" />

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setSelectedId('')} disabled={annulling} className="rounded-xl border border-white/10 px-5 py-3 font-black text-slate-300">Cancelar</button>
                <button onClick={annul} disabled={annulling} className="rounded-xl bg-rose-500 px-5 py-3 font-black text-white disabled:opacity-50">{annulling ? 'Anulando…' : 'Confirmar anulación'}</button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
