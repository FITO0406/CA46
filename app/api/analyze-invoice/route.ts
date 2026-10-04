import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const PRIVATE_PRICE_FIELD = /(?:^|\s)(precio|importe|total|iva|coste|costo|euros?|€)(?:\s|$)/i;

type ExtraField = { label: string; value: string };
type ProviderResult = { ok: boolean; status: number; text: string; model: string; error: string };

function cleanString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function normalizeIdentifier(value: unknown) {
  return cleanString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function humanizeKey(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function cleanExtraFields(value: unknown): ExtraField[] {
  const rows: ExtraField[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      const label = cleanString(item?.label || item?.key || item?.name);
      const fieldValue = cleanString(item?.value ?? item?.valor);
      if (label && fieldValue && !PRIVATE_PRICE_FIELD.test(label)) rows.push({ label, value: fieldValue });
    }
  } else if (value && typeof value === 'object') {
    for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
      const fieldValue = cleanString(rawValue);
      const label = humanizeKey(key);
      if (label && fieldValue && !PRIVATE_PRICE_FIELD.test(label)) rows.push({ label, value: fieldValue });
    }
  }

  return rows;
}

function collectUnknownFields(record: unknown, knownKeys: string[]): ExtraField[] {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
  const known = new Set(knownKeys.map((key) => key.toLowerCase()));
  const rows: ExtraField[] = [];

  for (const [key, rawValue] of Object.entries(record as Record<string, unknown>)) {
    if (known.has(key.toLowerCase())) continue;
    if (rawValue === null || rawValue === undefined || typeof rawValue === 'object') continue;
    const value = cleanString(rawValue);
    const label = humanizeKey(key);
    if (!value || !label || PRIVATE_PRICE_FIELD.test(label)) continue;
    rows.push({ label, value });
  }

  return rows;
}

