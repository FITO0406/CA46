import Image from 'next/image';

export default function SuperAdminPage() {
  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/92 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-orange-400/20 bg-black">
            <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="48px" className="object-cover" />
          </div>
          <div>
            <p className="text-xl font-black">CA46</p>
            <p className="text-xs font-semibold text-slate-500">SuperAdmin</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <section className="max-w-3xl">
          <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.2em] text-emerald-300">Núcleo seguro activo</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">Administración global de CA46</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">Esta zona queda separada de los administradores de cada pescadería. Ningún usuario de empresa obtiene acceso aquí por ser administrador de su negocio.</p>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-[2rem] border border-orange-400/25 bg-orange-500/[.06] p-7">
            <div className="text-4xl">🏢</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-orange-400">Siguiente paso</p>
            <h2 className="mt-2 text-2xl font-black">Empresas</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Listado global, estado, plan, datos básicos y acceso a la ficha de cada empresa.</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[.035] p-7 opacity-70">
            <div className="text-4xl">💳</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-slate-500">Después</p>
            <h2 className="mt-2 text-2xl font-black">Planes y cobros</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Control de plan, estado de suscripción y futura conexión con Stripe.</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[.035] p-7 opacity-70">
            <div className="text-4xl">🛠️</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-slate-500">Después</p>
            <h2 className="mt-2 text-2xl font-black">Sistema</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Estado de servicios, incidencias y herramientas globales sin mezclar datos entre empresas.</p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.035] px-5 py-4 text-sm font-bold text-slate-400">
          Paso 1 completado: autenticación SuperAdmin independiente y cerrada. El siguiente bloque será el panel de Empresas.
        </section>
      </main>
    </div>
  );
}
