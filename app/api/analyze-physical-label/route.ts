import { NextResponse } from 'next/server';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const PRIVATE_PRICE_FIELD = /(?:^|\s)(precio|importe|total|iva|coste|costo|euros?|€)(?:\s|$)/i;

type ExtraField = { label: string; value: string };
type ProviderResult = {
  ok: boolean;
  status: number;
  text: string;
  model: string;
  error: string;
};

const KNOWN_LABEL_KEYS = [
  'description', 'descripcion', 'especie', 'scientific_name', 'nombre_cientifico',
  'lote', 'lot', 'marca', 'brand', 'kg_neto', 'kg', 'peso', 'peso_neto', 'net_weight',
  'metodo', 'metodo_produccion', 'production_method', 'presentacion', 'presentation',
  'procedencia', 'origin', 'origen', 'fao', 'zona_fao', 'frescura', 'freshness',
  'arte', 'arte_pesca', 'fishing_gear', 'ce', 'registro_ce', 'ce_code', 'subzona', 'subzone',
  'primer_expedidor', 'prim_expedidor', 'first_shipper', 'poblacion', 'population',
  'fecha_captura', 'fec_captura', 'capture_date', 'comprador', 'buyer', 'nif', 'buyer_nif',
  'extra_fields', 'confidence', 'needs_review', 'review_fields',
];

function cleanString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function humanizeKey(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function cleanExtras(value: unknown): ExtraField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({ label: cleanString(item?.label || item?.key || item?.name), value: cleanString(item?.value ?? item?.valor) }))
    .filter((item) => item.label && item.value)
    .filter((item) => !PRIVATE_PRICE_FIELD.test(item.label));
}

function collectUnknownFields(record: unknown): ExtraField[] {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
  const known = new Set(KNOWN_LABEL_KEYS.map((key) => key.toLowerCase()));
  const rows: ExtraField[] = [];

  for (const [key, rawValue] of Object.entries(record as Record<string, unknown>)) {
    if (known.has(key.toLowerCase())) continue;
    if (rawValue === null || rawValue === undefined || typeof rawValue === 'object') continue;
    const value = cleanString(rawValue);
    const label = humanizeKey(key);
    if (!label || !value || PRIVATE_PRICE_FIELD.test(label)) continue;
    rows.push({ label, value });
  }
  return rows;
}

