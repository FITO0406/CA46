import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';
import { encodeTraceability, parseTraceabilityText } from '@/lib/traceability';

const GOOGLE_SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const SYNC_THROTTLE_MS = 20_000;
const DEFINITIVE_HOURS = 72;

type SyncOptions = {
  companyId: string;
  userId?: string | null;
  force?: boolean;
};

export type CompanyDriveSyncResult = {
  ok: true;
  configured: boolean;
  throttled: boolean;
  folderId?: string;
  found: number;
  imported: number;
  skipped: number;
  expired: number;
  errors: string[];
  syncedAt: string;
};

function getCredentials() {
  let jsonString = GOOGLE_SA_JSON.trim();
  if (!jsonString) throw new Error('Google Drive no está configurado en CA46.');

  if ((jsonString.startsWith("'") && jsonString.endsWith("'")) || (jsonString.startsWith('"') && jsonString.endsWith('"'))) {
    jsonString = jsonString.slice(1, -1);
  }

  const creds = JSON.parse(jsonString);
  if (creds.private_key) {
    let key = String(creds.private_key).replace(/\\n/g, '\n');
    key = key
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s+/g, '');
    const chunks = key.match(/.{1,64}/g) || [];
    creds.private_key = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;
  }
  return creds;
}

async function driveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

function escapeDriveQuery(value: string) {
  return value.replace(/'/g, "\\'");
}

async function findEtiquetasFolder(drive: any, rootFolderId: string) {
  const response = await drive.files.list({
    q: `'${escapeDriveQuery(rootFolderId)}' in parents and name='Etiquetas' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 10,
  });
  return response.data.files?.[0]?.id || '';
}

async function listTraceabilityFiles(drive: any, folderId: string) {
  const files: Array<{ id?: string | null; name?: string | null; mimeType?: string | null }> = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${escapeDriveQuery(folderId)}' in parents and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document') and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType)',
      pageSize: 500,
      pageToken,
      orderBy: 'createdTime desc',
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

async function downloadText(drive: any, fileId: string, mimeType: string) {
  let response: any;
  if (mimeType === 'application/vnd.google-apps.document') {
    response = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'stream' });
  } else {
    response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  }

  return new Promise<string>((resolve, reject) => {
    let data = '';
    response.data.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    response.data.on('end', () => resolve(data));
    response.data.on('error', reject);
  });
}

async function deactivateExpired(companyId: string, nowIso: string) {
  const { data, error } = await supabaseAdmin
    .from('digital_tags')
    .update({ is_active: false })
    .eq('company_id', companyId)
    .eq('is_active', true)
    .lte('expires_at', nowIso)
    .select('id');

  if (error) throw error;
  return data?.length || 0;
}

export async function syncCompanyDrive({ companyId, userId = null, force = false }: SyncOptions): Promise<CompanyDriveSyncResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const expired = await deactivateExpired(companyId, nowIso);

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('company_settings')
    .select('business_name, drive_connected, drive_folder_id, drive_last_sync_at')
    .eq('company_id', companyId)
    .maybeSingle();

  if (settingsError) throw settingsError;

  if (!settings?.drive_connected || !settings.drive_folder_id) {
    return {
      ok: true,
      configured: false,
      throttled: false,
      found: 0,
      imported: 0,
      skipped: 0,
      expired,
      errors: [],
      syncedAt: nowIso,
    };
  }

  const lastSyncMs = settings.drive_last_sync_at ? new Date(settings.drive_last_sync_at).getTime() : 0;
  if (!force && Number.isFinite(lastSyncMs) && now.getTime() - lastSyncMs < SYNC_THROTTLE_MS) {
    return {
      ok: true,
      configured: true,
      throttled: true,
      found: 0,
      imported: 0,
      skipped: 0,
      expired,
      errors: [],
      syncedAt: settings.drive_last_sync_at || nowIso,
    };
  }

  const drive = await driveClient();
  const etiquetasFolderId = await findEtiquetasFolder(drive, settings.drive_folder_id);
  if (!etiquetasFolderId) {
    throw new Error('No se encontró la carpeta Etiquetas dentro del Drive de esta empresa. Pulsa Revisar Drive en Mi empresa.');
  }

  const files = await listTraceabilityFiles(drive, etiquetasFolderId);
  const fileIds = files.map((file) => file.id).filter((id): id is string => Boolean(id));

  let existingIds = new Set<string>();
  if (fileIds.length) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('digital_tags')
      .select('drive_file_id')
      .eq('company_id', companyId)
      .in('drive_file_id', fileIds);

    if (existingError) throw existingError;
    existingIds = new Set((existing || []).map((row: any) => String(row.drive_file_id)));
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    if (!file.id) continue;
    if (existingIds.has(file.id)) {
      skipped += 1;
      continue;
    }

    const fileName = file.name || 'etiqueta.txt';
    try {
      const text = await downloadText(drive, file.id, file.mimeType || 'text/plain');
      const traceability = parseTraceabilityText(text, fileName);
      traceability.establishment = String(settings.business_name || traceability.establishment || 'CA46').trim();

      if (!traceability.description || !traceability.lot || !traceability.origin) {
        errors.push(`${fileName}: faltan especie, lote o procedencia.`);
        skipped += 1;
        continue;
      }

      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + DEFINITIVE_HOURS * 60 * 60 * 1000);
      const { error: insertError } = await supabaseAdmin.from('digital_tags').insert({
        company_id: companyId,
        created_by_user_id: userId || null,
        source: 'invoice',
        status: 'definitive',
        drive_file_id: file.id,
        product_name: traceability.description,
        price: 0,
        unit: 'kg',
        origin: traceability.origin || null,
        category: encodeTraceability(traceability),
        is_active: true,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (insertError) {
        if (String(insertError.code) === '23505') {
          skipped += 1;
          continue;
        }
        throw insertError;
      }
      imported += 1;
    } catch (error: any) {
      errors.push(`${fileName}: ${error?.message || 'no se pudo importar'}`);
      skipped += 1;
    }
  }

  await supabaseAdmin
    .from('company_settings')
    .update({ drive_last_sync_at: nowIso })
    .eq('company_id', companyId);

  return {
    ok: true,
    configured: true,
    throttled: false,
    folderId: etiquetasFolderId,
    found: files.length,
    imported,
    skipped,
    expired,
    errors,
    syncedAt: nowIso,
  };
}
