import type { ReactNode } from 'react';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function TemperaturasLayout({ children }: { children: ReactNode }) {
  return <PrivateAreaGate areaName="Control de temperaturas">{children}</PrivateAreaGate>;
}
