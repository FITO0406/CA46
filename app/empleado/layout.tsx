'use client';
import type { ReactNode } from 'react';
import PrivateAreaGate from '@/components/PrivateAreaGate';
export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return <PrivateAreaGate mobileAccountInHeader areaName="Acceso de empleado · Crear etiquetas" employeeArea>{children}</PrivateAreaGate>;
}
