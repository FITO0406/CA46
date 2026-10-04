import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(relative, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, console, Date,
    require: (name) => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return loaded.exports;
}
const n = load('../lib/kitchen-nutrition.ts', { './kitchen-foods.json': JSON.parse(readFileSync(new URL('../lib/kitchen-foods.json', import.meta.url), 'utf8')) });
const trace = load('../lib/traceability.ts');
const base = { productName: 'Chocos Sepia officinalis', inputWeightKg: 4, outputWeightKg: 2, processType: 'Vapor', ingredients: [] };

test('steamed cuttlefish without extra ingredients scales verified raw reference to final weight', () => {
  const result = n.calculateKitchenNutrition(base);
  assert.equal(result.values.energyKcal, 158);
  assert.equal(result.values.proteinG, 32.48);
  assert.equal(result.values.fatG, 1.4);
  assert.equal(result.values.saltG, 1.86);
  assert.equal(result.values.sugarsG, null);
  assert.match(result.sources[0], /15163/);
  assert.match(result.method, /Vapor.*50 %/);
});
test('changing final weight recalculates concentrations without fixed cooking loss', () => {
  const result = n.calculateKitchenNutrition({ ...base, outputWeightKg: 4 });
  assert.equal(result.values.proteinG, 16.24);
  assert.equal(result.values.energyKcal, 79);
});
test('known added ingredient contributes to full batch before division by final weight', () => {
  const result = n.calculateKitchenNutrition({ ...base, ingredients: [{ name: 'aceite de oliva', quantity: '100 g' }] });
  assert.equal(result.values.fatG, 6.4);
  assert.equal(result.values.energyKcal, 202.2);
});
test('unknown ingredient or quantity cannot silently generate incomplete nutritional totals', () => {
  assert.equal(n.calculateKitchenNutrition({ ...base, ingredients: [{ name: 'aditivo desconocido', quantity: '20 g' }] }).values, null);
  assert.equal(n.calculateKitchenNutrition({ ...base, ingredients: [{ name: 'limón', quantity: 'una pieza' }] }).values, null);
});
test('missing values are omitted from label instead of being printed as zero', () => {
  const result = n.calculateKitchenNutrition(base);
  const fields = n.nutritionExtraFields(result.values, result.method, result.sources, result.warnings);
  assert.equal(fields.some((field) => field.label === 'Azúcares'), false);
  assert.equal(fields.some((field) => field.label === 'Proteínas' && field.value === '32.48 g / 100 g'), true);
});
test('only explicitly incorporated salt is included, not brine bath salt', () => {
  const result = n.calculateKitchenNutrition({ ...base, processType: 'Cocción + salmuera', incorporatedSaltGrams: 10 });
  assert.equal(result.values.saltG, 2.36);
  assert.match(result.warnings.join(' '), /no toda la sal/);
});
test('unsupported products, missing weights and physically impossible concentrations stay pending', () => {
  assert.equal(n.calculateKitchenNutrition({ ...base, productName: 'Producto desconocido' }).values, null);
  assert.equal(n.calculateKitchenNutrition({ ...base, outputWeightKg: '' }).values, null);
  assert.equal(n.calculateKitchenNutrition({ ...base, outputWeightKg: 0.01 }).values, null);
  assert.equal(n.findFood('bacalao salado'), undefined);
});
test('manual values require complete valid data, including genuine zero values', () => {
  assert.equal(n.manualNutrition({ energyKcal: '', proteinG: '' }), null);
  assert.equal(n.manualNutrition({ energyKcal: 10, proteinG: 1, carbsG: 1, sugarsG: 2, fatG: 0, saturatedFatG: 0, saltG: 0 }), null);
  assert.equal(n.manualNutrition({ energyKcal: 79, proteinG: 16.24, carbsG: 0.82, sugarsG: 0, fatG: 0.7, saturatedFatG: 0.118, saltG: 0.93 }).sugarsG, 0);
});
test('grandchild uses parent batch values and removes inherited nutritional duplicates', () => {
  const result = n.calculateKitchenNutrition(base);
  const fields = n.nutritionExtraFields(result.values, result.method, result.sources, result.warnings);
  const values = n.nutritionFromParent(fields);
  const next = n.calculateKitchenNutrition({ ...base, inputWeightKg: 2, outputWeightKg: 1, parentNutrition: values });
  assert.equal(next.values.proteinG, 64.96);
  assert.equal(n.inheritedKitchenFields([...fields, { label: 'Fecha límite de consumo', value: 'old' }, { label: 'Zona FAO', value: '27' }]).length, 1);
  assert.equal(n.nutritionFromParent([{ label: 'Valor energético', value: '0 kcal / 100 g' }]), null);
});
test('gram and kilogram quantities accept Spanish decimal commas and reject ambiguous units', () => {
  assert.equal(n.ingredientGrams('0,25 kg'), 250);
  assert.equal(n.ingredientGrams('25 gramos'), 25);
  assert.equal(n.ingredientGrams('25 ml'), null);
  assert.equal(n.ingredientGrams('-25 g'), null);
});

