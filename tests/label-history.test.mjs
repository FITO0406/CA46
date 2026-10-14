import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const now = Date.now();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, days, company = 'A', source = 'invoice') => ({ id: id(n), company_id: company, source, created_at: new Date(now - days * 86400000).toISOString(), expires_at: new Date(now - 86400000).toISOString(), product_name: 'Merluza', is_active: false, annulled_at: null });
const rows = [row(1, 2), row(2, 14, 'A', 'physical_label'), row(3, 16), row(4, 1, 'B'), row(5, 1, 'A', 'kitchen')];
let calls = [];
const db = { from: () => {
  let changes = null;
  let filters = [], start = 0, end = 100;
  const builder = {
    update(value) { changes = value; return this; },
    in(k,v) { filters.push(r => v.includes(r[k])); return this; },
    is(k,v) { filters.push(r => r[k] === v); return this; },
    select() { return this; }, eq(k,v) { filters.push(r => r[k] === v); return this; },
    gte(k,v) { filters.push(r => r[k] >= v); return this; },
    lte(k,v) { filters.push(r => r[k] <= v); return this; },
    lt(k,v) { filters.push(r => r[k] < v); return this; },
    or(value) { if (value === 'source.neq.kitchen,source.is.null') filters.push(r => r.source !== 'kitchen'); return this; },
    order() { return this; }, range(a,b) { start = a; end = b; return this; },
    async maybeSingle() { const found = rows.find(r => filters.every(f => f(r))) || null; if (found && changes) Object.assign(found, changes); return { data: found, error: null }; },
    then(resolve) { return Promise.resolve({ data: rows.filter(r => filters.every(f => f(r))).slice(start,end + 1), error: null }).then(resolve); },
  };
  return builder;
} };
const loadedModule = { exports: {} };
const imports = {
  'next/server': { NextResponse: { json: (data, init) => Response.json(data,init) } },
  '@/lib/supabase': { supabaseAdmin: db },
  '@/lib/tenant-auth-server': { tenantContextForRequest: async request => request.headers.has('authorization') ? { ok: true, context: { companyId: 'A', companyName: 'Test' } } : { ok: false, status: 401, error: 'No autorizado' } },
  '@/lib/company-drive-archive': { driveHistoryDocument: data => JSON.stringify(data) },
  '@/lib/company-drive-pdf': { driveHistoryPdf: json => { calls.push(JSON.parse(json)); return Buffer.from('%PDF-test'); } },
};
const code = ts.transpileModule(readFileSync(new URL('../app/api/label-history/route.ts',import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: name => imports[name], Request, Response, URL, Date, Intl, Uint8Array });
const get = (params = '', auth = true) => loadedModule.exports.GET(new Request(`https://ca46.test/api/label-history${params}`, { headers: auth ? { authorization: 'Bearer test' } : {} }));
test('history requires authentication', async () => assert.equal((await get('', false)).status,401));
test('expired 24h and 72h labels remain recoverable, isolated by company and retention', async () => {
  const response = await get();
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual((await response.json()).labels.map(r => r.id),[id(1),id(2)]);
});
test('type filters work', async () => assert.deepEqual((await (await get('?type=24')).json()).labels.map(r => r.id),[id(2)]));
test('foreign-company and older-than-15-days PDF downloads return 404', async () => {
  assert.equal((await get(`?id=${id(4)}`)).status,404);
  assert.equal((await get(`?id=${id(3)}`)).status,404);
});
test('PDF recovery preserves original expiry and never writes or republishes data', async () => {
  const snapshot = structuredClone(rows);
  calls = [];
  const response = await get(`?id=${id(2)}`);
  assert.equal(response.headers.get('content-type'),'application/pdf');
  assert.equal(calls[0].expires_at,rows[1].expires_at);
  assert.equal(calls[0].created_at,rows[1].created_at);
  assert.deepEqual(rows,snapshot);
});
test('invalid id, date and pagination rejected', async () => {
  for (const params of ['?id=bad','?date=bad','?page=-1','?page=NaN']) assert.equal((await get(params)).status,400);
});

const post = (body, auth = true) => loadedModule.exports.POST(new Request('https://ca46.test/api/label-history', { method: 'POST', headers: auth ? { authorization: 'Bearer test', 'content-type': 'application/json' } : {}, body: JSON.stringify(body) }));
test('restore requires authentication and valid future duration', async () => {
  assert.equal((await post({ id: id(1), duration: '72' }, false)).status, 401);
  for (const body of [null, {id:'bad',duration:'24'}, {id:id(1),duration:'48'}, {id:id(1),duration:'date',until:'invalid'}, {id:id(1),duration:'date',until:new Date(now-1000).toISOString()}]) assert.equal((await post(body)).status,400);
});
test('restore rejects foreign, kitchen, old and annulled labels', async () => {
  for (const n of [3,4,5]) assert.equal((await post({id:id(n),duration:'72'})).status,404);
  rows[0].annulled_at = new Date().toISOString();
  assert.equal((await post({id:id(1),duration:'72'})).status,404);
  rows[0].annulled_at = null;
});
test('restore updates same label for 24h, 72h or custom date without changing product data', async () => {
  for (const duration of ['24','72','date']) {
    const original = structuredClone(rows[0]);
    const start = Date.now();
    const until = new Date(start + 7*86400000).toISOString();
    const response = await post({id:id(1),duration,until});
    assert.equal(response.status,200);
    const restored = (await response.json()).label;
    const expected = duration === 'date' ? Date.parse(until) : start + Number(duration)*3600000;
    assert.ok(Math.abs(Date.parse(restored.expires_at)-expected) < 1000);
    assert.equal(restored.is_active,true);
    assert.deepEqual({...restored,is_active:original.is_active,expires_at:original.expires_at},original);
    assert.equal(rows.length,5);
    Object.assign(rows[0],original);
  }
});
