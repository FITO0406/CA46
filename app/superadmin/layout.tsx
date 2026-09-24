'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import SuperAdminGate from '@/components/SuperAdminGate';

const navItems = [
  { href: '/superadmin', label: 'Panel' },
  { href: '/superadmin/director', label: 'DIRECTOR CA46' },
  { href: '/superadmin/empresas', label: 'Empresas' },
  { href: '/superadmin/planes', label: 'Planes y cobros' },
  { href: '/superadmin/facturas', label: 'Facturas' },
  { href: '/superadmin/incidencias', label: 'Incidencias' },
  { href: '/superadmin/sistema', label: 'Sistema' },
];

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <SuperAdminGate>
      <div className="border-b border-white/10 bg-[#07090b] px-4 py-2 text-white">
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-lg border border-white/10 bg-white/[.035] px-3 py-2 text-xs font-black text-slate-300 hover:border-orange-400/20 hover:bg-orange-500/10 hover:text-orange-300">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </SuperAdminGate>
  );
}
