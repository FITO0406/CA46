'use client';

import type { ReactNode } from 'react';
import PrivateAreaGate from '@/components/PrivateAreaGate';
import CompanyAreaNav from '@/components/CompanyAreaNav';

export default function MiBalanzaLayout({children}:{children:ReactNode}){
 return <PrivateAreaGate areaName="Mi balanza" requireTenant={true}>
  <CompanyAreaNav/>
  {children}
 </PrivateAreaGate>;
}
