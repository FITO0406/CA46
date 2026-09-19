'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SuperAdminRecuperarPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || sending) return;

    setSending(true);
    setMessage('');
    setError('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/superadmin-nueva-clave`,
    });

    if (resetError) {
      setError('No hemos podido enviar el enlace de recuperación.');
      setSending(false);
      return;
    }

    setMessage('Te hemos enviado un enlace para crear una nueva contraseña. Revisa también Spam o Promociones.');
    setSending(false);
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-orange-400/15 bg-[#0c1013]/95 p-8 shadow-2xl shadow-black/50">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-3xl">🔐</div>
        <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · SuperAdmin</p>
        <h1 className="mt-2 text-center text-3xl font-black">Recuperar acceso</h1>
        <p className="mt-3 text-center text-sm leading-6 text-slate-400">Introduce el email de tu cuenta SuperAdmin. Te enviaremos un enlace para crear una nueva contraseña.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" />
          </label>
          {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.07] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
          {message ? <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/[.07] px-4 py-3 text-sm font-bold text-emerald-300">{message}</p> : null}
          <button type="submit" disabled={sending || !email.trim()} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{sending ? 'Enviando…' : 'Enviar enlace de recuperación'}</button>
        </form>

        <a href="/superadmin" className="mt-5 block text-center text-sm font-black text-slate-500">← Volver a SuperAdmin</a>
      </section>
    </main>
  );
}
