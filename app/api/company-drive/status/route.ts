import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { driveOAuthConfigured } from '@/lib/company-drive-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) {
      return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('company_settings')
      .select('drive_connected, drive_folder_id, drive_folder_url, drive_account_email')
      .eq('company_id', tenant.context.companyId)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const accountEmail = String(settings?.drive_account_email || '').trim();
    const connected = Boolean(settings?.drive_connected && settings?.drive_folder_id);

    return NextResponse.json(
      {
        connected,
        mode: accountEmail ? 'oauth' : connected ? 'legacy' : 'none',
        accountEmail,
        folderId: settings?.drive_folder_id || '',
        folderUrl: settings?.drive_folder_url || '',
        oauthReady: driveOAuthConfigured(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    console.error('company-drive status error:', error);
    return NextResponse.json(
      { error: error?.message || 'No se pudo consultar Google Drive.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
