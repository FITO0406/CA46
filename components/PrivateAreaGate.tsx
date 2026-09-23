'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  children: ReactNode;
  areaName?: string;
  requireTenant?: boolean;
};

type TenantPayload = {
  company: {
    id: string;
    name: string;
    plan: 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
    status: string;
  };
  membership: {
    role: string;
    isActive: boolean;
  };
};

export default function PrivateAreaGate({ children, areaName = 'Zona privada', requireTenant = true }: Props) {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [tenant, setTenant] = useState<TenantPayload | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let mounted = true;
    let validationId = 0;

    async function validateSession(session: Session | null) {
      const currentValidation = ++validationId;
      if (!mounted) return;

      setLoading(true);
      setAccessError('');
      setTenant(null);

      if (!session) {
        setHasSession(false);
        setAllowed(false);
        setUserEmail('');
        setLoading(false);
        return;
      }

      setHasSession(true);
      setUserEmail(session.user.email || '');

      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        let response = await fetch('/api/tenant/me', { headers, cache: 'no-store' });
        let payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          await supabase.auth.signOut();
          return;
        }

        if (!response.ok) {
          throw new Error(payload?.error || 'No se pudo validar la empresa de esta cuenta.');
        }

        let nextTenant = (payload?.tenant || null) as TenantPayload | null;

        // Reparación segura para cuentas creadas desde el registro que todavía no tengan vínculo.
        if (!nextTenant && session.user.user_metadata?.company_name) {
          response = await fetch('/api/tenant/me', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: session.user.user_metadata.company_name,
              plan: session.user.user_metadata.plan || 'gratis',
            }),
          });
          payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.error || 'No se pudo vincular la cuenta con su empresa.');
          nextTenant = (payload?.tenant || null) as TenantPayload | null;
        }

        if (!mounted || currentValidation !== validationId) return;
        setTenant(nextTenant);

        if (!nextTenant) {
          if (requireTenant) {
            setAllowed(false);
            setAccessError('Tu usuario está autenticado, pero todavía no está vinculado a una empresa CA46. Entra en Mi empresa para completar la vinculación.');
          } else {
            setAllowed(true);
          }
          return;
        }

        if (!nextTenant.membership?.isActive) {
          setAllowed(false);
          setAccessError('Tu acceso a esta empresa está desactivado.');
          return;
        }

        if (!['active', 'trial'].includes(nextTenant.company.status)) {
          setAllowed(false);
          setAccessError('Esta empresa no tiene el acceso activo en este momento.');
          return;
        }

        setAllowed(true);
      } catch (validationError: any) {
        if (!mounted || currentValidation !== validationId) return;
        setAllowed(false);
        setAccessError(validationError?.message || 'No se pudo validar el acceso multiempresa.');
      } finally {
        if (mounted && currentValidation === validationId) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => validateSession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void validateSession(session);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [requireTenant]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSigningIn(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (signInError) {
      setError('No hemos podido entrar. Revisa email, contraseña y que hayas confirmado tu correo.');
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
          <p className="mt-4 text-sm font-bold text-slate-500">Validando usuario y empresa…</p>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white selection:bg-orange-500/30">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
        <section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0c1013]/95 p-7 shadow-2xl shadow-black/50 sm:p-9">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-3xl">🔒</div>
          <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · Acceso multiempresa</p>
          <h1 className="mt-2 text-center text-3xl font-black">{areaName}</h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-400">Introduce el email y la contraseña de tu cuenta. CA46 comprobará también a qué empresa perteneces antes de dejarte entrar.</p>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
            <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Email</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" placeholder="tu@email.com" /></label>
            <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold outline-none focus:border-orange-400" placeholder="••••••••" /></label>
            {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.07] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
            <button type="submit" disabled={signingIn || !email.trim() || !password} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{signingIn ? 'Validando…' : 'Entrar en CA46'}</button>
          </form>

          <div className="mt-5 flex flex-col gap-3 text-center text-sm font-black">
            <a href="/recuperar-clave" className="text-slate-400">¿Has olvidado tu contraseña?</a>
            <a href="/registro?plan=gratis" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white">Crear una cuenta gratis</a>
            <a href="/planes" className="text-orange-300">Ver planes CA46</a>
            <Link href="/" className="text-slate-500">← Volver al inicio</Link>
          </div>
        </section>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="relative grid min-h-screen place-items-center bg-[#080b0d] px-5 py-10 text-white">
        <section className="w-full max-w-lg rounded-[2rem] border border-amber-400/20 bg-[#0c1013] p-7 text-center shadow-2xl sm:p-9">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-400/10 text-3xl">🏢</div>
          <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-amber-300">CA46 · Validación de empresa</p>
          <h1 className="mt-2 text-3xl font-black">Acceso pendiente</h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">{accessError || 'No se pudo validar la empresa asociada a este usuario.'}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a href="/mi-empresa" className="rounded-xl bg-orange-500 px-5 py-3 font-black text-[#111416]">Ir a Mi empresa</a>
            <button type="button" onClick={handleLogout} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-black text-slate-300">Cerrar sesión</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-[#0c1013]/95 p-2 pl-4 shadow-xl backdrop-blur-xl">
        {tenant?.company?.name ? <span className="hidden max-w-40 truncate text-xs font-black text-orange-300 md:block">{tenant.company.name}</span> : null}
        <span className="hidden max-w-48 truncate text-xs font-bold text-slate-500 sm:block">{userEmail}</span>
        <button type="button" onClick={handleLogout} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-300">Cerrar sesión</button>
      </div>
    </>
  );
}
