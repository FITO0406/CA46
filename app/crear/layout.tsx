'use client';

import type { ReactNode } from 'react';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function CrearLayout({ children }: { children: ReactNode }) {
  return <PrivateAreaGate areaName="Crear etiquetas">{children}</PrivateAreaGate>;
}
