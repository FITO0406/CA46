import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || '1g186tAcQ10eqkUKvT9s_eDdB2S-zCeOO';

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
    const body = await request.json().catch(() => ({}));
    const companyName = String(body?.companyName || '').trim();
    if (!companyName) {
      return NextResponse.json({ error: 'Escribe primero el nombre comercial de la empresa.' }, { status: 400 });
    }

    const drive = await getDriveClient();
    const rootName = `CA46 - ${companyName}`.slice(0, 120);
    const root = await findOrCreateFolder(drive, rootName, DRIVE_ROOT_FOLDER_ID);
    if (!root?.id) throw new Error('No se pudo crear la carpeta de empresa.');

    for (const subfolder of ['Facturas', 'Etiquetas', 'Histórico']) {
      await findOrCreateFolder(drive, subfolder, root.id);
    }

    const folderUrl = root.webViewLink || `https://drive.google.com/drive/folders/${root.id}`;
    return NextResponse.json({
      folderId: root.id,
      folderUrl,
      folderName: rootName,
      subfolders: ['Facturas', 'Etiquetas', 'Histórico'],
    });
  } catch (error: any) {
    console.error('company-drive error:', error);
    return NextResponse.json({ error: error?.message || 'No se pudo preparar Google Drive.' }, { status: 500 });
  }
}
