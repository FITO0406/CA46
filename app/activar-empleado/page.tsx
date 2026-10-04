'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
export default function ActivarEmpleadoPage() {
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    async function activate() {
      const token = new URL(window.location.href).searchParams.get('token_hash');
      if (!token) throw new Error('Falta la invitación. Solicita el enlace a tu administrador.');
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'invite' });
      if (error || !data.session) throw new Error('La invitación ha caducado o ya fue utilizada. Solicita un enlace nuevo a tu administrador.');
      window.history.replaceState({}, '', '/activar-empleado');
      const response = await fetch('/api/tenant/me', { cache: 'no-store', headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const payload = await response.json();
      if (!response.ok || payload.tenant?.membership?.role !== 'empleado') throw new Error('Este acceso no está activo como empleado. Consulta con tu administrador.');
      setReady(true);
    }
    void activate().catch(e => setError(e.message));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setBusy(false); return; }
    window.location.replace('/empleado/etiquetas');
  }
  return <main className="mx-auto max-w-lg space-y-5 px-6 py-16 text-white"><h1 className="text-3xl font-black">Activa tu acceso de empleado</h1><p>Crearás etiquetas únicamente para la empresa que te ha dado acceso.</p>{error && <p role="alert" className="text-red-300">{error}</p>}{ready ? <form onSubmit={submit} className="space-y-4"><label className="block">Contraseña<input autoComplete="new-password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl bg-black p-3" /></label><label className="block">Repite la contraseña<input autoComplete="new-password" type="password" required minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-2 w-full rounded-xl bg-black p-3" /></label><button disabled={busy} className="rounded-xl bg-orange-600 px-5 py-3 font-bold">Guardar contraseña y crear etiquetas</button></form> : !error && <p>Comprobando invitación…</p>}</main>;
}
