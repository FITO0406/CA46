'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function MiEmpresaLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="Mi empresa" requireTenant={false}>
      {children}
      <Link
        href="/crear"
        className="fixed bottom-20 right-4 z-40 rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-[#111416] shadow-2xl shadow-black/50 sm:bottom-6 sm:right-6"
      >
        🏷️ Crear etiquetas
      </Link>
    </PrivateAreaGate>
  );
}