async function save(body = {}, options = {}) {
  const writes = {};
  const parent = { id: 'parent', company_id: 'company', product_name: 'Chocos', origin: 'Atlántico', source: options.provisional ? 'physical_label' : 'invoice', status: options.provisional ? 'provisional' : 'definitive', is_active: true, expires_at: '2099-01-01T00:00:00Z', category: trace.encodeTraceability({ lot: 'P1', scientificName: 'Sepia officinalis', extraFields: options.parentFields || [] }) };
  const route = load('../app/api/kitchen/route.ts', {
    'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } },
    crypto: { randomUUID: () => 'test-id' },
    '@/lib/traceability': trace, '@/lib/kitchen-nutrition': n,
    '@/lib/tenant-auth-server': { tenantContextForRequest: async () => options.unauthorized ? { ok: false, error: 'Denied', status: 403 } : { ok: true, context: { companyId: 'company', userId: 'user' } } },
    '@/lib/supabase': { supabaseAdmin: { from(table) {
      return { select() { return this; }, eq(key, value) { if (key === 'company_id') assert.equal(value, 'company'); return this; },
        async maybeSingle() { return { data: parent, error: null }; },
        insert(value) { writes[table] = value; return this; },
        async single() { return { data: { id: table === 'digital_tags' ? 'child' : 'transformation', ...writes[table] }, error: null }; },
      };
    } } },
  });
  const response = await route.POST(new Request('https://example.test/api/kitchen', { method: 'POST', body: JSON.stringify({ parentTagId: 'parent', processType: 'Vapor', inputWeightKg: 4, outputWeightKg: 2, outputProductName: 'Chocos al vapor', storageMaxTempC: 4, shelfLifeDays: 3, processedAt: '2026-10-04T12:00:00Z', ingredients: [], ...body }) }));
  return { status: response.status, body: await response.json(), writes };
}
test('server recalculates automatic nutrition, writes ten visor days and preserves three consumption days', async () => {
  const r = await save({ nutrition: { energyKcal: 999 } });
  assert.equal(r.status, 201);
  assert.equal(r.body.valid_hours, 240);
  assert.equal(r.writes.digital_tags.expires_at, '2026-10-14T12:00:00.000Z');
  assert.equal(r.writes.kitchen_transformations.shelf_life_days, 3);
  assert.equal(r.writes.kitchen_transformations.nutrition_per_100g.energyKcal, 158);
  assert.equal(r.writes.kitchen_transformations.nutrition_per_100g.sugarsG, null);
  const fields = trace.decodeTraceability(r.writes.digital_tags.category).extraFields;
  assert.equal(fields.find((field) => field.label === 'Fecha límite de consumo').value, '2026-10-07T12:00:00.000Z');
});
test('provisional ancestry remains visible while kitchen exposure lasts ten days', async () => {
  const r = await save({}, { provisional: true });
  assert.equal(r.status, 201);
  assert.equal(r.writes.digital_tags.status, 'provisional');
  assert.equal(r.body.valid_hours, 240);
});
test('pending recipes store pending status without manufacturing zeros', async () => {
  const r = await save({ ingredients: [{ name: 'unknown', quantity: '20 g' }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.nutrition_status, 'pending');
  assert.equal(r.writes.kitchen_transformations.nutrition_per_100g.energyKcal, undefined);
});
test('server rejects empty manual values and expired parent consumption dates', async () => {
  assert.equal((await save({ nutritionMode: 'manual', nutrition: {} })).status, 422);
  assert.equal((await save({}, { parentFields: [{ label: 'Fecha límite de consumo', value: '2026-10-03T12:00:00Z' }] })).status, 409);
});
test('unauthorized users cannot create kitchen labels', async () => {
  const r = await save({}, { unauthorized: true });
  assert.equal(r.status, 403);
  assert.equal(Object.keys(r.writes).length, 0);
});
