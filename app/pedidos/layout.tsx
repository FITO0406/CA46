import type { ReactNode } from 'react';
import PrivateAreaGate from '@/components/PrivateAreaGate';

export default function PedidosLayout({ children }: { children: ReactNode }) {
  return <PrivateAreaGate areaName="Gestión de pedidos">{children}</PrivateAreaGate>;
}
