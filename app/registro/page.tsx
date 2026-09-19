'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { DEFAULT_COMPANY_CONFIG, saveCompanyConfig } from '@/lib/company-config';

type PlanId = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';

const PLANS: { id: PlanId; name: string; price: string; note: string }[] = [
  { id: 'gratis', name: 'Gratis', price: '0 €', note: 'Hasta 20 etiquetas/mes' },
  { id: 'autonomo', name: 'Autónomo', price: '19,99 €/mes', note: '1 establecimiento · hasta 3 usuarios' },
  { id: 'empresa', name: 'Empresa', price: '35,99 €/mes', note: 'Varios establecimientos y usuarios' },
  { id: 'personalizado', name: 'Personalizado', price: 'A medida', note: 'Configuración e integraciones especiales' },
];

export default function RegistroPage() {
  const [plan, setPlan] = useState<PlanId>('gratis');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('plan');
    if (raw && PLANS.some((item) => item.id === raw)) setPlan(raw as PlanId);
  }, []);

  const selectedPlan = useMemo(() => PLANS.find((item) => item.id === plan) || PLANS[0], [plan]);
  const valid = firstName.trim() && lastName.trim() && companyName.trim() && email.trim() && password.length >= 8 && password === confirmPassword && accepted;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/acceso?verificado=1`,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          company_name: companyName.trim(),
          plan,
          role: 'admin_empresa',
        },
      },
    });

    if (signUpError) {
      const message = signUpError.message.toLowerCase();
      setError(message.includes('already') || message.includes('registered') ? 'Ya existe una cuenta con ese email.' : signUpError.message);
      setLoading(false);
      return;
    }

    saveCompanyConfig({
      ...DEFAULT_COMPANY_CONFIG,
      businessName: companyName.trim(),
      contactFirstName: firstName.trim(),
      contactLastName: lastName.trim(),
      contactEmail: email.trim(),
    });
    window.localStorage.setItem('ca46:selected-plan', plan);

    if (data.session) {
      window.location.href = '/mi-empresa';
      return;
    }

    setSuccess('Cuenta creada. Revisa tu correo y confirma el enlace para activar el acceso a CA46.');
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_8%,rgba(249,115,22,.18),transparent_27%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
      <header className="relative border-b border-white/10 bg-[#0c1013]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-orange-400/20 bg-black"><Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" /></div>
            <div><p className="text-xl font-black">CA46</p><p className="text-xs font-semibold text-slate-500">Crear cuenta</p></div>
          </Link>
          <Link href="/acceso" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">Ya soy cliente</Link>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-7 px-5 py-10 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:py-14">
        <aside className="rounded-[2rem] border border-orange-400/20 bg-orange-500/[.07] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Plan seleccionado</p>
          <h1 className="mt-3 text-4xl font-black">{selectedPlan.name}</h1>
          <p className="mt-3 text-2xl font-black text-orange-300">{selectedPlan.price}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{selectedPlan.note}</p>

          <div className="mt-7 space-y-3">
            {PLANS.map((item) => (
              <button key={item.id} type="button" onClick={() => setPlan(item.id)} className={`w-full rounded-2xl border p-4 text-left transition ${plan === item.id ? 'border-orange-400/45 bg-orange-500/10' : 'border-white/10 bg-black/20 hover:border-white/20'}`}>
                <div className="flex items-center justify-between gap-3"><span className="font-black">{item.name}</span><span className="text-sm font-black text-slate-400">{item.price}</span></div>
              </button>
            ))}
          </div>
          <Link href="/planes" className="mt-6 inline-flex text-sm font-black text-orange-300">← Comparar planes</Link>
        </aside>

        <section className="rounded-[2rem] border border-white/10 bg-[#0c1013]/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Alta de cliente</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">Crea tu cuenta CA46</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Tu primer usuario será el administrador de la empresa. Después podrás configurar bancos, Drive y etiquetas.</p>

          <form onSubmit={handleSubmit} className="mt-7 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre"><input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={inputClass} /></Field>
            <Field label="Apellidos"><input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={inputClass} /></Field>
            <Field label="Empresa / nombre comercial" wide><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" className={inputClass} /></Field>
            <Field label="Email" wide><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} /></Field>
            <Field label="Contraseña"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} placeholder="Mínimo 8 caracteres" /></Field>
            <Field label="Repite la contraseña"><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className={inputClass} /></Field>

            {password && password.length < 8 ? <p className="sm:col-span-2 text-sm font-bold text-amber-300">La contraseña debe tener al menos 8 caracteres.</p> : null}
            {confirmPassword && password !== confirmPassword ? <p className="sm:col-span-2 text-sm font-bold text-amber-300">Las contraseñas no coinciden.</p> : null}

            <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" />
              <span>Acepto crear una cuenta CA46 y que mis datos se utilicen para gestionar el acceso y la configuración de mi empresa.</span>
            </label>

            {error ? <p className="sm:col-span-2 rounded-xl border border-rose-400/20 bg-rose-500/[.08] px-4 py-3 text-sm font-bold text-rose-300">{error}</p> : null}
            {success ? <div className="sm:col-span-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.08] p-5"><p className="font-black text-emerald-300">✓ {success}</p><Link href="/acceso" className="mt-3 inline-flex font-black text-white">Ir al acceso →</Link></div> : null}

            <button type="submit" disabled={!valid || loading || Boolean(success)} className="sm:col-span-2 rounded-2xl bg-orange-500 px-6 py-4 text-lg font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">
              {loading ? 'Creando cuenta…' : plan === 'personalizado' ? 'Crear cuenta y solicitar plan' : `Crear cuenta · ${selectedPlan.name}`}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-bold text-white outline-none transition focus:border-orange-400';

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">{label}</span>{children}</label>;
}
