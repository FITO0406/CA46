'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function NuevaClavePage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setReady(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || password.length < 8 || password !== confirm) return;
    setLoading(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError('No se pudo cambiar la contraseña. Abre de nuevo el enlace de recuperación.');
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0c1013]/95 p-7 shadow-2xl shadow-black/50 sm:p-9">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-3xl">🔐</div>
        <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · Seguridad</p>
        <h1 className="mt-2 text-center text-3xl font-black">Nueva contraseña</h1>

        {!ready && !done ? <p className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[.08] px-4 py-3 text-sm font-bold text-amber-300">Abre esta página desde el enlace de recuperación enviado a tu email.</p> : null}

        {!done ? (
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Nueva contraseña</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" placeholder="Mínimo 8 caracteres" /></label>
            <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Repite la contraseña</span><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" /></label>
            {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.08] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
            <button type="submit" disabled={!ready || loading || password.length < 8 || password !== confirm} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{loading ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
          </form>
        ) : (
          <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.08] p-5 text-center"><p className="font-black text-emerald-300">✓ Contraseña actualizada</p><Link href="/acceso" className="mt-3 inline-flex font-black text-white">Entrar en CA46 →</Link></div>
        )}

        <Link href="/acceso" className="mt-6 block text-center text-sm font-black text-slate-400">← Volver al acceso</Link>
      </section>
    </div>
  );
}
