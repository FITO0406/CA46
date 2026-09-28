import type { ReactNode } from 'react';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function FacturacionLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="Facturación">
      <CompanyAreaNav />
      {children}
    </PrivateAreaGate>
  );
}
