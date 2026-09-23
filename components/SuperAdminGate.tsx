'use client';

import type { ReactNode } from 'react';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type Props = { children: ReactNode };

type SuperAdminPayload = {
  userId: string;
  email: string;
  displayName: string;
};

export default function SuperAdminGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [admin, setAdmin] = useState<SuperAdminPayload | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    let validationId = 0;

    async function validate(nextSession: Session | null) {
      const currentValidation = ++validationId;
      if (!mounted) return;

      setLoading(true);
      setSession(nextSession);
      setAllowed(false);
      setAdmin(null);
      setError('');

      if (!nextSession) {
        setLoading(false);
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${nextSession.access_token}` };
        let response = await fetch('/api/superadmin/me', { cache: 'no-store', headers });
        let payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          await supabase.auth.signOut();
          return;
        }

        if (response.status === 403) {
          const bootstrap = await fetch('/api/superadmin/bootstrap', {
            method: 'POST',
            cache: 'no-store',
            headers,
          });
          const bootstrapPayload = await bootstrap.json().catch(() => ({}));
          if (bootstrap.ok) {
            response = bootstrap;
            payload = bootstrapPayload;
          }
        }

        if (!mounted || currentValidation !== validationId) return;

        if (!response.ok) {
          setAllowed(false);
          setError(payload?.error || 'Esta cuenta no tiene acceso SuperAdmin.');
          return;
        }

        setAdmin(payload.superAdmin || null);
        setAllowed(true);
      } catch (validationError: any) {
        if (!mounted || currentValidation !== validationId) return;
        setAllowed(false);
        setError(validationError?.message || 'No se pudo validar SuperAdmin.');
      } finally {
        if (mounted && currentValidation === validationId) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => validate(data.session));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void validate(nextSession);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password || signingIn || creating) return;
    setSigningIn(true);
    setError('');
    setMessage('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('No hemos podido iniciar sesión. Si es tu primer acceso, pulsa “Crear acceso SuperAdmin”.');
      setSigningIn(false);
      return;
    }

    setPassword('');
    setSigningIn(false);
  }

  async function handleCreateAccess() {
    if (!email.trim() || !password || signingIn || creating) return;
    setCreating(true);
    setError('');
    setMessage('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/superadmin`,
        data: {
          role: 'superadmin',
          signup_source: 'ca46_superadmin',
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message || 'No se pudo crear el acceso SuperAdmin.');
      setCreating(false);
      return;
    }

    if (!data.session) {
      setMessage('Cuenta creada. Confirma el correo y vuelve a entrar como SuperAdmin.');
    }

    setPassword('');
    setCreating(false);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080b0d] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-orange-400" />
          <p className="mt-4 text-sm font-bold text-slate-500">Validando SuperAdmin…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
        <section className="relative w-full max-w-md rounded-[2rem] border border-orange-400/15 bg-[#0c1013]/95 p-8 shadow-2xl shadow-black/50">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-3xl">🛡️</div>
          <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · Administración global</p>
          <h1 className="mt-2 text-center text-3xl font-black">SuperAdmin</h1>
          <p className="mt-3 text-center text-sm leading-6 text-slate-400">Solo los emails autorizados pueden crear o usar un acceso SuperAdmin.</p>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
            <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Email</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" /></label>
            <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" /></label>
            {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.07] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
            {message ? <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/[.07] px-4 py-3 text-sm font-bold text-emerald-300">{message}</p> : null}
            <button type="submit" disabled={signingIn || creating || !email.trim() || !password} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{signingIn ? 'Validando…' : 'Entrar como SuperAdmin'}</button>
            <button type="button" onClick={handleCreateAccess} disabled={signingIn || creating || !email.trim() || !password} className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 font-black text-white disabled:text-slate-600">{creating ? 'Creando acceso…' : 'Primer acceso · Crear SuperAdmin'}</button>
          </form>
          <Link href="/" className="mt-5 block text-center text-sm font-black text-slate-500">← Volver a CA46</Link>
        </section>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080b0d] px-5 text-white">
        <section className="w-full max-w-lg rounded-[2rem] border border-rose-400/20 bg-[#0c1013] p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/10 text-3xl">⛔</div>
          <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-rose-300">Acceso denegado</p>
          <h1 className="mt-2 text-3xl font-black">No eres SuperAdmin</h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">{error || 'Esta cuenta no está autorizada para administrar todas las empresas.'}</p>
          <button type="button" onClick={logout} className="mt-6 w-full rounded-xl bg-orange-500 px-5 py-3 font-black text-black">Cerrar sesión y usar otra cuenta</button>
        </section>
      </div>
    );
  }

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full border border-orange-400/20 bg-[#0c1013]/95 p-2 pl-4 shadow-2xl backdrop-blur-xl">
        <span className="hidden text-xs font-black text-orange-300 sm:block">{admin?.displayName || 'SuperAdmin'}</span>
        <span className="hidden max-w-48 truncate text-xs font-bold text-slate-500 md:block">{admin?.email}</span>
        <button type="button" onClick={logout} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-300">Cerrar sesión</button>
      </div>
    </>
  );
}
