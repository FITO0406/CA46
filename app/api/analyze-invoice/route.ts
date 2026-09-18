import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

type ExtraField = { label: string; value: string };

type TraceabilityLabel = {
  description: string;
  scientific_name: string;
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
  subzona: string;
  primer_expedidor: string;
  poblacion: string;
  fecha_captura: string;
  comprador: string;
  nif: string;
  extra_fields: ExtraField[];
  confidence: number;
  needs_review: boolean;
  review_fields: string[];
};

type InvoiceAnalysis = {
  invoice_number: string;
  invoice_date: string;
  expedidor: string;
  cif_expedidor: string;
  registro_sanitario_expedidor: string;
  buyer: string;
  buyer_nif: string;
  invoice_extra_fields: ExtraField[];
  labels: TraceabilityLabel[];
  warnings: string[];
};

type ProviderResult = {
  ok: boolean;
  status: number;
  payload: any;
  text: string;
  model: string;
  error: string;
};

const EMPTY_ANALYSIS: InvoiceAnalysis = {
  invoice_number: '',
  invoice_date: '',
  expedidor: '',
  cif_expedidor: '',
  registro_sanitario_expedidor: '',
  buyer: '',
  buyer_nif: '',
  invoice_extra_fields: [],
  labels: [],
  warnings: [],
};

function cleanString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function cleanExtraFields(value: unknown): ExtraField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({ label: cleanString(item?.label), value: cleanString(item?.value) }))
    .filter((item) => item.label && item.value);
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
    expedidor: cleanString(raw?.expedidor || raw?.shipper),
    cif_expedidor: cleanString(raw?.cif_expedidor || raw?.shipper_tax_id),
    registro_sanitario_expedidor: cleanString(raw?.registro_sanitario_expedidor || raw?.rgs || raw?.registro_sanitario),
    buyer,
    buyer_nif: buyerNif,
    invoice_extra_fields: cleanExtraFields(raw?.invoice_extra_fields),
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map(cleanString).filter(Boolean) : [],
    labels: labels.map((item: any) => {
      const reviewFields = Array.isArray(item?.review_fields)
        ? item.review_fields.map(cleanString).filter(Boolean)
        : [];
      const confidence = clampConfidence(item?.confidence ?? 0.8);
      const normalized: TraceabilityLabel = {
        description: cleanString(item?.description || item?.descripcion || item?.especie),
        scientific_name: cleanString(item?.scientific_name || item?.nombre_cientifico),
        lote: cleanString(item?.lote),
        marca: cleanString(item?.marca),
        kg_neto: cleanString(item?.kg_neto || item?.kg || item?.peso),
        metodo: cleanString(item?.metodo || item?.metodo_produccion),
        presentacion: cleanString(item?.presentacion),
        procedencia: cleanString(item?.procedencia || item?.origin),
        fao: cleanString(item?.fao),
        frescura: cleanString(item?.frescura),
        arte: cleanString(item?.arte),
        ce: cleanString(item?.ce),
        subzona: cleanString(item?.subzona),
        primer_expedidor: cleanString(item?.primer_expedidor || item?.prim_expedidor),
        poblacion: cleanString(item?.poblacion),
        fecha_captura: cleanString(item?.fecha_captura || item?.fec_captura),
        comprador: cleanString(item?.comprador) || buyer,
        nif: cleanString(item?.nif) || buyerNif,
        extra_fields: cleanExtraFields(item?.extra_fields),
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

function shouldFallback(status: number, message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    normalized.includes('high demand') || normalized.includes('overloaded') ||
    normalized.includes('temporarily unavailable') || normalized.includes('try again later')
  );
}

async function callGeminiModel(model: string, imageBase64: string, mimeType: string, prompt: string): Promise<ProviderResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(45000),
      }
    );

    const payload = await response.json().catch(() => null);
    const providerMessage = payload?.error?.message || `Error ${response.status}`;
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim() || '';

    return { ok: response.ok, status: response.status, payload, text, model, error: response.ok ? '' : providerMessage };
  } catch (error: any) {
    return {
      ok: false,
      status: 504,
      payload: null,
      text: '',
      model,
      error: error?.name === 'TimeoutError' ? 'El lector ha tardado demasiado en responder.' : error?.message || 'Error de conexión con el lector.',
    };
  }
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL, fallbacks: FALLBACK_MODELS });
}

