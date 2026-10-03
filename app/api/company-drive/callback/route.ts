import { after, NextResponse } from 'next/server';
import { saveDriveToken, archiveCompanyLabelsSafely } from '@/lib/company-drive-archive';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';
import { driveOAuthClient, verifyDriveOAuthState } from '@/lib/company-drive-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectToMiEmpresa(request: Request, params: Record<string, string>) {
  const url = new URL('/mi-empresa', request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

function escapeDriveQuery(value: string) {
  return value.replace(/'/g, "\\'");
}

async function findRootFolder(drive: any, companyId: string) {
  const response = await drive.files.list({
    q: `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='ca46CompanyId' and value='${escapeDriveQuery(companyId)}' }`,
    fields: 'files(id,name,webViewLink)',
    pageSize: 10,
  });
  return response.data.files?.[0] || null;
}

async function createRootFolder(drive: any, companyId: string, name: string) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      appProperties: { ca46CompanyId: companyId, ca46Kind: 'root' },
    },
    fields: 'id,name,webViewLink',
  });
  return response.data;
}

async function findOrCreateSubfolder(drive: any, companyId: string, name: string, parentId: string) {
  const response = await drive.files.list({
    q: `'${escapeDriveQuery(parentId)}' in parents and name='${escapeDriveQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name,webViewLink)',
    pageSize: 10,
  });
  const existing = response.data.files?.[0];
  if (existing?.id) return existing;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
      appProperties: { ca46CompanyId: companyId, ca46Kind: name.toLowerCase() },
    },
    fields: 'id,name,webViewLink',
  });
  return created.data;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const oauthError = requestUrl.searchParams.get('error') || '';
  if (oauthError) {
    return redirectToMiEmpresa(request, {
      drive: 'error',
      reason: oauthError === 'access_denied' ? 'Has cancelado la conexión con Google Drive.' : 'Google no pudo autorizar la conexión.',
    });
  }

  try {
    const code = requestUrl.searchParams.get('code') || '';
    const stateValue = requestUrl.searchParams.get('state') || '';
    if (!code || !stateValue) throw new Error('Google no devolvió todos los datos necesarios.');

    const state = verifyDriveOAuthState(stateValue);

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_members')
      .select('company_id, role, is_active')
      .eq('company_id', state.companyId)
      .eq('user_id', state.userId)
      .eq('is_active', true)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || membership.role !== 'admin_empresa') throw new Error('Ya no tienes permisos para conectar Drive en esta empresa.');

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name, status')
      .eq('id', state.companyId)
      .single();
    if (companyError) throw companyError;
    if (!['active', 'trial'].includes(company.status)) throw new Error('La empresa no está activa.');

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('company_settings')
      .select('business_name')
      .eq('company_id', state.companyId)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const businessName = String(settings?.business_name || company.name || '').trim();
    if (!businessName) throw new Error('Configura primero el nombre comercial de la empresa.');

    const oauth = driveOAuthClient(requestUrl.origin);
    const { tokens } = await oauth.getToken(code);
    oauth.setCredentials(tokens);

    const userInfo = await google.oauth2({ version: 'v2', auth: oauth }).userinfo.get();
    const accountEmail = String(userInfo.data.email || '').trim();
    if (!accountEmail) throw new Error('Google no devolvió el correo de la cuenta seleccionada.');

    const drive = google.drive({ version: 'v3', auth: oauth });
    const rootName = `CA46 - ${businessName}`.slice(0, 120);
    let root = await findRootFolder(drive, state.companyId);
    if (!root?.id) root = await createRootFolder(drive, state.companyId, rootName);
    if (!root?.id) throw new Error('No se pudo crear la carpeta principal de CA46.');

    let historyFolderId = '';
    for (const subfolder of ['Facturas', 'Etiquetas', 'Histórico']) {
      const folder = await findOrCreateSubfolder(drive, state.companyId, subfolder, root.id);
      if (subfolder === 'Histórico') historyFolderId = folder.id || '';
    }

    // Store a protected offline token: archival runs as the selected account.
    // A service account is no longer required to own files in a personal Drive.
    await saveDriveToken(state.companyId, tokens.refresh_token || '', historyFolderId);

    const folderUrl = root.webViewLink || `https://drive.google.com/drive/folders/${root.id}`;
    const { error: settingsSaveError } = await supabaseAdmin
      .from('company_settings')
      .update({
        drive_connected: true,
        drive_folder_id: root.id,
        drive_folder_url: folderUrl,
        drive_account_email: accountEmail,
        drive_last_sync_at: null,
      })
      .eq('company_id', state.companyId);
    if (settingsSaveError) throw settingsSaveError;

    after(() => archiveCompanyLabelsSafely(state.companyId));

    return redirectToMiEmpresa(request, { drive: 'connected', account: accountEmail });
  } catch (error: any) {
    console.error('company-drive callback: connection failed.');
    return redirectToMiEmpresa(request, {
      drive: 'error',
      reason: error?.message || 'No se pudo completar la conexión con Google Drive.',
    });
  }
}
