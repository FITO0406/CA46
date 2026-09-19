import { NextResponse } from 'next/server';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

type ProviderResult = { ok: boolean; status: number; text: string; model: string; error: string };

function cleanString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function cleanExtraFields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({ label: cleanString(item?.label), value: cleanString(item?.value) }))
    .filter((item) => item.label && item.value)
    .filter((item) => !/(precio|importe|total|iva|coste|€)/i.test(item.label));
}

function parseModelJson(text: string): any {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    throw new Error('La respuesta del lector no contiene JSON válido.');
  }
}

function shouldFallback(status: number, message: string) {
  const normalized = message.toLowerCase();
  return status === 429 || status >= 500 || normalized.includes('overloaded') || normalized.includes('high demand') || normalized.includes('temporarily unavailable');
}

async function callGemini(model: string, imageBase64: string, mimeType: string, prompt: string): Promise<ProviderResult> {
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
      },
    );
    const payload = await response.json().catch(() => null);
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => typeof part?.text === 'string' ? part.text : '')
      .join('')
      .trim() || '';
    return { ok: response.ok, status: response.status, text, model, error: response.ok ? '' : payload?.error?.message || `Error ${response.status}` };
  } catch (error: any) {
    return {
      ok: false,
      status: 504,
      text: '',
      model,
      error: error?.name === 'TimeoutError' ? 'El lector ha tardado demasiado en responder.' : error?.message || 'Error de conexión con el lector.',
    };
  }
}

function normalizeAnalysis(raw: any) {
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
      const reviewFields = Array.isArray(item?.review_fields) ? item.review_fields.map(cleanString).filter(Boolean) : [];
      const confidenceRaw = Number(item?.confidence ?? 0.8);
      const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;
      const label = {
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
      for (const field of ['description', 'lote', 'procedencia'] as const) {
        if (!label[field] && !label.review_fields.includes(field)) label.review_fields.push(field);
      }
      label.needs_review = label.needs_review || label.review_fields.length > 0;
      return label;
    }),
  };
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL, fallbacks: FALLBACK_MODELS });
}

export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status });
    if (!GEMINI_API_KEY) return NextResponse.json({ error: 'El lector inteligente todavía no tiene configurada su clave de IA.', code: 'AI_NOT_CONFIGURED' }, { status: 503 });

    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No se ha recibido ninguna fotografía.' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'El archivo recibido no es una imagen.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'La fotografía es demasiado grande. Usa una imagen de menos de 6 MB.' }, { status: 413 });

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const prompt = `
Actúas como el lector de trazabilidad alimentaria de CA46. Analiza ESTA fotografía de una factura o documento de trazabilidad de pescado o marisco.

REGLAS:
- Una factura puede contener UNA O MUCHAS partidas. Crea UN objeto de etiqueta por cada partida/lote detectado.
- El LOTE es prioritario. Nunca lo inventes.
- No unas partidas si cambia lote, procedencia, método, expedidor u otro dato de trazabilidad.
- Extrae todos los datos visibles relevantes para trazabilidad.
- No extraigas precios, importes, IVA ni totales.
- No inventes datos. Si algo parece estar pero no se lee con seguridad, déjalo vacío y añádelo a review_fields.
- Copia comprador/NIF a cada etiqueta cuando sean datos comunes.

DATOS GENERALES: invoice_number, invoice_date, expedidor, cif_expedidor, registro_sanitario_expedidor, buyer, buyer_nif, invoice_extra_fields.
CADA ETIQUETA: description, scientific_name, lote, marca, kg_neto, metodo, presentacion, procedencia, fao, frescura, arte, ce, subzona, primer_expedidor, poblacion, fecha_captura, comprador, nif, extra_fields, confidence, needs_review, review_fields.

Devuelve EXCLUSIVAMENTE JSON válido con esta estructura:
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
`.trim();

    const models = [GEMINI_MODEL, ...FALLBACK_MODELS].filter((model, index, all) => all.indexOf(model) === index);
    let result: ProviderResult | null = null;
    for (const model of models) {
      const attempt = await callGemini(model, imageBase64, file.type || 'image/jpeg', prompt);
      if (attempt.ok && attempt.text) { result = attempt; break; }
      result = attempt;
      if (!shouldFallback(attempt.status, attempt.error)) break;
    }

    if (!result?.ok || !result.text) {
      return NextResponse.json({ error: 'El lector de CA46 está temporalmente saturado. Vuelve a intentarlo en unos segundos.', code: 'AI_TEMPORARILY_BUSY' }, { status: 503 });
    }

    const analysis = normalizeAnalysis(parseModelJson(result.text));
    return NextResponse.json({ analysis, model: result.model, source: file.name, company_id: tenant.context.companyId });
  } catch (error: any) {
    console.error('Analyze invoice error:', error);
    return NextResponse.json({ error: error?.message || 'Error inesperado al analizar la factura.' }, { status: 500 });
  }
}
