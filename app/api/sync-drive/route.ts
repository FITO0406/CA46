import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const DRIVE_ROOT_FOLDER_ID = '1g186tAcQ10eqkUKvT9s_eDdB2S-zCeOO'; // Carpeta ETIQUETAS

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

async function getDriveAuth() {
  let jsonString = GOOGLE_SA_JSON.trim();
  if ((jsonString.startsWith("'") && jsonString.endsWith("'")) || 
      (jsonString.startsWith('"') && jsonString.endsWith('"'))) {
    jsonString = jsonString.slice(1, -1);
  }
  const credentials = JSON.parse(jsonString);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return auth;
}

async function getOrCreateFolder(drive: any, parentId: string, folderName: string) {
  const query = `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' });
  
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  };
  const folder = await drive.files.create({ requestBody: fileMetadata, fields: 'id' });
  return folder.data.id;
}

export async function GET() {
  try {
    if (!GOOGLE_SA_JSON) {
      return NextResponse.json({ error: "Falta configuración de Google Drive" }, { status: 500 });
    }

    const auth = await getDriveAuth();
    const drive = google.drive({ version: 'v3', auth });

    // 1. Obtener o crear la carpeta "Procesadas" para archivar los archivos importados
    const processedFolderId = await getOrCreateFolder(drive, DRIVE_ROOT_FOLDER_ID, 'Procesadas');

    // 2. Listar archivos .txt en la carpeta raíz que inicien con "etiqueta_"
    const query = `'${DRIVE_ROOT_FOLDER_ID}' in parents and mimeType='text/plain' and name contains 'etiqueta_' and trashed=false`;
    const listRes = await drive.files.list({
      q: query,
      spaces: 'drive',
      fields: 'files(id, name, parents)',
      pageSize: 50
    });

    const files = listRes.data.files || [];
    if (files.length === 0) {
      return NextResponse.json({ message: "No hay etiquetas nuevas para procesar", processedCount: 0 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días de expiración
    const processedFiles = [];

    for (const file of files) {
      try {
        // A. Verificar si este drive_file_id ya existe en Supabase para evitar duplicados
        const { data: existing, error: checkError } = await supabase
          .from('digital_tags')
          .select('id')
          .eq('drive_file_id', file.id)
          .maybeSingle();

        if (checkError) {
          console.error(`Error verificando duplicados para el archivo ${file.id}:`, checkError);
          continue;
        }

        // Si ya existe, simplemente lo movemos a "Procesadas" si está en la raíz
        if (existing) {
          console.log(`El archivo ${file.name} (${file.id}) ya fue insertado anteriormente. Moviéndolo a Procesadas...`);
          await drive.files.update({
            fileId: file.id,
            addParents: processedFolderId,
            removeParents: DRIVE_ROOT_FOLDER_ID,
            fields: 'id, parents'
          });
          continue;
        }

        // B. Descargar el contenido del archivo de texto
        const fileContentRes = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'text' }
        );

        const text = fileContentRes.data as string;
        if (!text) continue;

        // C. Parsear los campos utilizando regex
        const descMatch = text.match(/Descripcion:\s*(.*)/i);
        const originMatch = text.match(/Procedencia:\s*(.*)/i);
        const faoMatch = text.match(/FAO:\s*(.*)/i);
        const brandMatch = text.match(/Marca:\s*(.*)/i);

        const product_name = descMatch && descMatch[1] && descMatch[1].trim() !== 'null'
          ? descMatch[1].trim()
          : 'Producto Desconocido';

        let origin = originMatch && originMatch[1] && originMatch[1].trim() !== 'null'
          ? originMatch[1].trim()
          : '';

        const faoVal = faoMatch && faoMatch[1] ? faoMatch[1].trim() : '';
        if (faoVal && faoVal !== 'null') {
          origin = origin ? `${origin} (FAO ${faoVal})` : `FAO ${faoVal}`;
        }

        const category = brandMatch && brandMatch[1] && brandMatch[1].trim() !== 'null'
          ? brandMatch[1].trim()
          : 'Pescado Fresco';

        // D. Insertar en la base de datos de Supabase
        const { error: insertError } = await supabase.from('digital_tags').insert({
          drive_file_id: file.id,
          product_name,
          price: null, // "Consultar"
          unit: 'Kg',
          origin: origin || 'Desconocida',
          category,
          is_active: true,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        });

        if (insertError) {
          console.error(`Error guardando en Supabase para el archivo ${file.name}:`, insertError);
          continue;
        }

        // E. Mover el archivo a la carpeta "Procesadas" para liberar el directorio de entrada
        await drive.files.update({
          fileId: file.id,
          addParents: processedFolderId,
          removeParents: DRIVE_ROOT_FOLDER_ID,
          fields: 'id, parents'
        });

        processedFiles.push(file.name);

      } catch (err) {
        console.error(`Fallo procesando el archivo ${file.name}:`, err);
      }
    }

    return NextResponse.json({
      message: "Procesamiento de etiquetas de Drive completado",
      processedCount: processedFiles.length,
      processedFiles
    });

  } catch (error: any) {
    console.error("Error en sincronización de Drive:", error);
    return NextResponse.json({ error: "Error en el servidor: " + error.message }, { status: 500 });
  }
}
