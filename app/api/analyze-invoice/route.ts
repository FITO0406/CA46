import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

type TraceabilityLabel = {
  description: string;
  lote: string;
  marca: string;
  kg_neto: string;
  metodo: string;
  presentacion: string;
  procedencia: string;
  fao: string;
  frescura: string;
  arte: string;
  ce: string;
  comprador: string;
  nif: string;
  confidence: number;
  needs_review: boolean;
  review_fields: string[];
};

type InvoiceAnalysis = {
  invoice_number: string;
  invoice_date: string;
  buyer: string;
  buyer_nif: string;
  labels: TraceabilityLabel[];
  warnings: string[];
};

const EMPTY_ANALYSIS: InvoiceAnalysis = {
  invoice_number: '',
  invoice_date: '',
  buyer: '',
  buyer_nif: '',
  labels: [],
  warnings: [],
};

function cleanString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function clampConfidence(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function normalizeAnalysis(raw: any): InvoiceAnalysis {
  const buyer = cleanString(raw?.buyer || raw?.comprador);
  const buyerNif = cleanString(raw?.buyer_nif || raw?.nif);
  const labels = Array.isArray(raw?.labels) ? raw.labels : [];

  return {
    invoice_number: cleanString(raw?.invoice_number || raw?.numero_factura),
    invoice_date: cleanString(raw?.invoice_date || raw?.fecha_factura),
    buyer,
    buyer_nif: buyerNif,
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map(cleanString).filter(Boolean) : [],
    labels: labels.map((item: any) => {
      const reviewFields = Array.isArray(item?.review_fields)
        ? item.review_fields.map(cleanString).filter(Boolean)
        : [];
      const confidence = clampConfidence(item?.confidence ?? 0.8);
      const normalized: TraceabilityLabel = {
        description: cleanString(item?.description || item?.descripcion),
        lote: cleanString(item?.lote),
        marca: cleanString(item?.marca),
        kg_neto: cleanString(item?.kg_neto || item?.kg || item?.peso),
        metodo: cleanString(item?.metodo),
        presentacion: cleanString(item?.presentacion),
        procedencia: cleanString(item?.procedencia || item?.origin),
        fao: cleanString(item?.fao),
        frescura: cleanString(item?.frescura),
        arte: cleanString(item?.arte),
        ce: cleanString(item?.ce),
        comprador: cleanString(item?.comprador) || buyer,
        nif: cleanString(item?.nif) || buyerNif,
        confidence,
        needs_review: Boolean(item?.needs_review) || confidence < 0.78 || reviewFields.length > 0,
        review_fields: reviewFields,
      };

      const criticalFields: Array<keyof TraceabilityLabel> = ['description', 'lote', 'procedencia'];
      for (const field of criticalFields) {
        if (!normalized[field] && !normalized.review_fields.includes(field)) {
          normalized.review_fields.push(field);
          normalized.needs_review = true;
        }
      }

      return normalized;
    }),
  };
}

function parseModelJson(text: string): any {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('La respuesta del lector no contiene JSON válido.');
  }
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
  });
}

export async function POST(request: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: 'El lector inteligente todavía no tiene configurada su clave de IA.',
          code: 'AI_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se ha recibido ninguna fotografía.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo recibido no es una imagen.' }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'La fotografía es demasiado grande. Vuelve a intentarlo con una imagen de menos de 6 MB.' },
        { status: 413 }
      );
    }

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const imageBase64 = imageBuffer.toString('base64');

    const prompt = `
Actúas como el lector de trazabilidad alimentaria de CA46. Analiza ESTA fotografía de una factura emitida por GESICO a un pescadero en el momento de la compra.

OBJETIVO PRINCIPAL:
- Una factura puede contener UNA O MUCHAS partidas de pescado o marisco.
- Debes crear UN objeto de etiqueta por cada partida/lote de trazabilidad detectado.
- Nunca unas dos líneas solo porque tengan el mismo nombre de especie. Si el lote, procedencia, método, CE u otro dato de trazabilidad cambia, son etiquetas distintas.
- Copia los datos comunes de comprador/NIF a cada etiqueta cuando aparezcan en la factura.
- No inventes datos. Si no puedes leer un campo, devuelve cadena vacía y añade el nombre del campo a review_fields.
- Marca needs_review=true cuando algún dato importante sea dudoso o ilegible.

CAMPOS DE CADA ETIQUETA:
- description (descripción comercial, por ejemplo CANGREJO, PIJOTA, ATÚN)
- lote
- marca
- kg_neto
- metodo (por ejemplo CAPTURADO / CRIADO)
- presentacion
- procedencia (incluye zona/denominación FAO cuando figure)
- fao (solo número o código FAO si se distingue)
- frescura
- arte
- ce
- comprador
- nif
- confidence: número entre 0 y 1 sobre la fiabilidad global de esa etiqueta
- needs_review: booleano
- review_fields: array con los campos que necesitan comprobación humana

DATOS GENERALES DE FACTURA:
- invoice_number
- invoice_date
- buyer
- buyer_nif

Devuelve EXCLUSIVAMENTE JSON válido con esta forma exacta, sin markdown ni comentarios:
{
  "invoice_number": "",
  "invoice_date": "",
  "buyer": "",
  "buyer_nif": "",
  "warnings": [],
  "labels": [
    {
      "description": "",
      "lote": "",
      "marca": "",
      "kg_neto": "",
      "metodo": "",
      "presentacion": "",
      "procedencia": "",
      "fao": "",
      "frescura": "",
      "arte": "",
      "ce": "",
      "comprador": "",
      "nif": "",
      "confidence": 0.0,
      "needs_review": true,
      "review_fields": []
    }
  ]
}

Si no encuentras ninguna partida de trazabilidad, devuelve labels: [] y explica el motivo brevemente en warnings.
`.trim();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: file.type || 'image/jpeg',
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const providerMessage = payload?.error?.message || `Error ${response.status}`;
      console.error('Gemini invoice analysis error:', providerMessage);
      return NextResponse.json(
        { error: 'No se pudo analizar la factura en este momento.', detail: providerMessage },
        { status: 502 }
      );
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (!text) {
      return NextResponse.json({ error: 'El lector no devolvió información de la factura.' }, { status: 502 });
    }

    let analysis = EMPTY_ANALYSIS;
    try {
      analysis = normalizeAnalysis(parseModelJson(text));
    } catch (error: any) {
      console.error('Invalid invoice JSON:', error);
      return NextResponse.json({ error: 'No se pudo interpretar la lectura de la factura.' }, { status: 502 });
    }

    return NextResponse.json({
      analysis,
      model: GEMINI_MODEL,
      source: file.name,
    });
  } catch (error: any) {
    console.error('Analyze invoice error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error inesperado al analizar la factura.' },
      { status: 500 }
    );
  }
}
