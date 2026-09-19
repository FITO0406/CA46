'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AccesoPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setVerified(new URLSearchParams(window.location.search).get('verificado') === '1');
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = '/mi-empresa';
    });
  }, []);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError('No hemos podido iniciar sesión. Revisa el email, la contraseña y que hayas confirmado tu correo.');
      setLoading(false);
      return;
    }
    window.location.href = '/mi-empresa';
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0c1013]/95 p-7 shadow-2xl shadow-black/50 sm:p-9">
        <Link href="/" className="mx-auto block w-fit">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-orange-400/20 bg-black"><Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="80px" className="object-cover" /></div>
        </Link>
        <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · Área privada</p>
        <h1 className="mt-2 text-center text-3xl font-black">Entrar en CA46</h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-400">Accede con el email y la contraseña de tu empresa.</p>

        {verified ? <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[.08] px-4 py-3 text-sm font-bold text-emerald-300">✓ Email confirmado. Ya puedes entrar.</p> : null}

        <form onSubmit={handleLogin} className="mt-7 space-y-4">
          <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" className={inputClass} /></label>
          <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Contraseña</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputClass} /></label>
          {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.08] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
          <button type="submit" disabled={loading || !email.trim() || !password} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{loading ? 'Entrando…' : 'Entrar en CA46'}</button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-center text-sm font-black">
          <Link href="/recuperar-clave" className="text-slate-400 hover:text-orange-300">¿Has olvidado la contraseña?</Link>
          <Link href="/registro?plan=gratis" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white">Crear una cuenta gratis</Link>
          <Link href="/" className="text-slate-500">← Volver al inicio</Link>
        </div>
      </section>
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold text-white outline-none transition focus:border-orange-400';
