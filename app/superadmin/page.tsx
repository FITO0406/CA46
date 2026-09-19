import Image from 'next/image';
import Link from 'next/link';

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
          <Link href="/superadmin/empresas" className="rounded-[2rem] border border-orange-400/30 bg-orange-500/[.08] p-7 transition hover:border-orange-300/50 hover:bg-orange-500/[.11] active:scale-[.99]">
            <div className="text-4xl">🏢</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-orange-400">Activo</p>
            <h2 className="mt-2 text-2xl font-black">Empresas</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Listado global, estado, plan, usuarios, Drive y etiquetas activas de cada empresa.</p>
            <span className="mt-6 inline-flex rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black">Abrir Empresas →</span>
          </Link>

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

        <section className="mt-8 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-5 py-4 text-sm font-bold text-emerald-200">
          Paso 3 activo: Empresas ya está conectado a la base multiempresa. El siguiente bloque será la ficha individual de cada empresa.
        </section>
      </main>
    </div>
  );
}
