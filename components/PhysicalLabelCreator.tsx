'use client';

import InvoiceLabelCreator from '@/components/InvoiceLabelCreator';

export default function PhysicalLabelCreator({ employeeMode = false }: { employeeMode?: boolean }) {
  return <InvoiceLabelCreator employeeMode={employeeMode} sourceMode="physical_label" />;
}
