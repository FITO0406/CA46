import foodData from './kitchen-foods.json';

export const KITCHEN_DISPLAY_DAYS = 10;
export const NUTRITION_SOURCE_URL = 'https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/dnload/sr28asc.zip';
export const nutritionLabels = {
  energyKcal: 'Valor energético', proteinG: 'Proteínas', carbsG: 'Hidratos de carbono',
  sugarsG: 'Azúcares', fatG: 'Grasas', saturatedFatG: 'Grasas saturadas', saltG: 'Sal nutricional',
};
export type NutrientKey = keyof typeof nutritionLabels;
export type NutritionValues = Record<NutrientKey, number | null>;
export type NutritionFields = Record<NutrientKey, string>;
export type ExtraField = { label: string; value: string };
export const foods = foodData;
const keys = Object.keys(nutritionLabels) as NutrientKey[];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ingredientGrams(quantity: string): number | null {
  const match = quantity.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramos?|kilogramos?)$/);
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.')) * (/^(kg|kilogram)/.test(match[2]) ? 1000 : 1);
  return amount > 0 ? amount : null;
}

export function findFood(name: string) {
  const text = ` ${normalize(name)} `;
  // Never silently map salted/dried/cooked products to a raw reference.
  if (/\b(salado|salazon|seco|secos|seco|deshidratado|cocido|cocinado|ahumado|conserva)\b/.test(text)) return undefined;
  const matches = foods.filter((food) => food.aliases.some((alias) => text.includes(` ${normalize(alias)} `)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function nutritionFromParent(fields: ExtraField[]): NutritionValues | null {
  // Only reuse calculations from this version; old empty values were saved as zero.
  if (!fields.some((field) => field.label === 'Método nutricional CA46')) return null;
  const values = Object.fromEntries(keys.map((key) => {
    const field = fields.find((item) => item.label === nutritionLabels[key]);
    const match = field?.value.match(/^(\d+(?:[.,]\d+)?)/);
    return [key, match ? numberValue(match[1]) : null];
  })) as NutritionValues;
  return values.energyKcal !== null && values.energyKcal > 0 ? values : null;
}

export function validNutrition(values: NutritionValues) {
  return keys.every((key) => values[key] === null || (Number.isFinite(values[key]) && values[key]! >= 0 && (key === 'energyKcal' ? values[key]! <= 1000 : values[key]! <= 100)))
    && (values.sugarsG === null || values.carbsG === null || values.sugarsG <= values.carbsG + 0.01)
    && (values.saturatedFatG === null || values.fatG === null || values.saturatedFatG <= values.fatG + 0.01);
}

export function manualNutrition(fields: Record<string, unknown>): NutritionValues | null {
  const values = Object.fromEntries(keys.map((key) => [key, numberValue(fields[key])])) as NutritionValues;
  return keys.every((key) => values[key] !== null) && validNutrition(values) ? values : null;
}

export function calculateKitchenNutrition(input: {
  productName: string; referenceId?: string; parentNutrition?: NutritionValues | null;
  inputWeightKg: unknown; outputWeightKg: unknown; processType: string;
  ingredients: { name: string; quantity: string }[]; incorporatedSaltGrams?: unknown;
}) {
  const warnings: string[] = [];
  const initial = numberValue(input.inputWeightKg);
  const final = numberValue(input.outputWeightKg);
  const food = input.referenceId ? foods.find((item) => item.id === input.referenceId) : findFood(input.productName);
  const base = input.parentNutrition || food?.per100g;
  const sources = input.parentNutrition ? ['Etiqueta madre · cálculo CA46'] : food ? [`USDA SR28 · ${food.id} · ${food.name}`] : [];
  const pending = (message: string) => ({ values: null, sources, warnings: [message], method: 'Pendiente de calcular' });
  if (!base) return pending('Selecciona una referencia del producto o introduce valores contrastados en modo manual.');
  if (!initial || !final) return pending('Indica el peso comestible antes de cocinar y el peso final real.');
  if (!['Vapor', 'Cocción', 'Cocción + salmuera', 'Horneado', 'Plancha'].includes(input.processType)) return pending('Para este proceso introduce valores nutricionales contrastados en modo manual.');
  const totals = Object.fromEntries(keys.map((key) => [key, base[key] === null ? null : base[key]! * initial * 10])) as NutritionValues;
  for (const ingredient of input.ingredients.filter((item) => item.name.trim())) {
    const reference = findFood(ingredient.name);
    const grams = ingredientGrams(ingredient.quantity);
    if (!reference || !grams) return pending(`Falta una referencia o una cantidad en g/kg para «${ingredient.name}». No se calculará una mezcla incompleta.`);
    sources.push(`USDA SR28 · ${reference.id} · ${reference.name} · ${grams} g`);
    for (const key of keys) totals[key] = totals[key] === null || reference.per100g[key] === null ? null : totals[key]! + reference.per100g[key]! * grams / 100;
  }
  const addedSalt = numberValue(input.incorporatedSaltGrams ?? 0);
  if (addedSalt === null) return pending('La sal incorporada debe ser una cantidad válida en gramos.');
  // Salt in the brine bath is not assumed to have been absorbed by the product.
  if (totals.saltG !== null) totals.saltG += addedSalt;
  const values = Object.fromEntries(keys.map((key) => [key, totals[key] === null ? null : Math.round(totals[key]! / (final * 10) * 100) / 100])) as NutritionValues;
  if (!validNutrition(values)) return pending('Los pesos producen valores nutricionales incoherentes. Revisa pesos e ingredientes.');
  warnings.push('Estimación por balance de ingredientes y peso final. Supone conservación de nutrientes; no mide pérdidas en jugos o caldo ni absorción de salmuera.');
  if (input.processType.includes('salmuera')) warnings.push('Introduce solo la sal incorporada al alimento, no toda la sal utilizada en el baño.');
  const missing = keys.filter((key) => values[key] === null);
  if (missing.length) warnings.push(`Sin dato en la referencia: ${missing.map((key) => nutritionLabels[key]).join(', ')}. No se sustituye por cero.`);
  return { values, sources, warnings, method: `Estimación por balance · ${input.processType} · rendimiento ${Math.round(final / initial * 10000) / 100} %` };
}

export function nutritionExtraFields(values: NutritionValues | null, method: string, sources: string[], warnings: string[]): ExtraField[] {
  return [
    { label: 'Método nutricional CA46', value: method },
    ...(sources.length ? [{ label: 'Fuente nutricional', value: sources.join('; ') }] : []),
    ...(warnings.length ? [{ label: 'Revisión nutricional', value: warnings.join(' ') }] : []),
    ...(values ? keys.filter((key) => values[key] !== null).map((key) => ({ label: nutritionLabels[key], value: `${values[key]} ${key === 'energyKcal' ? 'kcal' : 'g'} / 100 g` })) : []),
  ];
}

export function inheritedKitchenFields(fields: ExtraField[]) {
  const generated = new Set([...Object.values(nutritionLabels), 'Método nutricional CA46', 'Fuente nutricional', 'Revisión nutricional', 'Transformación', 'Lote de origen', 'Cadena CA46', 'Origen provisional', 'Peso antes de cocinar', 'Peso final cocinado', 'Conservación', 'Consumo preferente', 'Fecha límite de consumo', 'Exposición en visor', 'Sal / salmuera', 'Sal incorporada', 'Ingredientes / aditivos']);
  return fields.filter((field) => !generated.has(field.label));
}
