import { NextResponse } from 'next/server';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

type ProviderResult = {
  ok: boolean;
  status: number;
  text: string;
  model: string;
  error: string;
};

function cleanString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function cleanExtras(value: unknown) {
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
    const error = response.ok ? '' : payload?.error?.message || `Error ${response.status}`;
    return { ok: response.ok, status: response.status, text, model, error };
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

function normalizeLabel(raw: any) {
  const reviewFields = Array.isArray(raw?.review_fields) ? raw.review_fields.map(cleanString).filter(Boolean) : [];
  const confidenceRaw = Number(raw?.confidence ?? 0.8);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;

  const label = {
    description: cleanString(raw?.description || raw?.descripcion || raw?.especie),
    scientific_name: cleanString(raw?.scientific_name || raw?.nombre_cientifico),
    lote: cleanString(raw?.lote),
    marca: cleanString(raw?.marca),
    kg_neto: cleanString(raw?.kg_neto || raw?.kg || raw?.peso),
    metodo: cleanString(raw?.metodo || raw?.metodo_produccion),
    presentacion: cleanString(raw?.presentacion),
    procedencia: cleanString(raw?.procedencia || raw?.origin),
    fao: cleanString(raw?.fao),
    frescura: cleanString(raw?.frescura),
    arte: cleanString(raw?.arte),
    ce: cleanString(raw?.ce),
    subzona: cleanString(raw?.subzona),
    primer_expedidor: cleanString(raw?.primer_expedidor),
    poblacion: cleanString(raw?.poblacion),
    fecha_captura: cleanString(raw?.fecha_captura),
    comprador: cleanString(raw?.comprador),
    nif: cleanString(raw?.nif),
    extra_fields: cleanExtras(raw?.extra_fields),
    confidence,
    needs_review: Boolean(raw?.needs_review) || confidence < 0.78 || reviewFields.length > 0,
    review_fields: reviewFields,
  };

  for (const field of ['description', 'lote', 'procedencia'] as const) {
    if (!label[field] && !label.review_fields.includes(field)) label.review_fields.push(field);
  }
  label.needs_review = label.needs_review || label.review_fields.length > 0;
  return label;
}

export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status });
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'El lector inteligente todavía no tiene configurada su clave de IA.', code: 'AI_NOT_CONFIGURED' }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No se ha recibido ninguna fotografía.' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'El archivo recibido no es una imagen.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'La fotografía es demasiado grande. Usa una imagen de menos de 6 MB.' }, { status: 413 });

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const prompt = `
Actúas como lector de trazabilidad alimentaria de CA46. La imagen contiene UNA ETIQUETA FÍSICA de pescado o marisco, no una factura.

OBJETIVO:
- Extraer exclusivamente los datos visibles para crear una etiqueta digital PROVISIONAL de 24 horas.
- No inventes ningún dato.
- No extraigas precios, importes, IVA ni totales.
- Si un dato parece existir pero no se lee con seguridad, déjalo vacío y añádelo a review_fields.
- Si un campo no aparece, puede quedar vacío.
- Lote, especie y procedencia son críticos.

Extrae: description, scientific_name, lote, marca, kg_neto, metodo, presentacion, procedencia, fao, frescura, arte, ce, subzona, primer_expedidor, poblacion, fecha_captura, comprador, nif y extra_fields.

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "warnings": [],
  "label": {
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
  }
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

    const parsed = parseModelJson(result.text);
    const label = normalizeLabel(parsed?.label || parsed);
    if (!label.description && !label.lote && !label.procedencia) {
      return NextResponse.json({ error: 'No se han podido identificar datos suficientes de trazabilidad en esta etiqueta.', warnings: parsed?.warnings || [] }, { status: 422 });
    }

    return NextResponse.json({
      analysis: {
        invoice_number: '',
        invoice_date: '',
        expedidor: '',
        cif_expedidor: '',
        registro_sanitario_expedidor: '',
        buyer: label.comprador,
        buyer_nif: label.nif,
        invoice_extra_fields: [],
        warnings: Array.isArray(parsed?.warnings) ? parsed.warnings.map(cleanString).filter(Boolean) : [],
        labels: [label],
      },
      mode: 'physical_label',
      provisional_hours: 24,
      model: result.model,
      source: file.name,
    });
  } catch (error: any) {
    console.error('Analyze physical label error:', error);
    return NextResponse.json({ error: error?.message || 'Error inesperado al analizar la etiqueta física.' }, { status: 500 });
  }
}
