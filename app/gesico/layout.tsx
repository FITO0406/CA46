import type { ReactNode } from 'react';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function MiMercaLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="MI MERCA">
      <CompanyAreaNav />
      {children}
    </PrivateAreaGate>
  );
}
