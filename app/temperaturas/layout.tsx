import type { ReactNode } from 'react';
import CompanyAreaNav from '@/components/CompanyAreaNav';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function TemperaturasLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateAreaGate areaName="Control de temperaturas">
      <CompanyAreaNav />
      {children}
    </PrivateAreaGate>
  );
}
