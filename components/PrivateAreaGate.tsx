'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  children: ReactNode;
  areaName?: string;
};

export default function PrivateAreaGate({ children, areaName = 'Zona privada' }: Props) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      setAuthenticated(Boolean(session));
      setUserEmail(session?.user?.email || '');
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthenticated(Boolean(session));
      setUserEmail(session?.user?.email || '');
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSigningIn(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('Email o contraseña incorrectos.');
      setSigningIn(false);
      return;
    }

    setPassword('');
    setSigningIn(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080b0d] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-orange-400" />
          <p className="mt-4 text-sm font-bold text-slate-500">Comprobando acceso…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white selection:bg-orange-500/30">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
        <section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0c1013]/95 p-7 shadow-2xl shadow-black/50 sm:p-9">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-3xl">🔒</div>
          <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · Acceso privado</p>
          <h1 className="mt-2 text-center text-3xl font-black">{areaName}</h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-400">Introduce el email y la contraseña de tu usuario CA46 para continuar.</p>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Email</span>
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" placeholder="tu@email.com" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Contraseña</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" placeholder="••••••••" />
            </label>
            {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.07] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
            <button type="submit" disabled={signingIn || !email.trim() || !password} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{signingIn ? 'Entrando…' : 'Entrar en CA46'}</button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-slate-600">No hay registro público desde esta pantalla. Solo pueden entrar usuarios autorizados de CA46.</p>
          <a href="/" className="mt-5 block text-center text-sm font-black text-slate-400">← Volver al inicio</a>
        </section>
      </div>
    );
  }

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-[#0c1013]/95 p-2 pl-4 shadow-xl backdrop-blur-xl">
        <span className="hidden max-w-48 truncate text-xs font-bold text-slate-500 sm:block">{userEmail}</span>
        <button type="button" onClick={handleLogout} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-300">Cerrar sesión</button>
      </div>
    </>
  );
}
