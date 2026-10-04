'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';

type Member = { user_id: string; email: string; member_role: string; active: boolean; confirmed: boolean };
export default function UsuariosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useCallback(async (method = 'GET', body?: unknown) => {
    const response = await fetch('/api/tenant/members', { method, cache: 'no-store', headers: { ...await tenantAuthorizationHeader(), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
  }, []);
  const load = useCallback(async () => { const data = await request(); setMembers(data.members); }, [request]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  async function invite(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setLink(''); setMessage('');
    try { const data = await request('POST', { email }); setLink(data.invitationUrl || data.loginUrl); setMessage(data.message); await load(); setEmail(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el acceso.'); }
    finally { setBusy(false); }
  }
  async function toggle(member: Member) {
    setBusy(true); setError('');
    try { await request('PATCH', { userId: member.user_id, active: !member.active }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el acceso.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 pb-40 text-white">
    <h1 className="text-3xl font-black">Usuarios de mi empresa</h1>
    <p>El empleado solo puede crear etiquetas de facturas de 72 horas y cajas de 24 horas. No tiene acceso al visor, historial, cocina ni configuración. Las etiquetas se guardan en el histórico de tu empresa.</p>
    <form onSubmit={invite} className="space-y-3 rounded-2xl border border-white/15 p-5">
      <label htmlFor="employee-email">Correo del empleado</label>
      <input id="employee-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl bg-black p-3" placeholder="empleado@empresa.com" />
      <button disabled={busy} className="rounded-xl bg-orange-600 px-5 py-3 font-bold disabled:opacity-50">Crear acceso / renovar invitación</button>
      <p className="text-sm text-white/60">Usa un correo diferente del administrador. La invitación se genera aquí; tú copias y entregas el enlace al empleado.</p>
    </form>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {link && <div className="space-y-3 rounded-2xl border border-green-500/40 p-5"><p>{message}</p><input aria-label="Enlace para el empleado" readOnly value={link} className="w-full rounded-xl bg-black p-3" onFocus={e => e.target.select()} /><button onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage('Enlace copiado. Entrégalo únicamente al empleado.')).catch(() => setMessage('Selecciona el enlace y cópialo manualmente.'))}>Copiar enlace</button></div>}
    <ul className="space-y-3">{members.map(member => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 p-4"><div><p>{member.email}</p><p className="text-sm text-white/60">{member.member_role === 'empleado' ? 'Empleado · solo crear etiquetas' : member.member_role} · {member.active ? 'Activo' : 'Desactivado'}{!member.confirmed ? ' · Pendiente de activación' : ''}</p></div>{member.member_role === 'empleado' && <button disabled={busy} onClick={() => void toggle(member)} className="rounded-xl border border-white/20 px-4 py-2">{member.active ? 'Desactivar' : 'Activar'}</button>}</li>)}</ul>
  </main>;
}
