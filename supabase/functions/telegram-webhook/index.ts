import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "npm:@google/generative-ai"
import { google } from "npm:googleapis"

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// El JSON de la cuenta de servicio de Google debe estar guardado como string en base64 o como string literal en las variables de entorno.
// Usaremos GOOGLE_SERVICE_ACCOUNT_JSON
const GOOGLE_SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
const DRIVE_ROOT_FOLDER_ID = '1g186tAcQ10eqkUKvT9s_eDdB2S-zCeOO' // Carpeta ETIQUETAS

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

async function getTelegramFile(fileId: string): Promise<Uint8Array> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`)
  const data = await res.json()
  const filePath = data.result.file_path
  const fileRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`)
  return new Uint8Array(await fileRes.arrayBuffer())
}

async function sendTelegramMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  })
}

async function getDriveAuth() {
  const credentials = JSON.parse(GOOGLE_SA_JSON)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return auth
}

async function getOrCreateFolder(drive: any, parentId: string, folderName: string) {
  const query = `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' })
  
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id
  }
  
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  }
  const folder = await drive.files.create({ requestBody: fileMetadata, fields: 'id' })
  return folder.data.id
}

async function uploadTextToDrive(drive: any, parentId: string, fileName: string, textContent: string) {
  const fileMetadata = {
    name: fileName,
    parents: [parentId]
  }
  const media = {
    mimeType: 'text/plain',
    body: textContent
  }
  await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id'
  })
}

serve(async (req) => {
  try {
    const update = await req.json()
    
    // Si no es un mensaje con foto, ignoramos
    if (!update.message || !update.message.photo) {
      return new Response("OK", { status: 200 })
    }

    const chatId = update.message.chat.id
    const photos = update.message.photo
    // Telegram envía varios tamaños, agarramos el más grande
    const fileId = photos[photos.length - 1].file_id
    
    await sendTelegramMessage(chatId, "Procesando etiqueta con Antigravity 2026 (Gemini Vision)...")

    // 1. Descargar imagen
    const imageBytes = await getTelegramFile(fileId)

    // 2. Extraer datos con Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }) // gemini-1.5-pro es excelente para facturas
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
1) Usa SOLO información claramente visible.
2) NO inventes. Si no está, usa null.
3) NO incluyas precios, importes, IVA ni totales.`

    const imageParts = [
      {
        inlineData: {
          data: btoa(String.fromCharCode.apply(null, Array.from(imageBytes))),
          mimeType: "image/jpeg"
        }
      }
    ]

    const result = await model.generateContent([prompt, ...imageParts])
    let responseText = result.response.text()
    // Limpiar markdown si Gemini lo añade a pesar de la orden
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
    }
    
    const extractedData = JSON.parse(responseText)
    
    // 3. Procesar e insertar en Base de Datos (digital_tags)
    const now = new Date()
    const expDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 días
    
    const dbInserts = []
    let txtFileContent = ''

    for (const producto of extractedData.productos) {
      // Normalizar para DB
      dbInserts.push({
        drive_file_id: `telegram_${fileId}_${Math.random().toString(36).substring(7)}`, // ID único temporal
        product_name: producto.descripcion || 'Producto Desconocido',
        price: 0, // El modelo no extrae precio, poner 0 por defecto o ajustar DB si es opcional
        unit: 'kg', // Asumido por defecto
        origin: producto.procedencia || null,
        category: 'General',
        is_active: true,
        created_at: now.toISOString(),
        expires_at: expDate.toISOString()
      })

      // Formato para el archivo .txt de histórico
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
--------------------------------\n\n`
    }

    if (dbInserts.length > 0) {
      const { error } = await supabase.from('digital_tags').insert(dbInserts)
      if (error) throw new Error("Error guardando en base de datos: " + error.message)
    }

    // 4. Subir a Google Drive creando carpetas Año/Mes
    if (txtFileContent && GOOGLE_SA_JSON) {
      const auth = await getDriveAuth()
      const drive = google.drive({ version: 'v3', auth })
      
      const year = String(now.getFullYear())
      const month = String(now.getMonth() + 1).padStart(2, '0') // 01, 02...
      
      const yearFolderId = await getOrCreateFolder(drive, DRIVE_ROOT_FOLDER_ID, year)
      const monthFolderId = await getOrCreateFolder(drive, yearFolderId, month)
      
      const firstProduct = extractedData.productos[0]?.descripcion || 'Varios'
      const timestamp = now.toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)
      const fileName = `etiqueta_${timestamp}_${firstProduct}.txt`
      
      await uploadTextToDrive(drive, monthFolderId, fileName, txtFileContent)
    }

    // 5. Responder a Telegram
    await sendTelegramMessage(chatId, `✅ Etiqueta procesada y archivada con éxito.\nProductos: ${extractedData.productos.length}\nCarpeta: /${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`)

    return new Response("OK", { status: 200 })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
