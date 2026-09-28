'use client';

import type { ReactNode } from 'react';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function CrearLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="Crear etiquetas">
      <CompanyAreaNav />
      {children}
    </PrivateAreaGate>
  );
}
