import { NextResponse } from 'next/server';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { archiveCompanyLabels } from '@/lib/company-drive-archive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const tenant = await tenantContextForRequest(request);
  if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status });
  if (tenant.context.role !== 'admin_empresa') return NextResponse.json({ error: 'Solo el administrador puede recuperar el histórico.' }, { status: 403 });
  try {
    const result = await archiveCompanyLabels(tenant.context.companyId, 30);
    return NextResponse.json(result, { status: result.error ? 502 : result.connected ? 200 : 409, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo archivar en Drive. Las etiquetas siguen guardadas en CA46.' }, { status: 503 });
  }
}
