'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RecuperarClavePage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-clave`,
    });
    if (resetError) {
      setError('No se pudo enviar el correo de recuperación. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0c1013]/95 p-7 shadow-2xl shadow-black/50 sm:p-9">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-3xl">🔑</div>
        <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · Seguridad</p>
        <h1 className="mt-2 text-center text-3xl font-black">Recuperar contraseña</h1>
        <p className="mt-3 text-center text-sm leading-6 text-slate-400">Te enviaremos un enlace para elegir una nueva contraseña.</p>

        {!sent ? (
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" /></label>
            {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.08] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
            <button type="submit" disabled={loading || !email.trim()} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{loading ? 'Enviando…' : 'Enviar enlace de recuperación'}</button>
          </form>
        ) : (
          <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.08] p-5 text-center"><p className="font-black text-emerald-300">✓ Correo enviado</p><p className="mt-2 text-sm leading-6 text-slate-400">Revisa tu bandeja de entrada y abre el enlace de CA46.</p></div>
        )}

        <Link href="/acceso" className="mt-6 block text-center text-sm font-black text-slate-400">← Volver al acceso</Link>
      </section>
    </div>
  );
}
