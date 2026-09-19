import { NextResponse } from 'next/server';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { syncCompanyDrive } from '@/lib/company-drive-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) {
      return NextResponse.json(
        { error: tenant.error },
        { status: tenant.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await syncCompanyDrive({
      companyId: tenant.context.companyId,
      userId: tenant.context.userId,
      force: true,
    });

    if (!result.configured) {
      return NextResponse.json(
        { error: 'Primero prepara Google Drive desde Mi empresa.', code: 'DRIVE_NOT_CONFIGURED' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('sync-drive error:', error);
    return NextResponse.json(
      { error: error?.message || 'No se pudo sincronizar la carpeta Etiquetas.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Usa la sincronización desde una sesión CA46.' },
    { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } },
  );
}