function mergeExtras(...groups: ExtraField[][]) {
  const seen = new Set<string>();
  const result: ExtraField[] = [];
  for (const group of groups) {
    for (const item of group) {
      const label = cleanString(item.label);
      const value = cleanString(item.value);
      if (!label || !value || PRIVATE_PRICE_FIELD.test(label)) continue;
      const key = `${label.toLowerCase()}::${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ label, value });
    }
  }
  return result;
}

function resolveImageMimeType(file: File) {
  const declared = String(file.type || '').toLowerCase().trim();
  if (declared.startsWith('image/')) return declared;

  const extension = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
    avif: 'image/avif',
  };
  return byExtension[extension] || '';
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
          generationConfig: { temperature: 0.05, responseMimeType: 'application/json' },
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
    lote: cleanString(raw?.lote || raw?.lot),
    marca: cleanString(raw?.marca || raw?.brand),
    kg_neto: cleanString(raw?.kg_neto || raw?.kg || raw?.peso || raw?.peso_neto || raw?.net_weight),
    metodo: cleanString(raw?.metodo || raw?.metodo_produccion || raw?.production_method),
    presentacion: cleanString(raw?.presentacion || raw?.presentation),
    procedencia: cleanString(raw?.procedencia || raw?.origin || raw?.origen),
    fao: cleanString(raw?.fao || raw?.zona_fao),
    frescura: cleanString(raw?.frescura || raw?.freshness),
    arte: cleanString(raw?.arte || raw?.arte_pesca || raw?.fishing_gear),
    ce: cleanString(raw?.ce || raw?.registro_ce || raw?.ce_code),
    subzona: cleanString(raw?.subzona || raw?.subzone),
    primer_expedidor: cleanString(raw?.primer_expedidor || raw?.prim_expedidor || raw?.first_shipper),
    poblacion: cleanString(raw?.poblacion || raw?.population),
    fecha_captura: cleanString(raw?.fecha_captura || raw?.fec_captura || raw?.capture_date),
    comprador: cleanString(raw?.comprador || raw?.buyer),
    nif: cleanString(raw?.nif || raw?.buyer_nif),
    extra_fields: mergeExtras(cleanExtras(raw?.extra_fields), collectUnknownFields(raw)),
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

    const mimeType = resolveImageMimeType(file);
    if (!mimeType) return NextResponse.json({ error: 'El archivo recibido no es una imagen compatible.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'La fotografía es demasiado grande. Usa una imagen de menos de 6 MB.' }, { status: 413 });

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const prompt = `
Actúas como lector de trazabilidad alimentaria de CA46. Esta ruta es EXCLUSIVAMENTE para una ETIQUETA FÍSICA de caja de pescado o marisco que generará una etiqueta TEMPORAL de 24 horas mientras la factura está pendiente.

PRIMERO CLASIFICA EL DOCUMENTO:
- document_type = "physical_label" si es una etiqueta física de caja/producto.
- document_type = "invoice" si es una factura, albarán o documento de compra con partidas y datos fiscales.
- document_type = "unknown" solo si realmente no puede determinarse.
- Las fotos sin etiquetas de trazabilidad alimentaria (habitaciones, televisores, objetos o cajas sin etiqueta legible) son unknown. No inventes una especie, lote o procedencia.
- Para invoice o unknown devuelve label vacío y no extraigas datos como si fuera una etiqueta física.
- Si la imagen está girada o inclinada, interprétala en la orientación correcta antes de leerla.

OBJETIVO PARA physical_label:
- Recupera toda la trazabilidad legible de la etiqueta física.
- Revisa la etiqueta completa dos veces antes de responder para no omitir campos.
- No inventes ningún dato ni completes información por conocimiento general.
- No extraigas precios, importes, IVA, totales ni costes.
- NO busques ni exijas número de comprador / cliente del mercado mayorista en esta ruta.
- Si un dato parece existir pero no se lee con seguridad, déjalo vacío y añádelo a review_fields.
- Si un campo no aparece, puede quedar vacío.
- Especie, lote y procedencia son críticos y deben revisarse antes de publicar.
- Cualquier dato visible que no encaje en los campos principales debe conservarse en extra_fields como {"label":"","value":""}.

PRESTA ESPECIAL ATENCIÓN A:
Descripción/especie, nombre científico, lote completo, proveedor/expedidor, marca, talla, número de piezas, kg/peso neto, método de producción, presentación, procedencia/origen, FAO, frescura/estado, arte de pesca, CE/RGS/registro sanitario, subzona, primer expedidor, población, fecha de captura, fecha de caducidad y condiciones de conservación.

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "document_type":"physical_label",
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
    "extra_fields":[{"label":"Caducidad","value":""},{"label":"Conservación","value":""},{"label":"Talla","value":""},{"label":"Piezas","value":""}],
    "confidence":0.0,
    "needs_review":true,
    "review_fields":[]
  }
}
`.trim();

    const models = [GEMINI_MODEL, ...FALLBACK_MODELS].filter((model, index, all) => all.indexOf(model) === index);
    let result: ProviderResult | null = null;
    for (const model of models) {
      const attempt = await callGemini(model, imageBase64, mimeType, prompt);
      if (attempt.ok && attempt.text) { result = attempt; break; }
      result = attempt;
      if (!shouldFallback(attempt.status, attempt.error)) break;
    }

    if (!result?.ok || !result.text) {
      return NextResponse.json({ error: 'El lector de CA46 está temporalmente saturado. Vuelve a intentarlo en unos segundos.', code: 'AI_TEMPORARILY_BUSY' }, { status: 503 });
    }

    const parsed = parseModelJson(result.text);
    const documentType = cleanString(parsed?.document_type).toLowerCase() || 'unknown';
    if (documentType === 'invoice') {
      return NextResponse.json(
        {
          error: 'Has fotografiado una factura o albarán. Para ese documento usa Factura · 72 h.',
          code: 'WRONG_DOCUMENT_TYPE',
          document_type: 'invoice',
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (documentType !== 'physical_label') {
      return NextResponse.json({
        error: 'No se reconoce una etiqueta de trazabilidad en esta imagen. Fotografía una sola etiqueta de la caja, completa y de cerca.',
        code: 'UNSUPPORTED_DOCUMENT',
        document_type: 'unknown',
      }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
    }

    const label = normalizeLabel(parsed?.label || parsed);
    if (!label.description && !label.lote && !label.procedencia) {
      return NextResponse.json({ error: 'No se han podido identificar datos suficientes de trazabilidad en esta etiqueta.', warnings: parsed?.warnings || [], document_type: documentType }, { status: 422 });
    }

    const warnings = Array.isArray(parsed?.warnings) ? parsed.warnings.map(cleanString).filter(Boolean) : [];

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
        warnings,
        labels: [label],
      },
      mode: 'physical_label',
      document_type: documentType,
      provisional_hours: 24,
      model: result.model,
      source: file.name,
      company_id: tenant.context.companyId,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Analyze physical label error:', error);
    return NextResponse.json({ error: error?.message || 'Error inesperado al analizar la etiqueta física.' }, { status: 500 });
  }
}
