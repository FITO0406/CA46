import { after, NextResponse } from 'next/server';
import { archiveCompanyLabelsSafely } from '@/lib/company-drive-archive';
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
    const { data: archiveState } = await supabaseAdmin.from('company_drive_credentials')
      .select('refresh_token_encrypted,last_archive_at,last_error,history_folder_id').eq('company_id', tenant.context.companyId).maybeSingle();
    const { data: pending } = connected ? await supabaseAdmin.rpc('drive_pending_labels', {
      p_company_id: tenant.context.companyId, p_root_folder_id: settings!.drive_folder_id, p_limit: 100,
    }) : { data: [] };
    const privateConnected = connected && Boolean(archiveState?.refresh_token_encrypted);
    if (privateConnected) after(() => archiveCompanyLabelsSafely(tenant.context.companyId));

    return NextResponse.json(
      {
        connected: privateConnected,
        mode: accountEmail ? 'oauth' : connected ? 'legacy' : 'none',
        accountEmail,
        folderId: settings?.drive_folder_id || '',
        folderUrl: settings?.drive_folder_url || '',
        historyUrl: privateConnected && archiveState?.history_folder_id
          ? `https://drive.google.com/drive/folders/${archiveState.history_folder_id}` : '',
        oauthReady: driveOAuthConfigured(),
        archiveReady: Boolean(archiveState?.refresh_token_encrypted),
        archivedAt: archiveState?.last_archive_at || '',
        archiveError: archiveState?.last_error || '',
        pendingLabels: pending?.length || 0,
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
