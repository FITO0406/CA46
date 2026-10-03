import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';
import { driveOAuthClient } from '@/lib/company-drive-oauth';
import { decodeTraceability } from '@/lib/traceability';

function encryptionKey() {
  const secret = process.env.DRIVE_TOKEN_ENCRYPTION_KEY || process.env.DRIVE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Falta configurar la protección de la conexión Drive.');
  return createHash('sha256').update(secret).digest();
}

export function encryptDriveToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptDriveToken(value: string) {
  const [version, iv, authTag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !authTag || !encrypted) throw new Error('Vuelve a conectar tu cuenta de Google.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

export async function saveDriveToken(companyId: string, refreshToken: string) {
  if (!refreshToken) throw new Error('Google no concedió acceso permanente. Vuelve a conectar y autoriza Drive.');
  const { error } = await supabaseAdmin.from('company_drive_credentials').upsert({
    company_id: companyId, refresh_token_encrypted: encryptDriveToken(refreshToken), last_error: null,
  }, { onConflict: 'company_id' });
  if (error) throw error;
}

export async function archiveDriveClient(encryptedToken?: string | null) {
  if (encryptedToken) {
    const auth = driveOAuthClient();
    auth.setCredentials({ refresh_token: decryptDriveToken(encryptedToken) });
    return google.drive({ version: 'v3', auth });
  }
  // Legacy shared folders remain usable, provided the service account can write.
  let raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) raw = raw.slice(1, -1);
  if (!raw) throw new Error('Conecta una cuenta de Google para guardar el histórico.');
  const credentials = JSON.parse(raw);
  credentials.private_key = String(credentials.private_key || '').replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
}

function escapeQuery(value: string) { return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

async function historyFolder(drive: ReturnType<typeof google.drive>, root: string) {
  const { data } = await drive.files.list({ q: `'${escapeQuery(root)}' in parents and name='Histórico' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)', pageSize: 10 });
  if (data.files?.[0]?.id) return data.files[0].id;
  const created = await drive.files.create({ requestBody: { name: 'Histórico', mimeType: 'application/vnd.google-apps.folder', parents: [root] }, fields: 'id' });
  if (!created.data.id) throw new Error('No se pudo preparar la carpeta Histórico.');
  return created.data.id;
}

export function driveHistoryDocument(tag: Record<string, unknown>, businessName: string) {
  const trace = decodeTraceability(String(tag.category || ''));
  const hours = tag.source === 'physical_label' ? 24 : 72;
  const safeTrace = trace ? { ...trace, extraFields: trace.extraFields?.filter((field) => !/(precio|importe|total|iva|coste|€)/i.test(field.label)) } : null;
  return JSON.stringify({
    formato: 'CA46 histórico de etiqueta v1', empresa: businessName,
    id: tag.id, origen: tag.source, estado: tag.status, producto: tag.product_name,
    lote_madre_id: tag.parent_tag_id || null, publicada: tag.created_at,
    fin_exposicion: tag.expires_at, horas_exposicion: hours,
    anulada: tag.annulled_at || null, motivo_anulacion: tag.annulled_reason || null,
    trazabilidad: safeTrace, procedencia: tag.origin,
    nota: 'Copia histórica. La caducidad de exposición no elimina este archivo.',
  }, null, 2);
}

export type DriveArchiveResult = { connected: boolean; archived: number; pending: number; busy?: boolean; error?: string };

export async function archiveCompanyLabels(companyId: string, limit = 30): Promise<DriveArchiveResult> {
  const { data: settings, error: settingsError } = await supabaseAdmin.from('company_settings')
    .select('drive_connected,drive_folder_id,business_name').eq('company_id', companyId).maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.drive_connected || !settings.drive_folder_id) return { connected: false, archived: 0, pending: 0 };
  const root = String(settings.drive_folder_id);
  const { error: initError } = await supabaseAdmin.from('company_drive_credentials').upsert({ company_id: companyId }, { onConflict: 'company_id', ignoreDuplicates: true });
  if (initError) throw initError;
  const lease = randomUUID();
  const { data: connection, error: lockError } = await supabaseAdmin.from('company_drive_credentials')
    .update({ lease_id: lease, lease_until: new Date(Date.now() + 120000).toISOString() })
    .eq('company_id', companyId).or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`)
    .select('refresh_token_encrypted').maybeSingle();
  if (lockError) throw lockError;
  if (!connection) return { connected: true, archived: 0, pending: 0, busy: true };
  let archived = 0;
  let failure: string | null = null;
  let pending = 0;
  const started = Date.now();
  try {
    const { data: rows, error } = await supabaseAdmin.rpc('drive_pending_labels', { p_company_id: companyId, p_root_folder_id: root, p_limit: limit });
    if (error) throw error;
    pending = rows?.length || 0;
    if (pending) {
      const drive = await archiveDriveClient(connection.refresh_token_encrypted);
      const folder = await historyFolder(drive, root);
      for (const row of rows || []) {
        if (Date.now() - started > 45000) break;
        const tag = row.tag as Record<string, unknown>;
        let fileId = row.file_id as string | null;
        let alreadyUploaded = false;
        if (fileId) {
          try {
            const file = await drive.files.get({ fileId, fields: 'id,trashed,parents' });
            if (file.data.trashed || !file.data.parents?.includes(folder)) throw new Error('El archivo histórico fue movido o eliminado; revisa Drive.');
            alreadyUploaded = true;
          } catch (error: unknown) {
            if ((error as { code?: number }).code !== 404) throw error;
          }
        } else {
          const ids = await drive.files.generateIds({ count: 1, space: 'drive', type: 'files' });
          fileId = ids.data.ids?.[0] || null;
          if (!fileId) throw new Error('Google no devolvió un identificador de archivo.');
          const saved = await supabaseAdmin.from('company_drive_archives').upsert({ company_id: companyId, tag_id: tag.id, root_folder_id: root, file_id: fileId }, { onConflict: 'company_id,tag_id,root_folder_id' });
          if (saved.error) throw saved.error;
        }
        if (!alreadyUploaded) {
          const product = String(tag.product_name || 'Etiqueta').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 70);
          await drive.files.create({ requestBody: {
            id: fileId, name: `${String(tag.created_at).slice(0, 10)}_${product}_${tag.id}.json`,
            parents: [folder], mimeType: 'application/json',
            appProperties: { ca46CompanyId: companyId, ca46TagId: String(tag.id), ca46Kind: 'history' },
          }, media: { mimeType: 'application/json', body: Readable.from([driveHistoryDocument(tag, settings.business_name || 'CA46')]) }, fields: 'id' });
        }
        const saved = await supabaseAdmin.from('company_drive_archives').update({ archived_at: new Date().toISOString() })
          .eq('company_id', companyId).eq('tag_id', tag.id).eq('root_folder_id', root);
        if (saved.error) throw saved.error;
        archived += 1;
      }
    }
  } catch {
    // Do not expose Google request objects: they may contain access tokens.
    failure = 'No se pudo guardar el histórico en Drive. Revisa la cuenta, sus permisos y espacio disponible; las etiquetas siguen en CA46 para reintentar.';
  } finally {
    await supabaseAdmin.from('company_drive_credentials').update({ lease_id: null, lease_until: null,
      last_archive_at: archived ? new Date().toISOString() : undefined, last_error: failure,
    }).eq('company_id', companyId).eq('lease_id', lease);
  }
  return { connected: true, archived, pending: Math.max(0, pending - archived), ...(failure ? { error: failure } : {}) };
}

export async function archiveCompanyLabelsSafely(companyId: string) {
  try { await archiveCompanyLabels(companyId); } catch { console.error('Drive history: archival pending; retry required.'); }
}
