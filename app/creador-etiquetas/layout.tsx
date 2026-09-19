'use client';

import type { ReactNode } from 'react';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function CreadorEtiquetasLayout({ children }: { children: ReactNode }) {
  return <PrivateAreaGate areaName="Creador de etiquetas">{children}</PrivateAreaGate>;
}
