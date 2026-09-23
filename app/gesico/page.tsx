import Link from 'next/link';

const GESICO_SEVILLA_URL = 'https://sevilla.gesicosistemas.es/login';

export default function GesicoPage() {
  return (
    <div className="min-h-screen bg-[#0a0d0f] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(249,115,22,.16),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(14,165,233,.10),transparent_25%)]" />

      <header className="relative border-b border-white/10 bg-[#0d1114]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xl font-black tracking-tight">CA46</p>
            <p className="text-xs font-medium text-slate-400">Ecosistema de trazabilidad</p>
          </div>
          <Link
            href="/etiquetas"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-orange-400/50 hover:bg-orange-500/10"
          >
            ← Volver a etiquetas
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-89px)] max-w-6xl items-center justify-center px-5 py-12 sm:px-8">
        <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.055] shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orange-500/15 text-2xl shadow-inner shadow-orange-500/10">
                ↗
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Acceso externo</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">GESICO · Sevilla</h1>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 sm:py-10">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.07] p-4">
              <div className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="font-bold text-emerald-200">Portal oficial de compradores de MercaSevilla</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    CA46 no guarda ni procesa tus credenciales de GESICO. El inicio de sesión se realiza directamente en la web oficial.
                  </p>
                </div>
              </div>
            </div>

            <a
              href={GESICO_SEVILLA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-orange-500 px-6 py-4 text-center text-lg font-black text-[#111416] shadow-lg shadow-orange-950/30 transition hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-[#0a0d0f]"
            >
              Abrir GESICO Sevilla
              <span aria-hidden="true" className="text-2xl">↗</span>
            </a>

            <p className="mt-4 text-center text-xs font-semibold leading-5 text-slate-500">
              Se abrirá en una pestaña nueva para que introduzcas tu usuario y contraseña directamente en GESICO.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
