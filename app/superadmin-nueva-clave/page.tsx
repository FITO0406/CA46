'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SuperAdminNuevaClavePage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    setError('');
    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (password !== repeatPassword) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError('No hemos podido guardar la nueva contraseña. Abre de nuevo el enlace de recuperación.');
      setSaving(false);
      return;
    }

    window.location.replace('/superadmin');
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-orange-400/15 bg-[#0c1013]/95 p-8 shadow-2xl shadow-black/50">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-3xl">🛡️</div>
        <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · SuperAdmin</p>
        <h1 className="mt-2 text-center text-3xl font-black">Nueva contraseña</h1>

        {!ready ? (
          <div className="mt-7 rounded-xl border border-amber-400/20 bg-amber-500/[.07] px-4 py-4 text-sm font-bold leading-6 text-amber-200">
            Abre esta pantalla desde el enlace de recuperación que recibiste por email. Si acabas de abrirlo, espera unos segundos.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Nueva contraseña</span>
              <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Repetir contraseña</span>
              <input type="password" autoComplete="new-password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" />
            </label>
            {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.07] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
            <button type="submit" disabled={saving || !password || !repeatPassword} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{saving ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
          </form>
        )}

        <a href="/superadmin" className="mt-5 block text-center text-sm font-black text-slate-500">← Volver a SuperAdmin</a>
      </section>
    </main>
  );
}
