'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Message = { id: string; role: 'user' | 'assistant'; content: string; created_at: string; sources?: Array<{ tool: string; checkedAt: string }> };
type Snapshot = {
  checkedAt: string;
  companies: { total: number; active: number; trial: number; suspended: number };
  operations: { activeMembers: number; activeTags: number; equipment: number; temperatureAlerts24h: number };
  billing: { subscriptions: number; unpaid: number; pending: number; stripeReady: boolean };
  incidents: Array<{ severity: string; title: string; detail: string }>;
};
type StatusPayload = { ok: boolean; enabled: boolean; openAIConfigured: boolean; snapshot: Snapshot; pendingActions: Array<{ id: string; code: string; summary: string; risk_level: string }>; recentAudit: Array<{ id: number; occurred_at: string; action_key: string; result_status: string }>; error?: string };

function authToken() { return supabase.auth.getSession().then(({ data }) => data.session?.access_token || ''); }

export default function DirectorPage() {
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pendingActions, setPendingActions] = useState<StatusPayload['pendingActions']>([]);
  const [recentAudit, setRecentAudit] = useState<StatusPayload['recentAudit']>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const token = await authToken();
      if (!token) throw new Error('No hay una sesión SuperAdmin disponible.');
      const headers = { Authorization: `Bearer ${token}` };
      const [statusResponse, historyResponse] = await Promise.all([
        fetch('/api/superadmin/director/status', { cache: 'no-store', headers }),
        fetch('/api/superadmin/director/history', { cache: 'no-store', headers }),
      ]);
      const status = await statusResponse.json() as StatusPayload;
      const history = await historyResponse.json();
      if (!statusResponse.ok || !status.ok) throw new Error(status.error || 'No se pudo cargar el Director.');
      if (!historyResponse.ok || !history.ok) throw new Error(history.error || 'No se pudo cargar el historial.');
      setEnabled(status.enabled); setConfigured(status.openAIConfigured); setSnapshot(status.snapshot);
      setPendingActions(status.pendingActions || []); setRecentAudit(status.recentAudit || []); setMessages(history.messages || []);
    } catch (loadError: any) { setError(loadError?.message || 'No se pudo cargar DIRECTOR CA46.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  async function toggleDirector() {
    setSwitching(true); setError('');
    try {
      const token = await authToken();
      const response = await fetch('/api/superadmin/director/status', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo cambiar el estado.');
      setEnabled(payload.enabled); await load();
    } catch (toggleError: any) { setError(toggleError?.message || 'No se pudo cambiar el estado.'); }
    finally { setSwitching(false); }
  }

  async function sendMessage(event?: FormEvent, forcedMessage?: string) {
    event?.preventDefault();
    const content = String(forcedMessage ?? input).trim();
    if (!content || sending || !enabled) return;
    setInput(''); setSending(true); setError('');
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() }]);
    try {
      const token = await authToken();
      const response = await fetch('/api/superadmin/director/chat', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: content }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'El Director no pudo responder.');
      setMessages((current) => [...current, payload.message]);
      if (payload.snapshot) setSnapshot(payload.snapshot);
      if (speakReplies && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(payload.message.content); speech.lang = 'es-ES'; window.speechSynthesis.speak(speech);
      }
    } catch (sendError: any) { setError(sendError?.message || 'No se pudo enviar el mensaje.'); }
    finally { setSending(false); }
  }

  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('El reconocimiento de voz no está disponible en este navegador. Puedes usar el teclado del móvil.'); return; }
    const recognition = new SpeechRecognition(); recognition.lang = 'es-ES'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setError('No se pudo reconocer la voz. Revisa el permiso del micrófono.'); };
    recognition.onresult = (event: any) => setInput(String(event.results?.[0]?.[0]?.transcript || '')); recognition.start();
  }

  return (
    <div className="min-h-screen bg-[#070a0c] text-white">
      <header className="border-b border-white/10 bg-[#0b1013] px-5 py-4"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-orange-400/20 bg-black"><Image src="/ca46-logo.svg" alt="CA46" fill sizes="44px" className="object-cover" /></div><div><h1 className="text-xl font-black">DIRECTOR CA46</h1><p className="text-xs font-bold text-slate-500">Dirección digital · exclusivo SuperAdmin</p></div></div>
        <button type="button" onClick={() => void toggleDirector()} disabled={loading || switching} aria-pressed={enabled} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black transition ${enabled ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/30 bg-rose-400/10 text-rose-300'}`}><span className={`relative h-6 w-11 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} /></span>{switching ? 'Cambiando…' : enabled ? 'DIRECTOR ENCENDIDO' : 'DIRECTOR APAGADO'}</button>
      </div></header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-h-[72vh] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1215]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Conversación principal</p><p className="mt-1 text-sm text-slate-500">Una sola conversación con historial y datos actuales.</p></div><div className="flex gap-2"><button type="button" onClick={() => void sendMessage(undefined, 'Buenos días Director, comenzamos la reunión.')} disabled={!enabled || sending} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-xs font-black text-orange-300 disabled:opacity-40">Reunión diaria</button><button type="button" onClick={() => setSpeakReplies((value) => !value)} className={`rounded-xl border px-3 py-2 text-xs font-black ${speakReplies ? 'border-sky-400/30 bg-sky-400/10 text-sky-300' : 'border-white/10 bg-white/5 text-slate-400'}`}>🔊 Voz {speakReplies ? 'activa' : 'apagada'}</button></div></div>
          {!enabled ? <div className="m-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] p-5"><p className="font-black text-rose-300">DIRECTOR CA46 está apagado manualmente</p><p className="mt-2 text-sm leading-6 text-slate-400">No conversa, no prepara reuniones y no ejecuta herramientas. Las pantallas manuales de SuperAdmin continúan disponibles.</p></div> : null}
          {!configured ? <div className="mx-5 mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-sm text-amber-200"><strong>Modo seguro estructurado:</strong> falta configurar OpenAI en Vercel. Las consultas verificadas funcionan, pero la conversación avanzada se activará al añadir la clave.</div> : null}
          {error ? <div className="mx-5 mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] p-4 text-sm font-bold text-rose-300">{error}</div> : null}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {!loading && messages.length === 0 ? <div className="mx-auto max-w-xl py-16 text-center"><div className="text-5xl">◉</div><h2 className="mt-5 text-2xl font-black">Buenos días, Fito</h2><p className="mt-3 leading-7 text-slate-500">Pregunta por empresas, incidencias, temperaturas o estado general. También puedes comenzar la reunión diaria.</p></div> : null}
            {messages.map((message) => <article key={message.id} className={`max-w-3xl rounded-2xl px-4 py-3 ${message.role === 'user' ? 'ml-auto bg-orange-500 text-black' : 'border border-white/10 bg-black/25 text-slate-200'}`}><p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>{message.sources?.length ? <p className="mt-3 border-t border-white/10 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Datos verificados · {new Date(message.sources[0].checkedAt).toLocaleString('es-ES')}</p> : null}</article>)}
            {sending ? <div className="w-fit rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-slate-400">DIRECTOR CA46 está analizando datos reales…</div> : null}<div ref={bottomRef} />
          </div>
          <form onSubmit={(event) => void sendMessage(event)} className="border-t border-white/10 p-4"><div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/25 p-2 focus-within:border-orange-400/30"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} disabled={!enabled || sending} rows={2} maxLength={4000} placeholder={enabled ? 'Habla con DIRECTOR CA46…' : 'Enciende el Director para conversar'} className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-700 disabled:opacity-40" /><button type="button" onClick={startVoice} disabled={!enabled || sending} title="Hablar" className={`h-11 w-11 rounded-xl text-lg disabled:opacity-30 ${listening ? 'animate-pulse bg-rose-500' : 'border border-white/10 bg-white/5'}`}>🎙️</button><button type="submit" disabled={!enabled || sending || !input.trim()} className="h-11 rounded-xl bg-orange-500 px-5 text-sm font-black text-black disabled:opacity-30">Enviar</button></div><p className="mt-2 text-center text-[10px] font-bold text-slate-700">El Director puede equivocarse. Los cambios sensibles siempre requieren autorización específica.</p></form>
        </section>
        <aside className="space-y-4">
          <Panel title="Estado general" badge={snapshot ? new Date(snapshot.checkedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'}><div className="grid grid-cols-2 gap-2"><Kpi label="Empresas" value={snapshot?.companies.total ?? '—'} /><Kpi label="Activas" value={snapshot?.companies.active ?? '—'} /><Kpi label="Usuarios" value={snapshot?.operations.activeMembers ?? '—'} /><Kpi label="Etiquetas" value={snapshot?.operations.activeTags ?? '—'} /></div><div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-xs"><span className="font-bold text-slate-400">OpenAI</span><span className={configured ? 'font-black text-emerald-300' : 'font-black text-amber-300'}>{configured ? 'Conectado' : 'Pendiente'}</span></div></Panel>
          <Panel title="Alertas importantes" badge={String(snapshot?.incidents.length ?? 0)}>{snapshot?.incidents.length ? <div className="space-y-2">{snapshot.incidents.slice(0, 5).map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black text-amber-300">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></div>)}</div> : <Empty text="Sin alertas detectadas" />}</Panel>
          <Panel title="Autorizaciones" badge={String(pendingActions.length)}>{pendingActions.length ? pendingActions.map((item) => <div key={item.id} className="rounded-xl border border-amber-400/15 p-3 text-xs"><p className="font-black text-amber-300">{item.code}</p><p className="mt-1 text-slate-400">{item.summary}</p></div>) : <Empty text="No hay acciones pendientes" />}</Panel>
          <Panel title="Actividad reciente" badge={String(recentAudit.length)}>{recentAudit.length ? <div className="space-y-2">{recentAudit.slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-bold text-slate-400">{item.action_key.replaceAll('_', ' ')}</span><span className="text-slate-700">{new Date(item.occurred_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span></div>)}</div> : <Empty text="Sin actividad registrada" />}</Panel>
        </aside>
      </main>
    </div>
  );
}

function Panel({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) { return <section className="rounded-[1.5rem] border border-white/10 bg-[#0d1215] p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black">{title}</h2><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-500">{badge}</span></div>{children}</section>; }
function Kpi({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs font-bold text-slate-600">{text}</p>; }
