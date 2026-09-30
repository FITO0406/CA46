'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/mi-empresa', label: 'Mi empresa', matches: ['/mi-empresa'] },
  { href: '/crear', label: 'Etiquetas', matches: ['/crear', '/creador-etiquetas'] },
  { href: '/cocina', label: 'Cocina', matches: ['/cocina'] },
  { href: '/temperaturas', label: 'Temperaturas', matches: ['/temperaturas'] },
  { href: '/facturacion', label: 'Facturación', matches: ['/facturacion'] },
  { href: '/gesico', label: 'GESICO', matches: ['/gesico'] },
  { href: '/bancos', label: 'Bancos', matches: ['/bancos'] },
  { href: '/seguridad', label: 'Seguridad', matches: ['/seguridad'] },
] as const;

export default function CompanyAreaNav() {
  const pathname = usePathname();

  return (
    <div className="relative z-30 border-b border-white/10 bg-[#090c0e]/95 text-white backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6">
        {items.map((item) => {
          const active = item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-black transition ${
                active
                  ? 'border-orange-400/35 bg-orange-500/12 text-orange-300'
                  : 'border-white/10 bg-white/[.035] text-slate-400 hover:border-white/20 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        <Link
          href="/etiquetas"
          target="_blank"
          className="ml-auto whitespace-nowrap rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-2 text-xs font-black text-emerald-300"
        >
          Visor ↗
        </Link>
      </nav>
    </div>
  );
}
