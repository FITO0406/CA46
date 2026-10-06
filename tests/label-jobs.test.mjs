import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';

// Exercise the real API and background callback with a transactional in-memory
// database. OCR is the only external operation simulated here.
function harness() {
  const rows = [];
  const callbacks = [];
  const calls = [];
  let actor = { companyId: 'company-A', userId: 'user-A', role: 'empleado' };
  let failure = false;
  let release;
  let barrier = Promise.resolve();
  const database = { from(table) {
    assert.equal(table, 'label_analysis_jobs');
    let operation = 'select', values, fields, options;
    const filters = [];
    const builder = {
      select(value) { fields = value; return this; },
      eq(k,v) { filters.push(r => r[k] === v); return this; },
      gt(k,v) { filters.push(r => r[k] > v); return this; },
      lte(k,v) { filters.push(r => r[k] <= v); return this; },
      in(k,v) { filters.push(r => v.includes(r[k])); return this; },
      update(value) { operation = 'update'; values = value; return this; },
      upsert(value, opts) { operation = 'upsert'; values = value; options = opts; return this; },
      delete() { operation = 'delete'; return this; },
      then(resolve, reject) { return this.execute().then(resolve, reject); },
      async single() { const r = await this.execute(); return { ...r, data: r.data[0] || null, error: r.data.length !== 1 ? Error('not single') : null }; },
      async maybeSingle() { const r = await this.execute(); return { ...r, data: r.data[0] || null }; },
      async execute() {
        let matching = rows.filter(r => filters.every(f => f(r)));
        if (operation === 'upsert') {
          const existing = rows.find(r => r.id === values.id && r.company_id === values.company_id && r.user_id === values.user_id);
          if (!existing) rows.push(structuredClone(values));
          else if (!options.ignoreDuplicates) Object.assign(existing, values);
          matching = [];
        } else if (operation === 'update') matching.forEach(r => Object.assign(r, structuredClone(values)));
        else if (operation === 'delete') matching.forEach(r => rows.splice(rows.indexOf(r), 1));
        const result = matching.map(r => fields ? Object.fromEntries(fields.split(',').map(k => [k, r[k]])) : r);
        return { data: structuredClone(result), error: null };
      },
    };
    return builder;
  } };
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL('../app/api/label-jobs/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const ocr = mode => async request => {
    calls.push({ mode, token: request.headers.get('authorization'), photo: (await request.formData()).get('image').name });
    await barrier;
    return failure ? Response.json({ error: 'comprador incorrecto' }, { status: 409 }) : Response.json({ analysis: { labels: [{ description: 'Merluza', lote: 'A', procedencia: 'Atlántico' }] }, mode });
  };
  const imports = {
    'node:crypto': { randomUUID },
    'next/server': { after: cb => callbacks.push(cb), NextResponse: { json: (body,init) => Response.json(body,init) } },
    '@/lib/supabase': { supabaseAdmin: database },
    '@/lib/tenant-auth-server': { tenantContextForRequest: async request => request.headers.has('authorization') ? { ok: true, context: { ...actor } } : { ok: false, status: 401, error: 'No autorizado.' } },
    '@/app/api/analyze-invoice/route': { POST: ocr('invoice') },
    '@/app/api/analyze-physical-label/route': { POST: ocr('physical_label') },
  };
  runInNewContext(source, { module, exports: module.exports, require: name => { assert.ok(imports[name],name); return imports[name]; }, Buffer, File, FormData, Request, URL, Date, console });
  async function request(method, id, mode = 'invoice', retry = false, authorized = true, expected = {}) {
    let body;
    if (method === 'POST') {
      body = new FormData(); body.append('id',id); body.append('mode',mode);
      body.append('image', new File(['test-photo'],'foto.jpg',{ type:'image/jpeg' }));
      if (retry) body.append('retry','true');
    } else if (method === 'DELETE') body = JSON.stringify({ ids:[id] });
    const response = await module.exports[method](new Request(`https://ca46.test/api/label-jobs${method === 'GET' && id ? `?id=${id}` : ''}`, { method, headers: authorized ? { Authorization:'Bearer test-user-token', ...expected } : {}, body }));
    return { status:response.status, body:await response.json() };
  }
  return { rows, callbacks, calls, request, actor(value) { actor=value; }, fail(value) { failure=value; }, pause() { barrier=new Promise(r => { release=r; }); }, release() { release(); } };
}

