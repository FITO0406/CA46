'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import SuperAdminGate from '@/components/SuperAdminGate';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <SuperAdminGate>
      <div className="border-b border-white/10 bg-[#07090b] px-4 py-2 text-white">
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
          <Link href="/superadmin" className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black text-slate-400 hover:bg-white/5 hover:text-white">Panel</Link>
          <Link href="/superadmin/empresas" className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black text-slate-400 hover:bg-white/5 hover:text-white">Empresas</Link>
          <Link href="/superadmin/planes" className="whitespace-nowrap rounded-lg border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-xs font-black text-orange-300">Planes y cobros</Link>
        </nav>
      </div>
      {children}
    </SuperAdminGate>
  );
}
