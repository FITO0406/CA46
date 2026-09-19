'use client';

import type { ReactNode } from 'react';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function MiEmpresaLayout({ children }: { children: ReactNode }) {
  return <PrivateAreaGate areaName="Mi empresa">{children}</PrivateAreaGate>;
}
