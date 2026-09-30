'use client';

import type { ReactNode } from 'react';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function SeguridadLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="Seguridad" requireTenant={false}>
      <CompanyAreaNav />
      {children}
    </PrivateAreaGate>
  );
}
