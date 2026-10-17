'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
type Receipt = { id: string; kind: string; message: string; status: string; response: string; created_at: string; due_at: string | null; requester_email?: string };
const labels: Record<string, string> = { soporte: 'Soporte', derechos: 'Ejercicio de derechos personales', baja: 'Baja de empresa', exportacion: 'Devolución completa de datos', restauracion: 'Consulta de restauración' };
export default function ServiceRequests({ administration = false }: { administration?: boolean }) {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [admin, setAdmin] = useState(false);
  const [kind, setKind] = useState('soporte');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const endpoint = administration ? '/api/superadmin/service-requests' : '/api/service-requests';
  const authHeaders = async () => ({ Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}` });
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { headers: await authHeaders(), cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setRows(body.requests || []); setAdmin(Boolean(body.canManageCompany));
  }, [endpoint]);
  useEffect(() => { let mounted = true; void (async () => {
    try {
      const response = await fetch(endpoint, { headers: await authHeaders(), cache: 'no-store' });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      if (mounted) { setRows(body.requests || []); setAdmin(Boolean(body.canManageCompany)); }
    } catch (error) { if (mounted) setFeedback(error instanceof Error ? error.message : 'No se pudo consultar.'); }
  })(); return () => { mounted = false; }; }, [endpoint]);
  async function send() {
    if (busy) return;
    setBusy(true); setFeedback('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { ...await authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, message }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setFeedback(`${body.message} Justificante: ${body.request.id}`); setMessage(''); await load();
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'No se pudo registrar.'); }
    finally { setBusy(false); }
  }
  async function update(id: string, status: string) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { ...await authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, response: responses[id] ?? rows.find(row => row.id === id)?.response ?? '' }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setFeedback('Seguimiento registrado. El estado no ejecuta un borrado ni una restauración.'); await load();
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/company-export', { headers: await authHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = 'ca46-datos-operativos.json'; a.click(); URL.revokeObjectURL(url);
      setFeedback('Descarga operativa preparada. Solicita la devolución asistida si necesitas el conjunto completo.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'No se pudo descargar.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-6 p-6 text-slate-200"><h1 className="text-3xl font-black">{administration ? 'Solicitudes de clientes' : 'Datos y solicitudes'}</h1>
    <div className="flex gap-5 text-orange-300 underline"><Link href="/acceso">Acceso</Link><Link href="/soporte">Soporte por correo</Link><Link href="/aceptar-condiciones">Contrato</Link></div>
    <p>{administration ? 'Se muestran hasta 200 solicitudes pendientes o en revisión, ordenadas por recepción. Registrar una respuesta no envía un correo; el cliente la consulta en su área. Documenta la actuación antes de resolver.' : 'Puedes solicitar soporte y ejercer tus derechos personales. El administrador también puede pedir la baja, una devolución completa o estudiar la restauración. No incluyas contraseñas, tokens ni documentos sensibles.'}</p>
    {feedback && <p role="status" className="rounded-xl border border-orange-400/40 p-4">{feedback}</p>}
    {!administration && <section className="space-y-4 rounded-xl border border-white/20 p-5">
      {admin && <><button disabled={busy} onClick={() => void download()} className="rounded-xl border px-4 py-3 disabled:opacity-40">Descargar datos operativos (JSON)</button><p className="text-sm">Incluye etiquetas, cocina, temperaturas, configuración y referencias de archivos. No incluye los originales de Drive, facturación ni conversaciones de IA; no es una copia de seguridad. Para devolución completa utiliza la solicitud correspondiente.</p></>}
      <label className="block">Tipo de solicitud<select value={kind} onChange={e => setKind(e.target.value)} className="mt-2 block w-full rounded-xl bg-slate-900 p-3">{Object.entries(labels).filter(([key]) => admin || ['soporte', 'derechos'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block">Detalle<textarea value={message} onChange={e => setMessage(e.target.value)} minLength={10} maxLength={4000} rows={5} className="mt-2 block w-full rounded-xl bg-slate-900 p-3" /></label>
      <p className="text-sm">La solicitud de baja no borra inmediatamente los datos. Las solicitudes de derechos se atienden, con carácter general, en un mes; cualquier ampliación o denegación debe justificarse y comunicarse.</p>
      <button disabled={busy || message.trim().length < 10} onClick={() => void send()} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-black disabled:opacity-40">{busy ? 'Procesando…' : 'Registrar solicitud'}</button>
    </section>}
    <h2 className="text-xl font-bold">{administration ? 'Bandeja de trabajo' : 'Mis solicitudes (últimas 100)'}</h2>
    {rows.length === 0 && <p>No hay solicitudes para mostrar.</p>}
    {rows.map(row => <article key={row.id} className="space-y-3 rounded-xl border border-white/20 p-5"><h3 className="font-bold">{labels[row.kind]} · {row.status}</h3><p className="break-all text-sm">Justificante: {row.id} · {new Date(row.created_at).toLocaleString('es-ES')}{row.requester_email && ` · ${row.requester_email}`}</p>{row.due_at && <p>Referencia de respuesta: {new Date(row.due_at).toLocaleDateString('es-ES')}</p>}<p className="whitespace-pre-wrap">{row.message}</p>{row.response && <p className="whitespace-pre-wrap border-l-2 border-orange-400 pl-3">Respuesta: {row.response}</p>}
      {administration && <div className="space-y-3"><label className="block">Respuesta visible al solicitante<textarea rows={3} maxLength={4000} value={responses[row.id] ?? row.response} onChange={e => setResponses({ ...responses, [row.id]: e.target.value })} className="mt-2 w-full rounded-xl bg-slate-900 p-3" /></label><div className="flex gap-3"><button disabled={busy} onClick={() => void update(row.id, 'en_revision')} className="rounded-xl border p-3">Marcar en revisión</button><button disabled={busy || (responses[row.id] ?? row.response).trim().length < 10} onClick={() => void update(row.id, 'resuelta')} className="rounded-xl border p-3 disabled:opacity-40">Registrar resolución</button></div></div>}
    </article>)}
  </main>;
}
