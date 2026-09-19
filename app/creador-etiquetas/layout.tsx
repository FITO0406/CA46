'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function CreadorEtiquetasLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const provisional = pathname.includes('/etiqueta-temporal');

  return (
    <PrivateAreaGate areaName="Creador de etiquetas">
      {children}

      <div className="fixed bottom-20 left-4 z-40 flex gap-2 sm:bottom-5">
        <Link href="/crear" className="rounded-xl border border-white/10 bg-[#111416]/95 px-4 py-3 text-xs font-black text-slate-300 shadow-xl backdrop-blur-xl">
          ← Etiquetas
        </Link>
        <Link href="/etiquetas" className="rounded-xl border border-emerald-400/25 bg-[#111416]/95 px-4 py-3 text-xs font-black text-emerald-300 shadow-xl backdrop-blur-xl">
          👁️ Visor
        </Link>
      </div>

      <Link
        href={provisional ? '/creador-etiquetas' : '/creador-etiquetas/etiqueta-temporal'}
        className="fixed bottom-20 right-4 z-40 rounded-2xl border border-orange-400/30 bg-[#111416]/95 px-4 py-3 text-xs font-black text-orange-300 shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:border-orange-300/60 sm:bottom-5"
      >
        {provisional ? '📄 Factura · 72 h' : '🏷️ Provisional · 24 h'}
      </Link>
    </PrivateAreaGate>
  );
}
