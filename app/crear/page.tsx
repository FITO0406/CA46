import Image from 'next/image';
import Link from 'next/link';

export default function CrearEtiquetasInicioPage() {
  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/92 px-5 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href="/mi-empresa" className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-orange-400/20 bg-black">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-xl font-black">CA46</p>
              <p className="text-xs font-semibold text-slate-500">Crear etiquetas</p>
            </div>
          </Link>
          <Link href="/mi-empresa" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">
            ← Mi empresa
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <section className="text-center">
          <p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Paso único</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">¿Qué quieres fotografiar?</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
            Elige una opción. CA46 hará el resto dentro de tu empresa.
          </p>
        </section>

        <section className="mt-9 grid gap-5 sm:grid-cols-2">
          <Link href="/creador-etiquetas" className="rounded-[2rem] border border-orange-400/30 bg-orange-500/[.08] p-7 transition active:scale-[.99]">
            <div className="text-5xl">📄</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-orange-400">Factura</p>
            <h2 className="mt-2 text-3xl font-black">Crear desde factura</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Una o varias fotos. Las etiquetas definitivas duran 72 horas.</p>
            <span className="mt-6 inline-flex rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black">Entrar →</span>
          </Link>

          <Link href="/creador-etiquetas/etiqueta-temporal" className="rounded-[2rem] border border-amber-400/25 bg-amber-400/[.06] p-7 transition active:scale-[.99]">
            <div className="text-5xl">🏷️</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-amber-300">Etiqueta física</p>
            <h2 className="mt-2 text-3xl font-black">Crear provisional</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Fotografía la etiqueta física. La provisional dura 24 horas.</p>
            <span className="mt-6 inline-flex rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-200">Entrar →</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
