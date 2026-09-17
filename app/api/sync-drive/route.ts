import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';
import { google } from 'googleapis';
import { encodeTraceability, parseTraceabilityText } from '@/lib/traceability';

// Environment variables
const GOOGLE_SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || '1g186tAcQ10eqkUKvT9s_eDdB2S-zCeOO'; // default

/**
 * Parse the raw JSON string from the environment variable. Handles quotes that may be stored
 * with surrounding single or double quotes.
 */
function getCredentials() {
  let jsonString = GOOGLE_SA_JSON.trim();
  if ((jsonString.startsWith("'") && jsonString.endsWith("'")) ||
      (jsonString.startsWith('"') && jsonString.endsWith('"')) ) {
    jsonString = jsonString.slice(1, -1);
  }
  const creds = JSON.parse(jsonString);
  if (creds.private_key) {
    let key = creds.private_key.replace(/\\n/g, '\n');
    // If newlines were completely stripped, we need to reconstruct the PEM format
    key = key.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s+/g, '');
    const chunks = key.match(/.{1,64}/g) || [];
    creds.private_key = '-----BEGIN PRIVATE KEY-----\n' + chunks.join('\n') + '\n-----END PRIVATE KEY-----\n';
  }
  return creds;
}

/** Return an authenticated Google Drive client */
async function getDriveClient() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

/** Download the raw text content of a Drive file or export a Google Doc */
async function downloadFile(drive: any, fileId: string, mimeType: string): Promise<string> {
  let res;
  if (mimeType === 'application/vnd.google-apps.document') {
    res = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    }, { responseType: 'stream' });
  } else {
    res = await drive.files.get({
      fileId,
      alt: 'media',
    }, { responseType: 'stream' });
  }

  return new Promise((resolve, reject) => {
    let data = '';
    res.data.on('data', (chunk: Buffer) => (data += chunk.toString()));
    res.data.on('end', () => resolve(data));
    res.data.on('error', (err: any) => reject(err));
  });
}

/** Main handler – GET */
export async function GET() {
  try {
    const drive = await getDriveClient();

    // List text files or Google Docs directly under the root folder (no recursion for simplicity)
    const listRes = await drive.files.list({
      q: `'${DRIVE_ROOT_FOLDER_ID}' in parents and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document') and trashed=false`,
      fields: 'files(id, name, mimeType)',
    });
    const files = listRes.data.files || [];
    if (files.length === 0) {
      return NextResponse.json({ message: 'No files found in Drive folder.', folderId: DRIVE_ROOT_FOLDER_ID }, { status: 200 });
    }

    const now = new Date().toISOString();
    const records: any[] = [];
    const fileNames: string[] = files.map((f: any) => f.name || 'unknown');
    const errors: string[] = [];

    for (const f of files) {
      if (!f.id) continue;
      const fileName = f.name || 'file';

      let txtContent = '';
      try {
        txtContent = await downloadFile(drive, f.id, f.mimeType || '');
      } catch (e: any) {
        const msg = `Download failed for ${fileName}: ${e?.message || e}`;
        console.error(msg);
        errors.push(msg);
        continue;
      }

      const traceability = parseTraceabilityText(txtContent, fileName);

      records.push({
        drive_file_id: f.id,
        product_name: traceability.description,
        price: 0,
        unit: 'kg',
        origin: traceability.origin || null,
        category: encodeTraceability(traceability),
        is_active: true,
        created_at: now,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    if (records.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from('digital_tags').upsert(records, { onConflict: 'drive_file_id' });
      if (insertErr) {
        console.error('Insert error:', insertErr);
        return NextResponse.json({ error: insertErr.message, errors }, { status: 500 });
      }
    }

    return NextResponse.json({ synchronized: records.length, totalFound: files.length, fileNames, errors, message: 'Sync completed.' }, { status: 200 });
  } catch (e: any) {
    console.error('Sync-drive error:', e);
    let debugEmail = 'not found';
    try {
      const creds = getCredentials();
      debugEmail = creds.client_email || 'no email';
    } catch(err) {}
    return NextResponse.json({ error: e.message || 'Unexpected error', debug: debugEmail }, { status: 500 });
  }
}
