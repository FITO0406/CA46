import Image from 'next/image';
import Link from 'next/link';

const plans = [
  {
    id: 'gratis',
    name: 'Gratis',
    price: '0 €',
    cadence: '/mes',
    eyebrow: 'Para probar CA46',
    description: 'Empieza sin coste y comprueba cómo funciona la trazabilidad digital en tu establecimiento.',
    features: [
      '1 establecimiento',
      '1 usuario',
      'Hasta 20 etiquetas al mes',
      'Pantalla de etiquetas',
      'Mi empresa básico',
      '1 banco configurado',
      'Acceso a GESICO',
    ],
    limitations: ['Sin conexión de Google Drive', 'Historial limitado'],
  },
  {
    id: 'autonomo',
    name: 'Autónomo',
    price: '19,99 €',
    cadence: '/mes',
    eyebrow: 'Para un negocio individual',
    description: 'El plan principal para una pescadería o comercio que quiere trabajar con CA46 a diario.',
    featured: true,
    features: [
      '1 establecimiento',
      'Hasta 3 usuarios',
      'Etiquetas sin límite comercial previsto',
      'Pantalla de etiquetas completa',
      'Historial completo',
      'Varios bancos',
      'Google Drive',
      'Acceso a GESICO',
      'Personalización del establecimiento',
    ],
    limitations: [],
  },
  {
    id: 'empresa',
    name: 'Empresa',
    price: '35,99 €',
    cadence: '/mes',
    eyebrow: 'Para varios centros',
    description: 'Para empresas con más de un establecimiento y una administración común de usuarios y centros.',
    features: [
      'Varios establecimientos',
      'Varios usuarios',
      'Etiquetas sin límite comercial previsto',
      'Pantalla independiente por centro',
      'Historial completo',
      'Varios bancos',
      'Google Drive',
      'Acceso a GESICO',
      'Administración centralizada',
      'Soporte prioritario',
    ],
    limitations: [],
  },
  {
    id: 'personalizado',
    name: 'Personalizado',
    price: 'A medida',
    cadence: '',
    eyebrow: 'Cadenas y proyectos especiales',
    description: 'Para cadenas, asociaciones, mayoristas o necesidades que requieran una implantación específica.',
    features: [
      'Centros a medida',
      'Usuarios a medida',
      'Configuración personalizada',
      'Integraciones especiales',
      'Desarrollos específicos',
      'Soporte personalizado',
    ],
    limitations: [],
  },
];

export default function PlanesPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(249,115,22,.16),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(148,163,184,.08),transparent_25%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[.06] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:44px_44px]" />

      <header className="relative border-b border-white/10 bg-[#0c1013]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-orange-400/20 bg-black shadow-lg shadow-orange-950/30">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight">CA46</p>
              <p className="text-xs font-semibold text-slate-500">Planes y precios</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/mi-empresa" className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300 sm:inline-flex">Ya tengo cuenta</Link>
            <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Inicio</Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <section className="mx-auto max-w-4xl text-center">
          <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.22em] text-orange-300">CA46 · SaaS para trazabilidad alimentaria</span>
          <h1 className="mt-6 text-balance text-4xl font-black tracking-[-.05em] sm:text-6xl lg:text-7xl">
            Un plan para cada etapa de tu negocio
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Desde una prueba gratuita hasta una implantación para varios centros. Los cuatro planes comparten la misma base CA46 y crecen contigo.
          </p>
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex h-full flex-col rounded-[2rem] border p-6 shadow-2xl shadow-black/20 ${
                plan.featured
                  ? 'border-orange-400/45 bg-gradient-to-b from-orange-500/[.16] to-white/[.035] lg:-translate-y-3'
                  : 'border-white/10 bg-white/[.035]'
              }`}
            >
              {plan.featured ? (
                <span className="absolute right-5 top-5 rounded-full border border-orange-300/25 bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-[#111416]">Recomendado</span>
              ) : null}
              <p className="pr-24 text-[10px] font-black uppercase tracking-[.2em] text-orange-400">{plan.eyebrow}</p>
              <h2 className="mt-4 text-3xl font-black">{plan.name}</h2>
              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-black tracking-tight text-white">{plan.price}</span>
                {plan.cadence ? <span className="pb-1 text-sm font-bold text-slate-500">{plan.cadence}</span> : null}
              </div>
              <p className="mt-5 min-h-24 text-sm leading-6 text-slate-400">{plan.description}</p>

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Incluye</p>
                <div className="mt-4 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-3 text-sm font-bold text-slate-200">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-[11px] text-emerald-300">✓</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                  {plan.limitations.map((item) => (
                    <div key={item} className="flex gap-3 text-sm font-semibold text-slate-600">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/5 text-[11px]">—</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a href="#alta" className={`mt-7 rounded-2xl px-5 py-4 text-center text-sm font-black transition ${plan.featured ? 'bg-orange-500 text-[#111416]' : 'border border-white/10 bg-white/5 text-white hover:border-orange-400/30'}`}>
                {plan.id === 'personalizado' ? 'Solicitar presupuesto' : plan.id === 'gratis' ? 'Empezar gratis' : `Elegir ${plan.name}`}
              </a>
            </article>
          ))}
        </section>

        <section id="alta" className="mt-12 overflow-hidden rounded-[2rem] border border-orange-400/20 bg-gradient-to-r from-orange-500/[.10] via-white/[.035] to-transparent p-7 sm:p-9">
          <div className="grid items-center gap-7 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Siguiente paso</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">Registro de clientes CA46</h2>
              <p className="mt-4 max-w-3xl leading-7 text-slate-400">
                En el siguiente paso conectaremos estos botones con el registro: email, contraseña, verificación, creación automática de empresa y asignación del plan elegido.
              </p>
            </div>
            <Link href="/mi-empresa" className="inline-flex justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-slate-200">Acceso actual →</Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 rounded-[2rem] border border-white/10 bg-white/[.03] p-6 md:grid-cols-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-600">Arquitectura</p><p className="mt-2 font-black text-slate-200">Cada empresa tendrá sus propios datos, usuarios y configuración.</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-600">Seguridad</p><p className="mt-2 font-black text-slate-200">Las contraseñas se gestionarán mediante Supabase Auth.</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-600">Escalado</p><p className="mt-2 font-black text-slate-200">El plan pertenecerá a la empresa, no a un usuario individual.</p></div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 bg-black/25 px-5 py-7 text-center text-xs font-semibold tracking-[.16em] text-slate-600">
        CA46 · Planes Gratis · Autónomo · Empresa · Personalizado
      </footer>
    </div>
  );
}
