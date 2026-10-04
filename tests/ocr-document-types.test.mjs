import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Run the actual route handlers with simulated OCR responses. No external API,
// production database, credentials or real company records are used.
async function analyze(route, ocr, buyerNumber = '46') {
  const routeModule = { exports: {} };
  const source = readFileSync(new URL(`../app/api/${route}/route.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const imports = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/tenant-auth-server': { tenantContextForRequest: async () => ({ ok: true, context: { companyId: 'test-company' } }) },
    '@/lib/supabase': { supabaseAdmin: { from: () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { gesico_buyer_number: buyerNumber }, error: null }; } }) } },
  };
  runInNewContext(compiled, {
    module: routeModule, exports: routeModule.exports,
    require: (name) => { assert.ok(imports[name], `Unexpected import: ${name}`); return imports[name]; },
    process: { env: { GEMINI_API_KEY: 'simulated-test-key' } },
    Buffer, File, AbortSignal, console,
    fetch: async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(ocr) }] } }] }),
  });
  const form = new FormData();
  form.append('image', new File(['simulated-image'], 'test.jpg', { type: 'image/jpeg' }));
  const response = await routeModule.exports.POST(new Request('https://example.test/api/ocr', { method: 'POST', body: form }));
  return { status: response.status, body: await response.json() };
}

test('unrelated invoice photo is rejected before buyer validation, even without company buyer settings', async () => {
  const r = await analyze('analyze-invoice', { document_type: 'unknown', labels: [] }, '');
  assert.equal(r.status, 422);
  assert.equal(r.body.code, 'UNSUPPORTED_DOCUMENT');
  assert.equal(r.body.analysis, undefined);
});

test('box labels on invoice route point to 24-hour route without buyer error', async () => {
  const r = await analyze('analyze-invoice', { document_type: 'physical_label', labels: [] });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'WRONG_DOCUMENT_TYPE');
  assert.match(r.body.error, /24 h/);
});

test('missing document classification fails closed even if buyer matches', async () => {
  const r = await analyze('analyze-invoice', { buyer_number: '46', labels: [] });
  assert.equal(r.body.code, 'UNSUPPORTED_DOCUMENT');
});

test('confirmed invoice still requires configured buyer number', async () => {
  const r = await analyze('analyze-invoice', { document_type: 'invoice', buyer_number: '46' }, '');
  assert.equal(r.body.code, 'BUYER_NUMBER_REQUIRED');
});

test('confirmed invoice with unreadable buyer remains blocked', async () => {
  const r = await analyze('analyze-invoice', { document_type: 'invoice', buyer_number: '' });
  assert.equal(r.body.code, 'BUYER_NUMBER_NOT_READ');
});

test('invoice belonging to another buyer remains blocked', async () => {
  const r = await analyze('analyze-invoice', { document_type: 'invoice', buyer_number: '99' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'INVOICE_NOT_OWNED');
});

test('valid invoice retains multiple separate labels and ownership verification', async () => {
  const r = await analyze('analyze-invoice', { document_type: 'invoice', buyer_number: '46', labels: [
    { description: 'Merluza', lote: 'A', procedencia: 'Atlántico' },
    { description: 'Merluza', lote: 'B', procedencia: 'Atlántico' },
  ] });
  assert.equal(r.status, 200);
  assert.equal(r.body.ownership_verified, true);
  assert.equal(r.body.analysis.labels.length, 2);
  assert.notEqual(r.body.analysis.labels[0].lote, r.body.analysis.labels[1].lote);
});

test('physical label requires no buyer and retains 24-hour mode', async () => {
  const r = await analyze('analyze-physical-label', { document_type: 'physical_label', label: { description: 'Merluza', lote: 'A', procedencia: 'Atlántico' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'physical_label');
  assert.equal(r.body.provisional_hours, 24);
  assert.equal(r.body.analysis.buyer, '');
});

test('unclassified photo cannot become a temporary label from plausible extracted fields', async () => {
  const r = await analyze('analyze-physical-label', { document_type: 'unknown', label: { description: 'Merluza', lote: 'A', procedencia: 'Atlántico' } });
  assert.equal(r.status, 422);
  assert.equal(r.body.code, 'UNSUPPORTED_DOCUMENT');
  assert.equal(r.body.analysis, undefined);
});

test('invoice on temporary route directs to invoice route', async () => {
  const r = await analyze('analyze-physical-label', { document_type: 'invoice' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'WRONG_DOCUMENT_TYPE');
  assert.match(r.body.error, /72 h/);
});
