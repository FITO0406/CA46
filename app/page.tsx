import Image from 'next/image';
import Link from 'next/link';

type ModuleCardProps = {
  title: string;
  description: string;
  eyebrow: string;
  href?: string;
  icon: React.ReactNode;
  featured?: boolean;
  badge?: string;
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 13 11 22l-8-8V4h10z" />
      <circle cx="8.5" cy="9" r="1.5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 10 9-6 9 6" />
      <path d="M5 10v8" />
      <path d="M9.5 10v8" />
      <path d="M14.5 10v8" />
      <path d="M19 10v8" />
      <path d="M3 18h18" />
      <path d="M2 21h20" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function ModuleCard({ title, description, eyebrow, href, icon, featured, badge }: ModuleCardProps) {
  const card = (
    <div
      className={`group relative h-full overflow-hidden rounded-[2rem] border p-6 transition duration-300 sm:p-7 ${
        featured
          ? 'border-orange-400/35 bg-gradient-to-br from-orange-500/[.16] via-white/[.055] to-white/[.025] shadow-2xl shadow-orange-950/30 hover:border-orange-300/60 hover:shadow-orange-950/50'
          : 'border-white/10 bg-white/[.045] shadow-xl shadow-black/20 hover:border-orange-400/35 hover:bg-white/[.065]'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="relative flex h-full flex-col">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-orange-400 shadow-inner shadow-orange-500/10">
            {icon}
          </div>
          <div className="flex flex-col items-end gap-2">
            {badge ? (
              <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-orange-300">
                {badge}
              </span>
            ) : null}
            <span className="text-[10px] font-black uppercase tracking-[.22em] text-slate-500">{eyebrow}</span>
          </div>
        </div>

        <div className="mt-auto">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-400 sm:text-base">{description}</p>

          <div className="mt-7 flex items-center justify-between">
            <span className={`text-sm font-black ${href ? 'text-orange-300' : 'text-slate-600'}`}>
              {href ? 'Entrar' : 'En preparación'}
            </span>
            <span
              className={`grid h-11 w-11 place-items-center rounded-full border transition ${
                href
                  ? 'border-orange-400/30 bg-orange-500/10 text-orange-300 group-hover:border-orange-300 group-hover:bg-orange-500 group-hover:text-[#111416]'
                  : 'border-white/10 bg-white/[.03] text-slate-700'
              }`}
            >
              <ArrowIcon />
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className={featured ? 'md:col-span-2' : ''}>
      {card}
    </Link>
  ) : (
    <div className={featured ? 'md:col-span-2' : ''}>{card}</div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(249,115,22,.16),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%),linear-gradient(180deg,rgba(255,255,255,.02),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[.08] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:44px_44px]" />

      <header className="relative border-b border-white/10 bg-[#0c1013]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-orange-400/20 bg-black shadow-lg shadow-orange-950/40 sm:h-16 sm:w-16">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="64px" className="object-cover" />
            </div>
            <div>
              <p className="text-xl font-black tracking-[-.03em] sm:text-2xl">CA46</p>
              <p className="text-xs font-semibold text-slate-500 sm:text-sm">Ecosistema inteligente de trazabilidad alimentaria</p>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[.07] px-4 py-2 text-xs font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Sistema activo
            </span>
            <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-sm font-black text-slate-300">CA</div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 pb-16 pt-9 sm:px-8 sm:pt-12">
        <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_.8fr] lg:gap-14">
          <div>
            <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.22em] text-orange-300">
              Control · trazabilidad · comercio
            </span>
            <h1 className="mt-6 max-w-4xl text-balance text-4xl font-black tracking-[-.05em] sm:text-6xl lg:text-7xl">
              Todo CA46,
              <span className="block bg-gradient-to-r from-orange-400 via-amber-300 to-slate-200 bg-clip-text text-transparent">
                desde un solo lugar
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Crea, publica y muestra la trazabilidad de tus productos. Accede también a GESICO, tus bancos y la configuración de tu empresa desde un único panel.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="absolute inset-8 rounded-full bg-orange-500/15 blur-3xl" />
            <div className="relative aspect-square overflow-hidden rounded-[2.4rem] border border-orange-400/20 bg-black shadow-2xl shadow-orange-950/40">
              <Image src="/ca46-logo.svg" alt="Logotipo corporativo CA46" fill priority sizes="(max-width: 1024px) 360px, 430px" className="object-cover" />
            </div>
          </div>
        </section>

        <section className="mt-14 sm:mt-20">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-orange-400">Panel principal</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">5 módulos. Un solo ecosistema.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Etiquetas y GESICO ya están disponibles. El resto de módulos los iremos activando sobre esta misma estructura.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              title="Etiquetas"
              description="Pantalla visual para tus clientes: productos activos, búsqueda táctil y trazabilidad visible en el establecimiento."
              eyebrow="Pantalla cliente"
              href="/etiquetas"
              featured
              badge="Principal"
              icon={<ScreenIcon />}
            />

            <ModuleCard
              title="Creador de etiquetas"
              description="Captura facturas con la cámara o selecciona varias fotos, revisa los datos detectados y publica todas las etiquetas."
              eyebrow="Zona profesional"
              badge="Siguiente paso"
              icon={<TagIcon />}
            />

            <ModuleCard
              title="GESICO"
              description="Acceso directo e independiente a GESICO Sevilla para consultar o contrastar información cuando lo necesites."
              eyebrow="Acceso externo"
              href="/gesico"
              icon={<ExternalIcon />}
            />

            <ModuleCard
              title="Bancos"
              description="Selecciona tu entidad habitual y accede rápidamente a su banca online sin que CA46 almacene tus credenciales."
              eyebrow="Acceso rápido"
              icon={<BankIcon />}
            />

            <ModuleCard
              title="Mi empresa"
              description="Datos de empresa, usuarios, conexión de Drive, preferencias y configuración general de tu cuenta CA46."
              eyebrow="Configuración"
              icon={<CompanyIcon />}
            />
          </div>
        </section>

        <section className="mt-8 grid gap-4 rounded-[2rem] border border-white/10 bg-white/[.035] p-5 sm:grid-cols-3 sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-slate-600">Pantalla cliente</p>
            <p className="mt-2 font-black text-slate-200">Etiquetas activas durante 72 h</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-slate-600">Creador</p>
            <p className="mt-2 font-black text-slate-200">Una factura puede generar varias etiquetas</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-slate-600">Objetivo</p>
            <p className="mt-2 font-black text-slate-200">Automatización integrada en CA46</p>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 bg-black/25 px-5 py-7 text-center text-xs font-semibold tracking-[.16em] text-slate-600">
        CA46 · Tecnología, control y confianza para el comercio alimentario
      </footer>
    </div>
  );
}
