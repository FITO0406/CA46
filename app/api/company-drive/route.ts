import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || '1g186tAcQ10eqkUKvT9s_eDdB2S-zCeOO';

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function tenantForRequest(request: Request) {
  const token = bearerToken(request);
  if (!token) return { error: 'No autorizado.', status: 401 as const };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return { error: 'No autorizado.', status: 401 as const };

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_members')
    .select('company_id, role, is_active')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return { error: 'Primero debes activar tu empresa.', status: 409 as const };
  if (membership.role !== 'admin_empresa') return { error: 'Solo el administrador puede preparar Drive.', status: 403 as const };

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, status')
    .eq('id', membership.company_id)
    .single();

  if (companyError) throw companyError;
  if (!['active', 'trial'].includes(company.status)) return { error: 'La empresa no está activa.', status: 403 as const };

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('company_settings')
    .select('business_name')
    .eq('company_id', company.id)
    .maybeSingle();

  if (settingsError) throw settingsError;

  return {
    companyId: company.id,
    companyName: String(settings?.business_name || company.name || '').trim(),
    status: 200 as const,
  };
}

function getCredentials() {
  let jsonString = GOOGLE_SA_JSON.trim();
  if (!jsonString) throw new Error('Google Drive no está configurado en CA46.');
  if ((jsonString.startsWith("'") && jsonString.endsWith("'")) || (jsonString.startsWith('"') && jsonString.endsWith('"'))) {
    jsonString = jsonString.slice(1, -1);
  }
  const creds = JSON.parse(jsonString);
  if (creds.private_key) {
    let key = creds.private_key.replace(/\\n/g, '\n');
    key = key.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s+/g, '');
    const chunks = key.match(/.{1,64}/g) || [];
    creds.private_key = '-----BEGIN PRIVATE KEY-----\n' + chunks.join('\n') + '\n-----END PRIVATE KEY-----\n';
  }
  return creds;
}

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

function escapeDriveQuery(value: string) {
  return value.replace(/'/g, "\\'");
}

async function findOrCreateFolder(drive: any, name: string, parentId: string) {
  const list = await drive.files.list({
    q: `'${parentId}' in parents and name='${escapeDriveQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name,webViewLink)',
    pageSize: 10,
  });
  const existing = list.data.files?.[0];
  if (existing?.id) return existing;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id,name,webViewLink',
  });
  return created.data;
}

export async function POST(request: Request) {
  try {
    const tenant = await tenantForRequest(request);
    if ('error' in tenant) {
      return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!tenant.companyName) {
      return NextResponse.json({ error: 'Configura primero el nombre comercial de la empresa.' }, { status: 400 });
    }

    const drive = await getDriveClient();
    const rootName = `CA46 - ${tenant.companyName}`.slice(0, 120);
    const root = await findOrCreateFolder(drive, rootName, DRIVE_ROOT_FOLDER_ID);
    if (!root?.id) throw new Error('No se pudo crear la carpeta de empresa.');

    for (const subfolder of ['Facturas', 'Etiquetas', 'Histórico']) {
      await findOrCreateFolder(drive, subfolder, root.id);
    }

    const folderUrl = root.webViewLink || `https://drive.google.com/drive/folders/${root.id}`;

    const { error: saveError } = await supabaseAdmin
      .from('company_settings')
      .upsert(
        {
          company_id: tenant.companyId,
          drive_connected: true,
          drive_folder_id: root.id,
          drive_folder_url: folderUrl,
        },
        { onConflict: 'company_id' },
      );

    if (saveError) throw saveError;

    return NextResponse.json(
      {
        folderId: root.id,
        folderUrl,
        folderName: rootName,
        subfolders: ['Facturas', 'Etiquetas', 'Histórico'],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    console.error('company-drive error:', error);
    return NextResponse.json(
      { error: error?.message || 'No se pudo preparar Google Drive.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
