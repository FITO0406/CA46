'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  mode: 'company' | 'superadmin';
  backHref: string;
  backLabel: string;
};

export default function AccountSecurity({ mode, backHref, backLabel }: Props) {
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState<'others' | 'global' | ''>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || '');
    });
  }, []);

  async function handlePasswordChange(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    setError('');
    setMessage('');

    if (!email) {
      setError('No hemos podido identificar el email de esta sesión.');
      return;
    }
    if (!currentPassword) {
      setError('Introduce tu contraseña actual.');
      return;
    }
    if (newPassword.length < 10) {
      setError('La nueva contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (newPassword !== repeatPassword) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('La nueva contraseña debe ser distinta de la actual.');
      return;
    }

    setSaving(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        setError('La contraseña actual no es correcta.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError('No hemos podido guardar la nueva contraseña. Inténtalo de nuevo.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setMessage('✓ Contraseña actualizada correctamente.');
    } finally {
      setSaving(false);
    }
  }

  async function signOutOtherDevices() {
    if (closing) return;
    setClosing('others');
    setError('');
    setMessage('');
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
    if (signOutError) setError('No hemos podido cerrar las otras sesiones.');
    else setMessage('✓ Se han cerrado las demás sesiones. Este dispositivo sigue conectado.');
    setClosing('');
  }

  async function signOutEverywhere() {
    if (closing) return;
    const confirmed = window.confirm('Se cerrará tu sesión en todos los dispositivos. ¿Quieres continuar?');
    if (!confirmed) return;

    setClosing('global');
    setError('');
    setMessage('');
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      setError('No hemos podido cerrar todas las sesiones.');
      setClosing('');
      return;
    }

    window.location.replace(mode === 'superadmin' ? '/superadmin' : '/acceso');
  }

  return (
    <main className="min-h-screen bg-[#080b0d] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46 · Seguridad</p>
            <h1 className="mt-2 text-4xl font-black">Contraseña y sesiones</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Gestiona la contraseña de tu cuenta y los dispositivos donde tienes CA46 abierto.</p>
          </div>
          <Link href={backHref} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-300">← {backLabel}</Link>
        </div>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-[#0c1013] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Cuenta</p>
          <p className="mt-2 break-all text-lg font-black text-white">{email || 'Cargando email…'}</p>

          <form onSubmit={handlePasswordChange} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Contraseña actual</span>
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Nueva contraseña</span>
              <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 10 caracteres" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Repetir nueva contraseña</span>
              <input type="password" autoComplete="new-password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} className={inputClass} />
            </label>

            {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/[.07] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
            {message ? <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/[.07] px-4 py-3 text-sm font-bold text-emerald-300">{message}</p> : null}

            <button type="submit" disabled={saving || !currentPassword || !newPassword || !repeatPassword} className="w-full rounded-xl bg-orange-500 px-5 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">
              {saving ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0c1013] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Dispositivos</p>
          <h2 className="mt-2 text-2xl font-black">Control de sesiones</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Úsalo si has abierto CA46 en otro ordenador, móvil o tablet y quieres retirar ese acceso.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={signOutOtherDevices} disabled={Boolean(closing)} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-black text-slate-200 disabled:opacity-50">
              {closing === 'others' ? 'Cerrando…' : 'Cerrar otros dispositivos'}
            </button>
            <button type="button" onClick={signOutEverywhere} disabled={Boolean(closing)} className="rounded-xl border border-rose-400/20 bg-rose-500/[.08] px-5 py-4 text-sm font-black text-rose-300 disabled:opacity-50">
              {closing === 'global' ? 'Cerrando…' : 'Cerrar sesión en todos'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold text-white outline-none transition focus:border-orange-400';
