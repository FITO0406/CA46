import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';

function harness(role = 'admin_empresa') {
  const rows = [], callbacks = [];
  const db = { from(table) {
    const filters = []; let inserted;
    const query = {
      select() { return this; }, eq(k,v) { filters.push(r => r[k] === v); return this; },
      gt(k,v) { filters.push(r => r[k] > v); return this; }, in(k,v) { filters.push(r => v.includes(r[k])); return this; },
      insert(records) { inserted = records; return this; },
      async maybeSingle() { assert.equal(table, 'company_settings'); return { data: { gesico_buyer_number: '46' }, error: null }; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        assert.equal(table, 'digital_tags');
        if (inserted) { const records = inserted.map(r => ({ ...r, id: randomUUID() })); rows.push(...records); return { data: records, error: null }; }
        return { data: rows.filter(r => filters.every(f => f(r))), error: null };
      }).then(resolve, reject); },
    }; return query;
  }};
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/publish-labels/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = {
    'node:crypto': { createHash }, 'next/server': { after: cb => callbacks.push(cb), NextResponse: { json: (data, options) => Response.json(data, options) } },
    '@/lib/company-drive-archive': { archiveCompanyLabelsSafely: async () => {} }, '@/lib/supabase': { supabaseAdmin: db },
    '@/lib/tenant-auth-server': { tenantContextForRequest: async request => request.headers.has('authorization') ? { ok: true, context: { companyId: 'A', userId: 'U', role, companyName: 'Company A' } } : { ok: false, status: 401, error: 'Unauthorized' } },
    '@/lib/traceability': { encodeTraceability: value => JSON.stringify(value) },
  };
  runInNewContext(compiled, { module, exports: module.exports, require: name => { assert.ok(imports[name], name); return imports[name]; }, console, Date, Set });
  return { rows, callbacks, async request(labels, { dryRun = false, sourceMode = 'physical_label', authorized = true } = {}) {
    const response = await module.exports.POST(new Request('https://test/api/publish-labels', { method: 'POST', headers: authorized ? { Authorization: 'Bearer test' } : {}, body: JSON.stringify({ sourceMode, dryRun, invoices: [{ invoice_number: '123', buyer_number: '46', labels }] }) }));
    return { status: response.status, body: await response.json() };
  }};
}
const label = (lote, draft_key = lote) => ({ description: 'Merluza', lote, procedencia: 'Atlántico', draft_key });

for (const sourceMode of ['invoice', 'physical_label']) {
  test(`${sourceMode}: duplicate preflight never publishes, selected originals remain and exclusions unblock the group`, async () => {
    const h = harness();
    assert.equal((await h.request([label('DUP')], { sourceMode })).status, 201);
    const preflight = await h.request([label('DUP'), label('NEW')], { sourceMode, dryRun: true });
    assert.equal(preflight.status, 200); assert.equal(h.rows.length, 1); assert.equal(h.callbacks.length, 1);
    assert.equal(preflight.body.conflicts[0].draft_key, 'DUP'); assert.equal(preflight.body.conflicts[0].published_id, h.rows[0].id);
    assert.equal((await h.request([label('DUP'), label('NEW')], { sourceMode })).status, 409);
    const response = await h.request([{ ...label('DUP'), excluded: true }, label('NEW')], { sourceMode });
    assert.equal(response.status, 201); assert.equal(response.body.published, 1); assert.equal(h.rows.length, 2);
    assert.equal(h.rows[0].is_active, true);
  });
}

test('duplicates within one batch identify later copies and prevent any insert', async () => {
  const h = harness(); const labels = [label('SAME', 'first'), label('SAME', 'second'), label('OTHER')];
  const check = await h.request(labels, { dryRun: true });
  assert.deepEqual(check.body.conflicts.map(c => [c.draft_key, c.kind]), [['second', 'batch']]);
  assert.equal(h.rows.length, 0); assert.equal((await h.request(labels)).status, 409); assert.equal(h.rows.length, 0);
  assert.equal((await h.request(labels.map(l => ({ ...l, excluded: l.draft_key === 'second' })))).body.published, 2);
});

test('employee receives only draft conflicts and cannot obtain published IDs', async () => {
  const h = harness('empleado'); await h.request([label('DUP')]);
  const check = await h.request([label('DUP')], { dryRun: true });
  assert.equal(check.body.canAnnul, false); assert.equal(check.body.conflicts.length, 1);
  assert.equal(check.body.conflicts[0].published_id, undefined);
});

test('other-company and expired labels never block this company', async () => {
  const h = harness(); await h.request([label('DUP')]);
  h.rows[0].company_id = 'B';
  assert.equal((await h.request([label('DUP')], { dryRun: true })).body.conflicts.length, 0);
  h.rows[0].company_id = 'A'; h.rows[0].expires_at = '2000-01-01T00:00:00Z';
  assert.equal((await h.request([label('DUP')], { dryRun: true })).body.conflicts.length, 0);
});

test('preflight can inspect incomplete drafts but publication still validates required fields', async () => {
  const h = harness(); const invalid = { ...label('A'), procedencia: '' };
  assert.equal((await h.request([invalid], { dryRun: true })).status, 200);
  assert.equal((await h.request([invalid])).body.code, 'REVIEW_REQUIRED'); assert.equal(h.rows.length, 0);
});

test('empty selection and unauthorized preflight never insert or archive', async () => {
  const h = harness();
  assert.equal((await h.request([{ ...label('A'), excluded: true }], { dryRun: true })).status, 200);
  assert.equal((await h.request([{ ...label('A'), excluded: true }])).status, 400);
  assert.equal((await h.request([label('A')], { dryRun: true, authorized: false })).status, 401);
  assert.equal(h.rows.length, 0); assert.equal(h.callbacks.length, 0);
});