function mergeExtras(...groups: ExtraField[][]) {
  const seen = new Set<string>();
  const merged: ExtraField[] = [];
  for (const group of groups) {
    for (const item of group) {
      const label = cleanString(item.label);
      const value = cleanString(item.value);
      if (!label || !value || PRIVATE_PRICE_FIELD.test(label)) continue;
      const fingerprint = `${label.toLowerCase()}::${value.toLowerCase()}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      merged.push({ label, value });
    }
  }
  return merged;
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
  return (
    status === 429 ||
    status >= 500 ||
    normalized.includes('overloaded') ||
    normalized.includes('high demand') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('try again later')
  );
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

    return {
      ok: response.ok,
      status: response.status,
      text,
      model,
      error: response.ok ? '' : payload?.error?.message || `Error ${response.status}`,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 504,
      text: '',
      model,
      error: error?.name === 'TimeoutError'
        ? 'El lector ha tardado demasiado en responder.'
        : error?.message || 'Error de conexión con el lector.',
    };
  }
}

const INVOICE_KNOWN_KEYS = [
  'invoice_number', 'numero_factura', 'invoice_date', 'fecha_factura',
  'expedidor', 'shipper', 'cif_expedidor', 'shipper_tax_id',
  'registro_sanitario_expedidor', 'rgs', 'registro_sanitario',
  'buyer', 'comprador', 'buyer_nif', 'nif',
  'buyer_number', 'numero_comprador', 'n_comprador', 'n_minorista', 'numero_minorista',
  'invoice_extra_fields', 'warnings', 'labels', 'document_type',
];

const LABEL_KNOWN_KEYS = [
  'description', 'descripcion', 'especie', 'scientific_name', 'nombre_cientifico',
  'lote', 'lot', 'marca', 'brand', 'kg_neto', 'kg', 'peso', 'peso_neto', 'net_weight',
  'metodo', 'metodo_produccion', 'production_method', 'presentacion', 'presentation',
  'procedencia', 'origin', 'origen', 'fao', 'zona_fao', 'frescura', 'freshness',
  'arte', 'arte_pesca', 'fishing_gear', 'ce', 'registro_ce', 'ce_code',
  'subzona', 'subzone', 'primer_expedidor', 'prim_expedidor', 'first_shipper',
  'poblacion', 'population', 'fecha_captura', 'fec_captura', 'capture_date',
  'comprador', 'buyer', 'nif', 'buyer_nif', 'extra_fields', 'confidence',
  'needs_review', 'review_fields',
];

function normalizeAnalysis(raw: any) {
  const buyer = cleanString(raw?.buyer || raw?.comprador);
  const buyerNif = cleanString(raw?.buyer_nif || raw?.nif);
  const buyerNumber = cleanString(
    raw?.buyer_number || raw?.numero_comprador || raw?.n_comprador || raw?.n_minorista || raw?.numero_minorista,
  );
  const labels = Array.isArray(raw?.labels) ? raw.labels : [];
  const invoiceExtras = mergeExtras(
    buyerNumber ? [{ label: 'N.º de comprador / cliente', value: buyerNumber }] : [],
    cleanExtraFields(raw?.invoice_extra_fields),
    collectUnknownFields(raw, INVOICE_KNOWN_KEYS),
  );

  const normalizedLabels = labels.map((item: any) => {
    const reviewFields = Array.isArray(item?.review_fields)
      ? item.review_fields.map(cleanString).filter(Boolean)
      : [];
    const confidenceRaw = Number(item?.confidence ?? 0.8);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;

    const label = {
      description: cleanString(item?.description || item?.descripcion || item?.especie),
      scientific_name: cleanString(item?.scientific_name || item?.nombre_cientifico),
      lote: cleanString(item?.lote || item?.lot),
      marca: cleanString(item?.marca || item?.brand),
      kg_neto: cleanString(item?.kg_neto || item?.kg || item?.peso || item?.peso_neto || item?.net_weight),
      metodo: cleanString(item?.metodo || item?.metodo_produccion || item?.production_method),
      presentacion: cleanString(item?.presentacion || item?.presentation),
      procedencia: cleanString(item?.procedencia || item?.origin || item?.origen),
      fao: cleanString(item?.fao || item?.zona_fao),
      frescura: cleanString(item?.frescura || item?.freshness),
      arte: cleanString(item?.arte || item?.arte_pesca || item?.fishing_gear),
      ce: cleanString(item?.ce || item?.registro_ce || item?.ce_code),
      subzona: cleanString(item?.subzona || item?.subzone),
      primer_expedidor: cleanString(item?.primer_expedidor || item?.prim_expedidor || item?.first_shipper),
      poblacion: cleanString(item?.poblacion || item?.population),
      fecha_captura: cleanString(item?.fecha_captura || item?.fec_captura || item?.capture_date),
      comprador: cleanString(item?.comprador || item?.buyer) || buyer,
      nif: cleanString(item?.nif || item?.buyer_nif) || buyerNif,
      extra_fields: mergeExtras(
        cleanExtraFields(item?.extra_fields),
        collectUnknownFields(item, LABEL_KNOWN_KEYS),
      ),
      confidence,
      needs_review: Boolean(item?.needs_review) || confidence < 0.78 || reviewFields.length > 0,
      review_fields: reviewFields,
    };

    for (const field of ['description', 'lote', 'procedencia'] as const) {
      if (!label[field] && !label.review_fields.includes(field)) label.review_fields.push(field);
    }
    label.needs_review = label.needs_review || label.review_fields.length > 0;
    return label;
  });

  const warnings = Array.isArray(raw?.warnings) ? raw.warnings.map(cleanString).filter(Boolean) : [];
  if (!normalizedLabels.length && !warnings.length) {
    warnings.push('No se ha podido identificar ninguna partida de trazabilidad en la imagen.');
  }

  return {
    invoice_number: cleanString(raw?.invoice_number || raw?.numero_factura),
    invoice_date: cleanString(raw?.invoice_date || raw?.fecha_factura),
    expedidor: cleanString(raw?.expedidor || raw?.shipper),
    cif_expedidor: cleanString(raw?.cif_expedidor || raw?.shipper_tax_id),
    registro_sanitario_expedidor: cleanString(raw?.registro_sanitario_expedidor || raw?.rgs || raw?.registro_sanitario),
    buyer,
    buyer_nif: buyerNif,
    buyer_number: buyerNumber,
    invoice_extra_fields: invoiceExtras,
    warnings,
    labels: normalizedLabels,
  };
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL, fallbacks: FALLBACK_MODELS });
}

export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status });
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'El lector inteligente todavía no tiene configurada su clave de IA.', code: 'AI_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    const { data: companySettings, error: settingsError } = await supabaseAdmin
      .from('company_settings')
      .select('gesico_buyer_number, tax_id')
      .eq('company_id', tenant.context.companyId)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const authorizedBuyerNumber = normalizeIdentifier(companySettings?.gesico_buyer_number);

    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No se ha recibido ninguna fotografía.' }, { status: 400 });

    const mimeType = resolveImageMimeType(file);
    if (!mimeType) return NextResponse.json({ error: 'El archivo recibido no es una imagen compatible.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'La fotografía es demasiado grande. Usa una imagen de menos de 6 MB.' }, { status: 413 });
    }

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const prompt = `
Actúas como el lector de trazabilidad alimentaria de CA46. Analiza ESTA fotografía de una factura, albarán o documento de trazabilidad de pescado o marisco emitido por un mercado mayorista, lonja o proveedor.

PRIMERO CLASIFICA LA IMAGEN:
- document_type = "invoice" únicamente para una factura, albarán o documento de compra con partidas y datos del comprador/proveedor.
- document_type = "physical_label" para etiquetas adheridas a cajas o productos, aunque aparezcan varias cajas juntas. No son facturas.
- document_type = "unknown" para fotos ajenas a estos documentos o cuando no puedas determinar el tipo con seguridad.
- Para physical_label o unknown devuelve labels:[] y no inventes datos de comprador. Esa imagen no se procesa como factura.
- Lee el documento en su orientación correcta si está girado.

OBJETIVO OBLIGATORIO:
- Recupera la ficha de trazabilidad COMPLETA que sea legible en el documento, no solo los campos principales.
- Antes de responder, revisa visualmente una segunda vez toda la imagen, de arriba abajo y de izquierda a derecha, para comprobar que no has omitido ningún dato de trazabilidad.
- Una factura puede contener UNA O MUCHAS partidas. Devuelve UN objeto de etiqueta por CADA partida/lote detectado.
- Nunca unas dos partidas solo porque tengan la misma especie. Si cambia lote, procedencia, método, CE, peso, expedidor u otro dato de trazabilidad, son etiquetas distintas.

VALIDACIÓN DEL COMPRADOR:
- Debes localizar el N.º de comprador, N.º minorista o N.º cliente del documento y devolverlo SIEMPRE en buyer_number cuando sea legible.
- Es un identificador distinto del NIF/CIF. Puede aparecer como "N.º comprador", "N.º minorista", "Nº cliente", "N. cliente" u otra denominación equivalente.
- Si ves un número corto junto al comprador y el mismo número se repite en el bloque inferior de trazabilidad del comprador, trátalo como buyer_number.
- NO confundas buyer_number con: número de factura, NIF/CIF, R.G.S./CE, lote, bultos, kilos, fechas o importes.
- Si buyer_number no es legible, déjalo vacío. No lo inventes.

REGLAS DE LECTURA:
- El LOTE es prioritario. Cópialo COMPLETO, respetando barras, guiones, fechas, prefijos, sufijos y códigos que formen parte de él. Nunca lo inventes.
- Extrae TODOS los campos visibles de trazabilidad. Si un dato no encaja en los campos definidos, guárdalo en extra_fields (si pertenece a una partida) o invoice_extra_fields (si es general de la factura).
- Presta especial atención a abreviaturas como: DESCRIPCIÓN/ESPECIE, LOTE, MARCA, KG NETO/PESO, MÉTODO, PRESENTACIÓN, PROCEDENCIA/ORIGEN, FAO, FRESCURA/ESTADO, ARTE, CE/R.G.S., NOM. CIENTÍFICO, SUBZONA, PRIM. EXPEDIDOR, POBLACIÓN, FEC. CAPTURA, COMPRADOR/CLIENTE, N/NIF/CIF y N.º MINORISTA/COMPRADOR/CLIENTE.
- Copia comprador y NIF/CIF a cada etiqueta cuando sean datos comunes a todas las partidas.
- No extraigas precios, importes, bases imponibles, IVA, totales, costes ni datos económicos: no forman parte de la etiqueta pública.
- No inventes ni completes por conocimiento general. Si un dato parece estar presente pero no se lee con seguridad, déjalo vacío y añádelo a review_fields.
- Si un campo simplemente NO aparece en el documento, puede quedar vacío sin añadirlo a review_fields.

DATOS GENERALES DE LA FACTURA:
- invoice_number: número de factura o documento.
- invoice_date: fecha de factura/documento.
- expedidor: razón social o nombre del expedidor.
- cif_expedidor: CIF/NIF del expedidor.
- registro_sanitario_expedidor: R.G.S., RGSEAA, CE o registro sanitario del expedidor cuando sea un dato general.
- buyer: comprador/cliente.
- buyer_nif: CIF/NIF/N fiscal del comprador.
- buyer_number: N.º minorista / N.º comprador / N.º cliente. Es distinto de buyer_nif.
- invoice_extra_fields: array de {"label":"","value":""} con CUALQUIER otro dato general de trazabilidad legible no incluido arriba.

CAMPOS DE CADA PARTIDA / ETIQUETA:
- description: especie o denominación comercial.
- scientific_name: nombre científico.
- lote: lote COMPLETO.
- marca: marca, si figura.
- kg_neto: peso o kg netos de ESA partida.
- metodo: método de producción, por ejemplo CAPTURADO o CRIADO.
- presentacion: presentación.
- procedencia: procedencia/origen completo, incluyendo texto de zona cuando figure.
- fao: zona/código FAO.
- frescura: frescura/estado, por ejemplo FRESCO o DESCONGELADO.
- arte: arte de pesca.
- ce: código CE/registro asociado a ESA partida.
- subzona: subzona si figura.
- primer_expedidor: primer expedidor si figura.
- poblacion: población si figura.
- fecha_captura: fecha de captura si figura.
- comprador: comprador/cliente.
- nif: NIF/CIF/N del comprador.
- extra_fields: array de {"label":"","value":""} con TODO otro dato de trazabilidad de ESA partida que aparezca claramente.
- confidence: número entre 0 y 1 sobre la fiabilidad global de esa etiqueta.
- needs_review: true solo cuando haya datos dudosos que requieran revisión humana.
- review_fields: nombres de campos visibles pero dudosos/ilegibles.

EJEMPLO DEL TIPO DE INFORMACIÓN QUE CA46 DEBE CONSERVAR SI APARECE:
Descripción, nombre científico, lote, marca, kg neto, método, presentación, procedencia, FAO, frescura, arte, CE, subzona, primer expedidor, población, fecha de captura, comprador, NIF/CIF e identificador de comprador, además del número/fecha de factura y datos del expedidor.

Devuelve EXCLUSIVAMENTE JSON válido, sin markdown ni comentarios, con esta estructura:
{
  "document_type":"invoice",
  "invoice_number":"",
  "invoice_date":"",
  "expedidor":"",
  "cif_expedidor":"",
  "registro_sanitario_expedidor":"",
  "buyer":"",
  "buyer_nif":"",
  "buyer_number":"",
  "invoice_extra_fields":[{"label":"","value":""}],
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
    "extra_fields":[{"label":"","value":""}],
    "confidence":0.0,
    "needs_review":false,
    "review_fields":[]
  }]
}

Si no identificas ninguna partida, devuelve "labels":[] y explica brevemente el motivo en "warnings".
`.trim();

    const models = [GEMINI_MODEL, ...FALLBACK_MODELS].filter((model, index, all) => all.indexOf(model) === index);
    let result: ProviderResult | null = null;
    const attempts: Array<{ model: string; status: number }> = [];

    for (const model of models) {
      const attempt = await callGemini(model, imageBase64, mimeType, prompt);
      if (attempt.ok && attempt.text) {
        result = attempt;
        break;
      }
      attempts.push({ model, status: attempt.status });
      result = attempt;
      if (!shouldFallback(attempt.status, attempt.error)) break;
    }

    if (!result?.ok || !result.text) {
      return NextResponse.json(
        {
          error: 'El lector de CA46 está temporalmente saturado. Vuelve a intentarlo en unos segundos.',
          code: 'AI_TEMPORARILY_BUSY',
          attempts,
        },
        { status: 503 },
      );
    }

    const parsed = parseModelJson(result.text);
    const documentType = cleanString(parsed?.document_type).toLowerCase();
    if (documentType === 'physical_label') {
      return NextResponse.json({
        error: 'La imagen contiene etiquetas de cajas, no una factura. Usa «Etiqueta de caja · 24 h» y fotografía una etiqueta de cerca.',
        code: 'WRONG_DOCUMENT_TYPE',
        document_type: documentType,
      }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    if (documentType !== 'invoice') {
      return NextResponse.json({
        error: 'No se reconoce una factura o albarán en esta imagen. Fotografía el documento completo y con buena luz; no se crearán etiquetas.',
        code: 'UNSUPPORTED_DOCUMENT',
        document_type: 'unknown',
      }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!authorizedBuyerNumber) {
      return NextResponse.json({
        error: 'Antes de crear etiquetas de 72 horas, configura en Mi empresa el N.º de comprador / cliente de tu Merca.',
        code: 'BUYER_NUMBER_REQUIRED',
      }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
    }

    const analysis = normalizeAnalysis(parsed);
    const detectedBuyerNumber = normalizeIdentifier(analysis.buyer_number);

    if (!detectedBuyerNumber) {
      return NextResponse.json(
        {
          error: 'No se ha podido leer el N.º de comprador / cliente de esta factura. Haz una foto completa y nítida; por seguridad no se crearán etiquetas.',
          code: 'BUYER_NUMBER_NOT_READ',
          buyer: analysis.buyer,
        },
        { status: 422, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (detectedBuyerNumber !== authorizedBuyerNumber) {
      return NextResponse.json(
        {
          error: `Factura rechazada: pertenece al comprador ${analysis.buyer_number || detectedBuyerNumber}, no al identificador autorizado de esta empresa.`,
          code: 'INVOICE_NOT_OWNED',
          detected_buyer_number: analysis.buyer_number || detectedBuyerNumber,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const configuredTaxId = normalizeIdentifier(companySettings?.tax_id);
    const detectedTaxId = normalizeIdentifier(analysis.buyer_nif);
    if (configuredTaxId && detectedTaxId && configuredTaxId !== detectedTaxId) {
      analysis.warnings = [
        ...analysis.warnings,
        'El identificador de comprador coincide, pero el NIF/CIF leído no coincide con Mi empresa. Revisa visualmente el documento antes de publicar.',
      ];
    }

    analysis.invoice_extra_fields = mergeExtras(
      [{ label: 'N.º de comprador / cliente', value: analysis.buyer_number }],
      analysis.invoice_extra_fields,
    );

    return NextResponse.json({
      analysis,
      ownership_verified: true,
      model: result.model,
      source: file.name,
      fallback_used: result.model !== GEMINI_MODEL,
      attempts,
      company_id: tenant.context.companyId,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Analyze invoice error:', error);
    return NextResponse.json({ error: error?.message || 'Error inesperado al analizar la factura.' }, { status: 500 });
  }
}
