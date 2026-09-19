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
      <Link
        href={provisional ? '/creador-etiquetas' : '/creador-etiquetas/etiqueta-temporal'}
        className="fixed bottom-5 right-5 z-50 rounded-2xl border border-orange-400/30 bg-[#111416]/95 px-5 py-4 text-sm font-black text-orange-300 shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:border-orange-300/60"
      >
        {provisional ? '📄 Factura · 72 h' : '🏷️ Etiqueta física · 24 h'}
      </Link>
    </PrivateAreaGate>
  );
}
