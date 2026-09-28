'use client';

import type { ReactNode } from 'react';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function CocinaLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="Cocina">
      <CompanyAreaNav />
      {children}
    </PrivateAreaGate>
  );
}