test('uploaded job finishes without an open client and is recovered on return', async () => {
  const h=harness(), id=randomUUID(); h.pause();
  const accepted=await h.request('POST',id);
  assert.equal(accepted.status,202); assert.equal(accepted.body.job.status,'queued');
  assert.equal(accepted.body.job.image_base64,undefined);
  assert.ok(h.rows[0].image_base64); assert.equal(h.rows[0].authorization,undefined);
  const worker=h.callbacks.shift()();
  await new Promise(r=>setImmediate(r));
  assert.equal((await h.request('GET',id)).body.job.status,'running');
  h.release(); await worker;
  const restored=await h.request('GET',id);
  assert.equal(restored.body.job.status,'done');
  assert.equal(restored.body.job.result.analysis.labels[0].lote,'A');
  assert.equal(h.rows[0].image_base64,null);
});

test('overlapping submissions run OCR once and return the cached result', async () => {
  const h=harness(), id=randomUUID();
  await h.request('POST',id); await h.request('POST',id);
  await Promise.all(h.callbacks.splice(0).map(cb=>cb()));
  assert.equal(h.calls.length,1);
  assert.equal((await h.request('POST',id)).body.job.status,'done');
  assert.equal(h.callbacks.length,0);
});

test('another user or company cannot recover, delete or overwrite a job', async () => {
  const h=harness(), id=randomUUID(); await h.request('POST',id);
  for (const actor of [{ companyId:'company-A', userId:'other' },{ companyId:'company-B', userId:'user-A' }]) {
    h.actor(actor);
    assert.equal((await h.request('GET',id)).body.job,null);
    await h.request('DELETE',id); assert.equal(h.rows.length,1);
  }
  h.actor({ companyId:'company-B',userId:'user-A' });
  await h.request('POST',id,'physical_label');
  assert.equal(h.rows.length,2); assert.equal(h.rows[0].mode,'invoice');
});

test('OCR rejection remains rejected and only explicit retry restarts it', async () => {
  const h=harness(), id=randomUUID(); h.fail(true);
  await h.request('POST',id,'physical_label'); await h.callbacks.shift()();
  assert.equal((await h.request('GET',id)).body.job.error,'comprador incorrecto');
  await h.request('POST',id,'physical_label'); assert.equal(h.callbacks.length,0);
  h.fail(false); await h.request('POST',id,'physical_label',true); await h.callbacks.shift()();
  assert.equal((await h.request('GET',id)).body.job.status,'done');
  assert.equal(h.calls[1].mode,'physical_label');
});

test('interrupted server worker recovers after its lease, never while live', async () => {
  const h=harness(), id=randomUUID(); await h.request('POST',id); h.callbacks.length=0;
  h.rows[0].status='running'; h.rows[0].started_at=new Date().toISOString();
  await h.request('GET',id); assert.equal(h.callbacks.length,0);
  h.rows[0].started_at=new Date(Date.now()-331000).toISOString();
  assert.equal((await h.request('GET',id)).body.job.status,'queued');
  await h.callbacks.shift()(); assert.equal(h.rows[0].status,'done');
});

test('expired jobs are inaccessible and a retained photo can be resubmitted', async () => {
  const h=harness(), id=randomUUID(); await h.request('POST',id); h.callbacks.length=0;
  h.rows[0].expires_at=new Date(Date.now()-1).toISOString();
  assert.equal((await h.request('GET',id)).body.job,null);
  assert.equal((await h.request('POST',id)).body.job.status,'queued');
  assert.equal(h.rows.length,1);
});

test('unauthenticated access and invalid identifiers fail closed', async () => {
  const h=harness();
  assert.equal((await h.request('GET',randomUUID(),'invoice',false,false)).status,401);
  assert.equal((await h.request('POST','bad-id')).status,400);
  assert.equal(h.rows.length,0);
});

test('a request from the previous account cannot submit or delete after account switching', async () => {
  const h=harness(),id=randomUUID();
  for (const method of ['GET','POST','DELETE']) assert.equal((await h.request(method,id,'invoice',false,true,{ 'X-CA46-Company':'old-company', 'X-CA46-User':'old-user' })).status,409);
  assert.equal(h.rows.length,0);
});
