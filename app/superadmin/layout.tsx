'use client';

import type { ReactNode } from 'react';
import SuperAdminGate from '@/components/SuperAdminGate';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return <SuperAdminGate>{children}</SuperAdminGate>;
}
