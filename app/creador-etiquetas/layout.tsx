'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function CreadorEtiquetasLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const provisional = pathname.includes('/etiqueta-temporal');

  return (
    <PrivateAreaGate mobileAccountInHeader areaName="Creador de etiquetas">
      <CompanyAreaNav />
      <div className="relative flex flex-wrap gap-2 bg-[#0c1013] px-4 py-3 lg:fixed lg:bottom-5 lg:left-4 lg:z-40 lg:bg-transparent lg:p-0">
        <Link href="/crear" className="rounded-xl border border-white/10 bg-[#111416]/95 px-4 py-3 text-xs font-black text-slate-300 shadow-xl backdrop-blur-xl">
          ← Etiquetas
        </Link>
        <Link href="/etiquetas" className="rounded-xl border border-emerald-400/25 bg-[#111416]/95 px-4 py-3 text-xs font-black text-emerald-300 shadow-xl backdrop-blur-xl">
          👁️ Visor
        </Link>
        <Link href={provisional ? '/creador-etiquetas' : '/creador-etiquetas/etiqueta-temporal'} className="rounded-xl border border-orange-400/30 bg-[#111416]/95 px-4 py-3 text-xs font-black text-orange-300 lg:fixed lg:bottom-5 lg:right-4 lg:z-40">
          {provisional ? 'Factura · 72 h' : 'Etiqueta de caja · 24 h'}
        </Link>
      </div>
      {children}
    </PrivateAreaGate>
  );
}
