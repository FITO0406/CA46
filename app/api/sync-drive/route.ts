import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || '1g186tAcQ10eqkUKvT9s_eDdB2S-zCeOO';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getCredentials() {
    let jsonString = GOOGLE_SA_JSON.trim();
    if ((jsonString.startsWith("'") && jsonString.endsWith("'")) ||
              (jsonString.startsWith('\"') && jsonString.endsWith('\"')) ) {
          jsonString = jsonString.slice(1, -1);
    }
    return JSON.parse(jsonString);
}

async function getDriveClient() {
    const credentials = getCredentials();
    const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
}

async function downloadFile(drive: any, fileId: string): Promise<string> {
    const res = await drive.files.get({
          fileId,
          alt: 'media',
    }, { responseType: 'stream' });
    return new Promise((resolve, reject) => {
          let data = '';
          res.data.on('data', (chunk: Buffer) => (data += chunk.toString()));
          res.data.on('end', () => resolve(data));

                           res.data.on('error', (err: any) => reject(err));
    });
}

export async function GET() {
    try {
          const drive = await getDriveClient();
          const listRes = await drive.files.list({
                  q: `'${DRIVE_ROOT_FOLDER_ID}' in parents and mimeType='text/plain' and trashed=false`,
                  fields: 'files(id, name)',
          });
          const files = listRes.data.files || [];
          if (files.length === 0) {
                  return NextResponse.json({ message: 'No new files found.' }, { status: 200 });
          }

      const now = new Date().toISOString();
          const inserts: any[] = [];

      for (const f of files) {
          if (!f.id || !f.name) continue;
              const { data: existing, error: errCheck } = await supabase
                .from('digital_tags')
                .select('id')
                .eq('drive_file_id', f.id)
                .limit(1);
              if (errCheck) {
                        console.error('Supabase check error:', errCheck);
                        continue;
              }
              if (existing && existing.length > 0) {
                        continue;
              }

            let txtContent = '';
              try {
                        txtContent = await downloadFile(drive, f.id);
              } catch (e) {
                        console.error('Failed to download file', f.id, e);
                        continue;
              }

            let productName = f.name.replace(/\\.txt$/i, '');
            const match = txtContent.match(/Descripcion:\\s*(.*)/i);
              if (match && match[1]) {
                        productName = match[1].trim();
              }

            inserts.push({
                      drive_file_id: f.id,
                      product_name: productName,
                      price: null,
                      unit: 'kg',
                      origin: null,
                      category: 'General',
                      is_active: true,
                      created_at: now,
                      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            });
      }

      if (inserts.length > 0) {
              const { error: insertErr } = await supabase.from('digital_tags').insert(inserts);
              if (insertErr) {
                        console.error('Insert error:', insertErr);
                        return NextResponse.json({ error: insertErr.message }, { status: 500 });
              }
      }

      return NextResponse.json({ inserted: inserts.length, message: 'Sync completed.' }, { status: 200 });
    } catch (e: any) {
          console.error('Sync-drive error:', e);
          return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
    }
}
