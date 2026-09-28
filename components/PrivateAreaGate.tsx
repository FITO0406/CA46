'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
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

type TenantCache = {
  userId: string;
  tenant: TenantPayload;
  expiresAt: number;
};

const VALIDATION_TIMEOUT_MS = 12_000;
const TENANT_CACHE_TTL_MS = 60_000;
let tenantCache: TenantCache | null = null;

async function fetchJsonWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function cachedTenantFor(userId: string) {
  if (!tenantCache || tenantCache.userId !== userId || tenantCache.expiresAt <= Date.now()) {
    if (tenantCache?.expiresAt && tenantCache.expiresAt <= Date.now()) tenantCache = null;
    return null;
  }
  return tenantCache.tenant;
}

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
  const validatedUserId = useRef<string | null>(null);
  const validationSequence = useRef(0);

  useEffect(() => {
    let mounted = true;

    function resetSession() {
      validationSequence.current += 1;
      validatedUserId.current = null;
      tenantCache = null;
      setHasSession(false);
      setAllowed(false);
      setTenant(null);
      setUserEmail('');
      setAccessError('');
      setLoading(false);
    }

    function applyTenant(session: Session, nextTenant: TenantPayload | null) {
      setHasSession(true);
      setUserEmail(session.user.email || '');
      setTenant(nextTenant);

      if (!nextTenant) {
        validatedUserId.current = requireTenant ? null : session.user.id;
        setAllowed(!requireTenant);
        if (requireTenant) {
          setAccessError('Tu usuario está autenticado, pero todavía no está vinculado a una empresa CA46. Entra en Mi empresa para completar la vinculación.');
        }
        return;
      }

      if (!nextTenant.membership?.isActive) {
        validatedUserId.current = null;
        setAllowed(false);
        setAccessError('Tu acceso a esta empresa está desactivado.');
        return;
      }

      if (!['active', 'trial'].includes(nextTenant.company.status)) {
        validatedUserId.current = null;
        setAllowed(false);
        setAccessError('Esta empresa no tiene el acceso activo en este momento.');
        return;
      }

      validatedUserId.current = session.user.id;
      setAccessError('');
      setAllowed(true);
    }

    async function validateSession(session: Session | null, blockScreen = true) {
      if (!mounted) return;

      if (!session) {
        resetSession();
        return;
      }

      // Renovaciones de token, volver de la cámara o recuperar el foco no deben
      // desmontar una zona que ya fue validada para el mismo usuario.
      if (validatedUserId.current === session.user.id) {
        setHasSession(true);
        setUserEmail(session.user.email || '');
        setLoading(false);
        return;
      }

      // Los layouts privados son hermanos en Next.js y se vuelven a montar al cambiar
      // de módulo. Reutilizamos durante un minuto una validación positiva para que la
      // navegación Mi empresa -> Etiquetas -> Cocina no enseñe un spinner en cada salto.
      const cachedTenant = cachedTenantFor(session.user.id);
      if (cachedTenant) {
        applyTenant(session, cachedTenant);
        setLoading(false);
        return;
      }

      const currentValidation = ++validationSequence.current;
      if (blockScreen) setLoading(true);
      setHasSession(true);
      setAllowed(false);
      setTenant(null);
      setAccessError('');
      setUserEmail(session.user.email || '');

      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        let { response, payload } = await fetchJsonWithTimeout('/api/tenant/me', {
          headers,
          cache: 'no-store',
        });

        if (response.status === 401) {
          if (currentValidation === validationSequence.current) {
            validatedUserId.current = null;
            tenantCache = null;
          }
          await supabase.auth.signOut();
          return;
        }

        if (!response.ok) {
          throw new Error(payload?.error || 'No se pudo validar la empresa de esta cuenta.');
        }

        let nextTenant = (payload?.tenant || null) as TenantPayload | null;

        // Compatibilidad con altas antiguas: solo crea el vínculo si el registro
        // guardó explícitamente el nombre de la empresa en los metadatos del usuario.
        if (!nextTenant && session.user.user_metadata?.company_name) {
          ({ response, payload } = await fetchJsonWithTimeout('/api/tenant/me', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: session.user.user_metadata.company_name,
              plan: session.user.user_metadata.plan || 'gratis',
            }),
          }));

          if (!response.ok) {
            throw new Error(payload?.error || 'No se pudo vincular la cuenta con su empresa.');
          }
          nextTenant = (payload?.tenant || null) as TenantPayload | null;
        }

        if (!mounted || currentValidation !== validationSequence.current) return;

        // Solo cacheamos validaciones positivas. Un usuario sin empresa debe poder
        // crearla en Mi empresa y obtener acceso al resto inmediatamente después.
        if (nextTenant?.membership?.isActive && ['active', 'trial'].includes(nextTenant.company.status)) {
          tenantCache = {
            userId: session.user.id,
            tenant: nextTenant,
            expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
          };
        }

        applyTenant(session, nextTenant);
      } catch (validationError: any) {
        if (!mounted || currentValidation !== validationSequence.current) return;
        validatedUserId.current = null;
        tenantCache = null;
        setAllowed(false);
        setAccessError(
          validationError?.name === 'AbortError'
            ? 'La validación está tardando demasiado. Comprueba la conexión y vuelve a intentarlo.'
            : validationError?.message || 'No se pudo validar el acceso multiempresa.',
        );
      } finally {
        if (mounted && currentValidation === validationSequence.current) {
          setLoading(false);
        }
      }
    }

    // getSession es la única fuente del estado inicial. Ignoramos INITIAL_SESSION
    // del listener para evitar dos validaciones simultáneas que puedan anularse entre sí.
    void supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        return validateSession(data.session, true);
      })
      .catch((sessionError: any) => {
        if (!mounted) return;
        setHasSession(false);
        setAllowed(false);
        setLoading(false);
        setAccessError(sessionError?.message || 'No se pudo recuperar la sesión.');
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !session) {
        resetSession();
        return;
      }

      if (validatedUserId.current === session.user.id) {
        setHasSession(true);
        setUserEmail(session.user.email || '');
        return;
      }

      void validateSession(session, true);
    });

    return () => {
      mounted = false;
      validationSequence.current += 1;
      subscription.subscription.unsubscribe();
    };
  }, [requireTenant]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password || signingIn) return;
    setSigningIn(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('No hemos podido entrar. Revisa email, contraseña y que hayas confirmado tu correo.');
      setSigningIn(false);
      return;
    }

    setPassword('');
    setSigningIn(false);
  }

  async function handleLogout() {
    validatedUserId.current = null;
    validationSequence.current += 1;
    tenantCache = null;
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
