'use client';

import type { ReactNode } from 'react';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function CocinaLayout({ children }: { children: ReactNode }) {
  return <PrivateAreaGate areaName="Cocina">{children}</PrivateAreaGate>;
}
