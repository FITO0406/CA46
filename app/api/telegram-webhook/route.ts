import { NextResponse, after } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GOOGLE_SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const DRIVE_ROOT_FOLDER_ID = '1g186tAcQ10eqkUKvT9s_eDdB2S-zCeOO'; // Carpeta ETIQUETAS

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function getTelegramFile(fileId: string): Promise<Uint8Array> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
  const data = await res.json();
  const filePath = data.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`);
  return new Uint8Array(await fileRes.arrayBuffer());
}

async function sendTelegramMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}

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

async function uploadTextToDrive(drive: any, parentId: string, fileName: string, textContent: string) {
  const fileMetadata = {
    name: fileName,
    parents: [parentId]
  };
  const media = {
    mimeType: 'text/plain',
    body: textContent
  };
  await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id'
  });
}

export async function POST(req: Request) {
  try {
    const update = await req.json();

    if (!update.message || !update.message.photo) {
      return NextResponse.json({ message: "No es una foto, ignorado" }, { status: 200 });
    }

    const chatId = update.message.chat.id;
    const photos = update.message.photo;
    const fileId = photos[photos.length - 1].file_id;

    after(async () => {
      try {
        await sendTelegramMessage(chatId, "Procesando factura con Antigravity 2026 (Gemini 2.5 Flash)...");

        const imageBytes = await getTelegramFile(fileId);

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Eres un asistente experto en lectura de facturas del Mercado Mayorista de Pescados de Mercasevilla.
Extrae los datos en formato JSON EXACTAMENTE con esta estructura (nada de markdown, solo JSON puro):
{
  "expedicion": { "codigo_ce": null },
  "comprador": { "nombre": null, "codigo": null },
  "productos": [
    {
      "descripcion": null,
      "lote": null,
      "marca": null,
      "kg_neto": null,
      "metodo_produccion": null,
      "presentacion": null,
      "procedencia": null,
      "fao": null,
      "frescura": null,
      "arte": null
    }
  ]
}
Sigue estas reglas estrictas:
1) Usa SOLO informacion claramente visible.
2) NO inventes. Si no esta, usa null.
3) NO incluyas precios, importes, IVA ni totales.`;

        const imageParts = [
          {
            inlineData: {
              data: Buffer.from(imageBytes).toString('base64'),
              mimeType: "image/jpeg"
            }
          }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        let responseText = result.response.text();
        if (responseText.startsWith('```json')) {
          responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        const extractedData = JSON.parse(responseText);

        const now = new Date();
        const expDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 dias

        const dbInserts = [];
        let txtFileContent = '';

        for (const producto of extractedData.productos) {
          dbInserts.push({
            drive_file_id: `telegram_${fileId}_${Math.random().toString(36).substring(7)}`,
            product_name: producto.descripcion || 'Producto Desconocido',
            price: 0,
            unit: 'kg',
            origin: producto.procedencia || null,
            category: 'General',
            is_active: true,
            created_at: now.toISOString(),
            expires_at: expDate.toISOString()
          });

          txtFileContent += `--------------------------------
MERCASEVILLA - PABELLON PESCADOS
--------------------------------
Descripcion: ${producto.descripcion}
Lote: ${producto.lote}
Marca: ${producto.marca}
Kg neto: ${producto.kg_neto}
Metodo: ${producto.metodo_produccion}
Presentacion: ${producto.presentacion}
Procedencia: ${producto.procedencia}
FAO: ${producto.fao}
Frescura: ${producto.frescura}
Arte: ${producto.arte}
CE: ${extractedData.expedicion?.codigo_ce}
--------------------------------
Comprador: ${extractedData.comprador?.nombre}
N: ${extractedData.comprador?.codigo}
--------------------------------\n\n`;
        }

        if (dbInserts.length > 0) {
          const { error } = await supabase.from('digital_tags').insert(dbInserts);
          if (error) throw new Error("Error guardando en base de datos: " + error.message);
        }

        if (txtFileContent && GOOGLE_SA_JSON) {
          const auth = await getDriveAuth();
          const drive = google.drive({ version: 'v3', auth });

          const year = String(now.getFullYear());
          const month = String(now.getMonth() + 1).padStart(2, '0');

          const yearFolderId = await getOrCreateFolder(drive, DRIVE_ROOT_FOLDER_ID, year);
          const monthFolderId = await getOrCreateFolder(drive, yearFolderId, month);

          const firstProduct = extractedData.productos[0]?.descripcion || 'Varios';
          const timestamp = now.toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15);
          const fileName = `etiqueta_${timestamp}_${firstProduct}.txt`;

          await uploadTextToDrive(drive, monthFolderId, fileName, txtFileContent);
        }

        await sendTelegramMessage(chatId, `✅ Etiqueta procesada y archivada con exito.\nProductos: ${extractedData.productos.length}\nCarpeta: /${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`);

      } catch (innerError: any) {
        console.error("[ERROR] Error en el procesamiento diferido del webhook:", innerError);
        try {
          await sendTelegramMessage(chatId, `❌ Ocurrio un error al procesar tu factura:\n${innerError.message || 'Error desconocido'}`);
        } catch (tgError) {
          console.error("Error al enviar mensaje de error a Telegram:", tgError);
        }
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error("[ERROR] Error al recibir webhook:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
