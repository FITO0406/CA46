import Image from 'next/image';
import Link from 'next/link';
import CreatorHealthBadge from '@/components/CreatorHealthBadge';
import DriveSyncButton from '@/components/DriveSyncButton';

export default function CrearEtiquetasInicioPage() {
  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/92 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/mi-empresa" className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-orange-400/20 bg-black">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-xl font-black">CA46</p>
              <p className="text-xs font-semibold text-slate-500">Etiquetas y cocina</p>
            </div>
          </Link>
          <Link href="/mi-empresa" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">
            ← Mi empresa
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-9 sm:px-8">
        <section className="text-center">
          <div className="flex justify-center"><CreatorHealthBadge /></div>
          <p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-orange-400">Circuito completo</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Crear, transformar y ver etiquetas</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Foto de factura, etiqueta provisional, Drive o transformación en cocina. Toda la trazabilidad queda dentro de la misma empresa.
          </p>
        </section>

        <section className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Link href="/creador-etiquetas" className="rounded-[2rem] border border-orange-400/30 bg-orange-500/[.08] p-7 transition active:scale-[.99]">
            <div className="text-5xl">📄</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-orange-400">Carga + OCR</p>
            <h2 className="mt-2 text-3xl font-black">Factura</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Haz una foto o elige varias. CA46 lee las partidas y publica etiquetas definitivas de 72 horas.</p>
            <span className="mt-6 inline-flex rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black">Cargar factura →</span>
          </Link>

          <Link href="/creador-etiquetas/etiqueta-temporal" className="rounded-[2rem] border border-amber-400/25 bg-amber-400/[.06] p-7 transition active:scale-[.99]">
            <div className="text-5xl">🏷️</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-amber-300">Carga + OCR</p>
            <h2 className="mt-2 text-3xl font-black">Provisional</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Fotografía una etiqueta física. CA46 copia los datos visibles y la publica durante 24 horas.</p>
            <span className="mt-6 inline-flex rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-200">Cargar etiqueta →</span>
          </Link>

          <div className="rounded-[2rem] border border-sky-400/25 bg-sky-400/[.05] p-7">
            <div className="text-5xl">☁️</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-sky-300">Carpeta Etiquetas</p>
            <h2 className="mt-2 text-3xl font-black">Drive</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Importa los textos que entren en la carpeta Etiquetas de esta empresa. El visor también los revisa automáticamente.</p>
            <div className="mt-6"><DriveSyncButton /></div>
          </div>

          <Link href="/cocina" className="rounded-[2rem] border border-fuchsia-400/25 bg-fuchsia-400/[.05] p-7 transition active:scale-[.99]">
            <div className="text-5xl">🍲</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-fuchsia-300">Transformación</p>
            <h2 className="mt-2 text-3xl font-black">Cocina</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Cocción, salmuera, pesos, ingredientes y nutrición. Crea una etiqueta hija sin perder el lote padre.</p>
            <span className="mt-6 inline-flex rounded-xl border border-fuchsia-300/30 bg-fuchsia-300/10 px-4 py-3 text-sm font-black text-fuchsia-200">Abrir cocina →</span>
          </Link>

          <Link href="/temperaturas" className="rounded-[2rem] border border-cyan-400/25 bg-cyan-400/[.05] p-7 transition active:scale-[.99]">
            <div className="text-5xl">🌡️</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-cyan-300">Control APPCC</p>
            <h2 className="mt-2 text-3xl font-black">Temperaturas</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Controla cámaras y congeladores. Registra lecturas y medidas correctoras cuando un equipo sale de rango.</p>
            <span className="mt-6 inline-flex rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-200">Abrir control →</span>
          </Link>

          <Link href="/etiquetas" className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/[.05] p-7 transition active:scale-[.99]">
            <div className="text-5xl">👁️</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-emerald-300">Visor</p>
            <h2 className="mt-2 text-3xl font-black">Mis etiquetas</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Carrusel y buscador táctil. Se actualiza solo y nunca mezcla etiquetas de otras empresas.</p>
            <span className="mt-6 inline-flex rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-200">Abrir visor →</span>
          </Link>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] px-5 py-4 text-center text-sm font-bold text-slate-400">
          Factura = 72 h · Etiqueta física = 24 h · Drive = 72 h · Cocina = vida útil configurable · Temperaturas = historial por equipo · Todo queda aislado por empresa.
        </section>
      </main>
    </div>
  );
}
