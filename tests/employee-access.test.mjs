import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function moduleAt(path, imports = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(compiled, { module, exports: module.exports, URL, process: { env: {} }, require: name => { assert.ok(imports[name], name); return imports[name]; } });
  return module.exports;
}
const permissions = moduleAt('../lib/employee-access.ts');
async function access(path, method, role = 'empleado', active = true, confirmed = true, companyStatus = 'active') {
  const server = moduleAt('../lib/tenant-auth-server.ts', {
    '@/lib/employee-access': permissions,
    '@/lib/supabase': { supabaseAdmin: {
      auth: { getUser: async () => ({ data: { user: { id: 'employee', email_confirmed_at: confirmed ? '2026-10-04' : null } } }) },
      from: table => ({ select() { return this; }, eq() { return this; }, limit() { return this; }, async maybeSingle() { return { data: active ? { company_id: 'company-A', role, is_active: true } : null }; }, async single() { assert.equal(table, 'companies'); return { data: { id: 'company-A', name: 'Empresa A', status: companyStatus } }; } }),
    } },
  });
  return server.tenantContextForRequest(new Request(`https://ca46.test${path}`, { method, headers: { Authorization: 'Bearer token' } }));
}
for (const path of ['/api/analyze-invoice','/api/analyze-physical-label','/api/publish-labels']) {
  test(`employee may create through ${path} only for server-bound company`, async () => {
    const result = await access(`${path}?companyId=company-B`, 'POST');
    assert.equal(result.ok, true); assert.equal(result.context.companyId, 'company-A');
    assert.equal((await access(path, 'GET')).status, 403);
  });
}
for (const path of ['/api/tenant/settings','/api/tenant/members','/api/kitchen','/api/manage-labels','/api/company-drive/status','/api/company-drive/connect','/api/sync-drive','/api/temperatures']) {
  test(`employee blocked from ${path}`, async () => { for (const method of ['GET','POST','PUT','PATCH','DELETE']) assert.equal((await access(path, method)).status, 403); });
}
for (const method of ['GET','POST','DELETE']) {
  test(`employee can ${method} only their own analysis jobs`, async () => {
    assert.equal((await access('/api/label-jobs',method)).ok,true);
    assert.equal((await access('/api/label-jobs',method,'empleado',false)).ok,false);
    assert.equal((await access('/api/label-jobs',method,'empleado',true,false)).status,403);
  });
}
test('employee cannot invoke arbitrary analysis-job subroutes', async () => assert.equal((await access('/api/label-jobs/admin','GET')).status,403));
test('deactivated employee cannot publish', async () => assert.equal((await access('/api/publish-labels','POST','empleado',false)).ok, false));
test('unconfirmed employee cannot publish', async () => assert.equal((await access('/api/publish-labels','POST','empleado',true,false)).status, 403));
test('inactive company cannot publish', async () => assert.equal((await access('/api/publish-labels','POST','empleado',true,true,'suspended')).status, 403));
test('administrator keeps configuration access', async () => assert.equal((await access('/api/tenant/settings','PUT','admin_empresa')).ok, true));

async function membersRoute(method, body, role = 'admin_empresa', identities = [], rpcResult = true) {
  const calls = [];
  const route = moduleAt('../app/api/tenant/members/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/tenant-auth-server': { tenantContextForRequest: async () => ({ ok: true, context: { companyId: 'company-A', userId: 'admin-A', role } }) },
    '@/lib/supabase': { supabaseAdmin: {
      rpc: async (name, args) => { calls.push({ name, args }); return { data: name === 'ca46_employee_identity' ? identities : rpcResult }; },
      auth: { admin: { generateLink: async args => { calls.push({ name: 'generateLink', args }); return { data: { user: { id: 'new-employee' }, properties: { hashed_token: 'one-use-token' } } }; } } },
    } },
  });
  const response = await route[method](new Request('https://ca46.test/api/tenant/members', { method, ...(body ? { body: JSON.stringify(body) } : {}) }));
  return { status: response.status, body: await response.json(), calls };
}
test('invitation binds administrator company and returns activation link, ignoring supplied company', async () => {
  const r = await membersRoute('POST',{ email: ' Employee@Example.com ', companyId: 'company-B' });
  assert.equal(r.status,201); assert.match(r.body.invitationUrl,/activar-empleado\?token_hash=one-use-token$/);
  const bind = r.calls.find(c => c.name === 'ca46_bind_employee');
  assert.equal(bind.args.p_company_id,'company-A'); assert.equal(bind.args.p_admin_id,'admin-A');
  assert.equal(r.calls.find(c => c.name === 'generateLink').args.options.data.signup_source,'ca46_employee');
});
test('existing administrator or another company cannot be downgraded or invited', async () => {
  for (const identity of [{ company_id:'company-A',member_role:'admin_empresa' },{ company_id:'company-B',member_role:'empleado' }]) {
    const r = await membersRoute('POST',{email:'existing@example.com'},'admin_empresa',[identity]);
    assert.equal(r.status,409); assert.equal(r.calls.length,1);
  }
});
test('encargado cannot list users or invite employees', async () => {
  for (const method of ['GET','POST','PATCH']) { const r = await membersRoute(method,method === 'GET' ? undefined : {},'encargado'); assert.equal(r.status,403); assert.equal(r.calls.length,0); }
});
test('deactivation always targets administrator company; protected target rejected', async () => {
  const r = await membersRoute('PATCH',{userId:'11111111-1111-1111-1111-111111111111',active:false,companyId:'company-B'},'admin_empresa',[],false);
  assert.equal(r.status,404); assert.equal(r.calls[0].args.p_company_id,'company-A');
});