export async function POST(request: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'El lector inteligente todavía no tiene configurada su clave de IA.', code: 'AI_NOT_CONFIGURED' }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No se ha recibido ninguna fotografía.' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'El archivo recibido no es una imagen.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'La fotografía es demasiado grande. Vuelve a intentarlo con una imagen de menos de 6 MB.' }, { status: 413 });

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const imageBase64 = imageBuffer.toString('base64');

    const prompt = `
Actúas como el lector de trazabilidad alimentaria de CA46. Analiza ESTA fotografía de una factura/documento de trazabilidad GESICO de pescado o marisco.

REGLAS:
- Una factura puede contener UNA O MUCHAS partidas. Crea UN objeto de etiqueta por cada partida/lote detectado.
- El LOTE es un dato prioritario. Léelo con especial cuidado y nunca lo inventes.
- Nunca unas partidas solo por compartir especie. Si cambia lote, procedencia, método, expedidor u otro dato de trazabilidad, son etiquetas distintas.
- Extrae TODOS los campos que aparezcan en el documento. Los campos no contemplados expresamente deben ir en extra_fields o invoice_extra_fields.
- No extraigas precios, importes, IVA ni totales: no forman parte de la etiqueta pública.
- No inventes datos. Si un dato visible es dudoso, déjalo vacío y añádelo a review_fields.
- Solo marca review_fields para datos que aparecen o parecen aparecer pero no se leen con seguridad. Un campo que sencillamente no figure en la factura puede quedar vacío sin forzar revisión.
- Copia comprador/NIF a cada etiqueta cuando aparezcan como dato común.

DATOS GENERALES DE LA FACTURA:
- invoice_number: número de factura/documento
- invoice_date: fecha de factura
- expedidor: razón social del expedidor
- cif_expedidor: CIF/NIF del expedidor
- registro_sanitario_expedidor: R.G.S. o registro sanitario del expedidor
- buyer: comprador
- buyer_nif: CIF/NIF del comprador
- invoice_extra_fields: otros datos generales legibles relevantes para trazabilidad, excluyendo precios e importes

CAMPOS DE CADA PARTIDA/ETIQUETA:
- description: ESPECIE / denominación comercial
- scientific_name: nombre científico (por ejemplo Sepia spp)
- lote: LOTE completo, incluyendo códigos adicionales que figuren junto a él
- procedencia
- subzona
- primer_expedidor
- poblacion
- fecha_captura
- fao
- frescura
- metodo: método de producción (CAPTURADO / CRIADO, etc.)
- arte: arte de pesca
- kg_neto
- marca
- presentacion
- ce: registro/CE asociado a la partida si aparece
- comprador
- nif
- extra_fields: cualquier otro dato de trazabilidad de esa partida que figure claramente y no esté en los campos anteriores
- confidence: número 0..1
- needs_review: booleano
- review_fields: campos dudosos

Devuelve EXCLUSIVAMENTE JSON válido, sin markdown, con esta estructura:
{
  "invoice_number":"",
  "invoice_date":"",
  "expedidor":"",
  "cif_expedidor":"",
  "registro_sanitario_expedidor":"",
  "buyer":"",
  "buyer_nif":"",
  "invoice_extra_fields":[],
  "warnings":[],
  "labels":[{
    "description":"",
    "scientific_name":"",
    "lote":"",
    "marca":"",
    "kg_neto":"",
    "metodo":"",
    "presentacion":"",
    "procedencia":"",
    "fao":"",
    "frescura":"",
    "arte":"",
    "ce":"",
    "subzona":"",
    "primer_expedidor":"",
    "poblacion":"",
    "fecha_captura":"",
    "comprador":"",
    "nif":"",
    "extra_fields":[],
    "confidence":0.0,
    "needs_review":true,
    "review_fields":[]
  }]
}

Si no encuentras ninguna partida, devuelve labels: [] y explica el motivo brevemente en warnings.
`.trim();

    const models = [GEMINI_MODEL, ...FALLBACK_MODELS].filter((model, index, all) => all.indexOf(model) === index);
    let providerResult: ProviderResult | null = null;
    const attempts: Array<{ model: string; status: number; error: string }> = [];

    for (const model of models) {
      const result = await callGeminiModel(model, imageBase64, file.type || 'image/jpeg', prompt);
      if (result.ok && result.text) { providerResult = result; break; }
      attempts.push({ model, status: result.status, error: result.error || 'Respuesta vacía' });
      console.warn(`CA46 OCR intento fallido con ${model}:`, result.error || result.status);
      if (!shouldFallback(result.status, result.error)) { providerResult = result; break; }
    }

    if (!providerResult?.ok) {
      const lastAttempt = attempts[attempts.length - 1];
      const detail = lastAttempt?.error || providerResult?.error || 'El lector no está disponible.';
      console.error('Gemini invoice analysis error:', detail, attempts);
      return NextResponse.json({ error: 'El lector de CA46 está temporalmente saturado. Vuelve a intentarlo en unos segundos.', code: 'AI_TEMPORARILY_BUSY', detail, attempts: attempts.map(({ model, status }) => ({ model, status })) }, { status: 503 });
    }

    if (!providerResult.text) return NextResponse.json({ error: 'El lector no devolvió información de la factura.' }, { status: 502 });

    let analysis = EMPTY_ANALYSIS;
    try {
      analysis = normalizeAnalysis(parseModelJson(providerResult.text));
    } catch (error: any) {
      console.error('Invalid invoice JSON:', error);
      return NextResponse.json({ error: 'No se pudo interpretar la lectura de la factura.' }, { status: 502 });
    }

    return NextResponse.json({
      analysis,
      model: providerResult.model,
      source: file.name,
      fallback_used: providerResult.model !== GEMINI_MODEL,
      attempts: attempts.map(({ model, status }) => ({ model, status })),
    });
  } catch (error: any) {
    console.error('Analyze invoice error:', error);
    return NextResponse.json({ error: error?.message || 'Error inesperado al analizar la factura.' }, { status: 500 });
  }
}
