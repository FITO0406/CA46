'use client';

import type { ReactNode } from 'react';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function BancosLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="Mis bancos">
      <CompanyAreaNav />
      {children}
    </PrivateAreaGate>
  );
}
