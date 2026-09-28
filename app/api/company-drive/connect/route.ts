import { NextResponse } from 'next/server';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { DRIVE_OAUTH_SCOPES, createDriveOAuthState, driveOAuthClient } from '@/lib/company-drive-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) {
      return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers: { 'Cache-Control': 'no-store' } });
    }
    if (tenant.context.role !== 'admin_empresa') {
      return NextResponse.json({ error: 'Solo el administrador puede conectar Google Drive.' }, { status: 403 });
    }

    const origin = new URL(request.url).origin;
    const oauth = driveOAuthClient(origin);
    const state = createDriveOAuthState(tenant.context.companyId, tenant.context.userId);
    const url = oauth.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account consent',
      include_granted_scopes: true,
      scope: DRIVE_OAUTH_SCOPES,
      state,
    });

    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('company-drive connect error:', error);
    return NextResponse.json(
      { error: error?.message || 'No se pudo iniciar la conexión con Google Drive.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
