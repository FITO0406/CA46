import type { ReactNode } from 'react';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function GesicoLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="GESICO">
      <CompanyAreaNav />
      {children}
    </PrivateAreaGate>
  );
}
