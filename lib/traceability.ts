export interface TraceabilityData {
  establishment: string;
  description: string;
  lot: string;
  brand: string;
  netWeight: string;
  productionMethod: string;
  presentation: string;
  origin: string;
  fao: string;
  freshness: string;
  fishingGear: string;
  ceCode: string;
  buyer: string;
  buyerNumber: string;
  extraFields: Array<{ label: string; value: string }>;
}

const TRACE_PREFIX = 'TRACE_V1:';

const FIELD_ALIASES: Record<keyof TraceabilityData, string[]> = {
  establishment: ['establecimiento', 'mercado', 'centro'],
  description: ['descripcion', 'descripción', 'producto'],
  lot: ['lote'],
  brand: ['marca'],
  netWeight: ['kg neto', 'peso neto', 'kg'],
  productionMethod: ['metodo', 'método', 'metodo de produccion', 'método de producción'],
  presentation: ['presentacion', 'presentación'],
  origin: ['procedencia', 'origen'],
  fao: ['fao', 'zona fao', 'zona de captura'],
  freshness: ['frescura', 'estado'],
  fishingGear: ['arte', 'arte de pesca'],
  ceCode: ['ce', 'codigo ce', 'código ce'],
  buyer: ['comprador', 'cliente'],
  buyerNumber: ['n', 'nº', 'n°', 'numero de comprador', 'número de comprador', 'numero comprador'],
  extraFields: [],
};

const PRIVATE_PRICE_FIELD = /(?:^|\s)(precio|importe|coste|costo|total|euros?|€)(?:\s|$)/i;

function normalizeKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function parseTraceabilityText(text: string, fallbackName: string): TraceabilityData {
  const values = new Map<string, string>();
  const labels = new Map<string, string>();
  const standaloneLines: string[] = [];
  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || /^[-_=]{3,}$/.test(trimmedLine)) continue;
    const separator = rawLine.indexOf(':');
    if (separator < 1) {
      standaloneLines.push(trimmedLine);
      continue;
    }
    const key = normalizeKey(rawLine.slice(0, separator));
    const value = rawLine.slice(separator + 1).trim();
    if (value && !values.has(key)) {
      values.set(key, value);
      labels.set(key, rawLine.slice(0, separator).trim());
    }
  }
  const read = (field: keyof TraceabilityData) => {
    for (const alias of FIELD_ALIASES[field]) {
      const value = values.get(normalizeKey(alias));
      if (value) return value;
    }
    return '';
  };
  const knownAliases = new Set(
    Object.values(FIELD_ALIASES).flat().map(normalizeKey),
  );
  const extraFields = Array.from(values.entries())
    .filter(([key]) => !knownAliases.has(key) && !PRIVATE_PRICE_FIELD.test(key))
    .map(([key, value]) => ({ label: labels.get(key) || key, value }));

  return {
    establishment: read('establishment') || standaloneLines[0] || '',
    description: read('description') || fallbackName.replace(/\.txt$/i, ''),
    lot: read('lot'), brand: read('brand'), netWeight: read('netWeight'),
    productionMethod: read('productionMethod'), presentation: read('presentation'),
    origin: read('origin'), fao: read('fao'), freshness: read('freshness'),
    fishingGear: read('fishingGear'), ceCode: read('ceCode'),
    buyer: read('buyer'), buyerNumber: read('buyerNumber'), extraFields,
  };
}

export function encodeTraceability(data: TraceabilityData) {
  return `${TRACE_PREFIX}${JSON.stringify(data)}`;
}

export function decodeTraceability(value: string | null | undefined): TraceabilityData | null {
  if (!value?.startsWith(TRACE_PREFIX)) return null;
  try { return JSON.parse(value.slice(TRACE_PREFIX.length)) as TraceabilityData; }
  catch { return null; }
}
