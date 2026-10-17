import { decodeTraceability, encodeTraceability, type TraceabilityData } from '@/lib/traceability';
const publicExtras = new Set(['Transformación', 'Lote de origen', 'Cadena CA46', 'Origen provisional',
  'Peso antes de cocinar', 'Peso final cocinado', 'Conservación', 'Consumo preferente',
  'Fecha límite de consumo', 'Exposición en visor', 'Sal / salmuera', 'Ingredientes / aditivos', 'Sal incorporada']);
const text = (value: unknown) => typeof value === 'string' ? value : '';
export function publicScreenTag(row: Record<string, unknown>) {
  const trace = decodeTraceability(text(row.category));
  let category = '';
  if (trace && typeof trace === 'object' && !Array.isArray(trace)) {
    const safe: TraceabilityData = {
      establishment: '', description: text(trace.description), lot: text(trace.lot), brand: text(trace.brand),
      netWeight: text(trace.netWeight), productionMethod: text(trace.productionMethod), presentation: text(trace.presentation),
      origin: text(trace.origin), fao: text(trace.fao), freshness: text(trace.freshness), fishingGear: text(trace.fishingGear),
      ceCode: text(trace.ceCode), buyer: '', buyerNumber: '', scientificName: text(trace.scientificName),
      subzone: text(trace.subzone), firstShipper: text(trace.firstShipper), population: text(trace.population),
      captureDate: text(trace.captureDate), consumerNotice: text(trace.consumerNotice),
      extraFields: Array.isArray(trace.extraFields) ? trace.extraFields.filter(field => field && publicExtras.has(field.label) && typeof field.value === 'string')
        .map(field => ({ label: field.label, value: field.value })) : [],
    };
    category = encodeTraceability(safe);
  }
  // No spread: a newly added database field cannot accidentally become public.
  return { id: row.id, product_name: text(row.product_name), origin: text(row.origin), category,
    is_active: row.is_active, created_at: row.created_at, expires_at: row.expires_at, source: row.source, status: row.status };
}
