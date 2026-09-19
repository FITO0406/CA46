'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export default function SuperAdminNuevaClavePage() {
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function validateSuperAdmin(session: Session | null) {
      if (!session || !mounted) return false;
      const response = await fetch('/api/superadmin/me', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!mounted) return false;
      if (!response.ok) {
        setError('El enlace no corresponde a una cuenta SuperAdmin activa.');
        return false;
      }
      setReady(true);
      setError('');
      return true;
    }

    async function initialiseRecovery() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        const authError = hash.get('error_description') || url.searchParams.get('error_description');
        if (authError) {
          setError('El enlace de recuperación ha caducado o ya fue utilizado. Solicita uno nuevo.');
          return;
        }

        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError || !data.session) {
            setError('No hemos podido activar el enlace. Solicita uno nuevo desde Recuperar acceso.');
            return;
          }
          await validateSuperAdmin(data.session);
          window.history.replaceState({}, document.title, '/superadmin-nueva-clave');
          return;
        }

        const code = url.searchParams.get('code');
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError || !data.session) {
            setError('No hemos podido validar este enlace. Solicita un enlace nuevo y ábrelo en el mismo navegador donde lo pediste.');
            return;
          }
          await validateSuperAdmin(data.session);
          window.history.replaceState({}, document.title, '/superadmin-nueva-clave');
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const valid = await validateSuperAdmin(data.session);
          if (valid) return;
        }

        setError('Este enlace no ha creado una sesión de recuperación. Solicita un enlace nuevo desde CA46.');
      } catch {
        if (mounted) setError('No hemos podido validar el enlace de recuperación. Solicita uno nuevo.');
      } finally {
        if (mounted) setChecking(false);
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        void validateSuperAdmin(session).finally(() => {
          if (mounted) setChecking(false);
        });
      }
    });

    void initialiseRecovery();

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
      setError('No hemos podido guardar la nueva contraseña. Solicita un enlace de recuperación nuevo.');
      setSaving(false);
      return;
    }

    await supabase.auth.signOut();
    window.location.replace('/superadmin?clave=actualizada');
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b0d] px-5 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-orange-400/15 bg-[#0c1013]/95 p-8 shadow-2xl shadow-black/50">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-3xl">🛡️</div>
        <p className="mt-6 text-center text-xs font-black uppercase tracking-[.22em] text-orange-400">CA46 · SuperAdmin</p>
        <h1 className="mt-2 text-center text-3xl font-black">Nueva contraseña</h1>

        {checking ? (
          <div className="mt-7 rounded-xl border border-orange-400/20 bg-orange-500/[.07] px-4 py-4 text-center text-sm font-bold leading-6 text-orange-200">Validando el enlace de recuperación…</div>
        ) : ready ? (
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
        ) : (
          <div className="mt-7 space-y-4">
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/[.07] px-4 py-4 text-sm font-bold leading-6 text-rose-300">{error || 'No se pudo validar el enlace.'}</div>
            <a href="/superadmin-recuperar" className="block w-full rounded-xl bg-orange-500 px-5 py-4 text-center font-black text-[#111416]">Solicitar enlace nuevo</a>
          </div>
        )}

        <a href="/superadmin" className="mt-5 block text-center text-sm font-black text-slate-500">← Volver a SuperAdmin</a>
      </section>
    </main>
  );
}
