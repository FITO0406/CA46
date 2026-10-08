'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function MiEmpresaLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="Mi empresa" requireTenant={false}>
      <CompanyAreaNav />
      {children}
      <Link
        href="/crear"
        className="relative mx-4 my-4 inline-block rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-[#111416] lg:fixed lg:bottom-6 lg:right-6 lg:z-40 lg:m-0 lg:shadow-2xl lg:shadow-black/50"
      >
        🏷️ Crear etiquetas
      </Link>
    </PrivateAreaGate>
  );
}
