import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function moduleAt(path, imports, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, console, ...globals,
    require: name => { assert.ok(imports[name], name); return imports[name]; } });
  return module.exports;
}

const fixtures = {
  'admin-A': { company_id: 'company-A', role: 'admin_empresa', is_active: true },
  'admin-B': { company_id: 'company-B', role: 'admin_empresa', is_active: true },
};

async function companyResponse(userId, options = {}) {
  const reads = [];
  const route = moduleAt('../app/api/tenant/me/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/company-access-server': { resolveCompanyEffectiveAccess: async () => ({ plan: 'gratis', source: 'base', features: {} }) },
    '@/lib/supabase': { supabaseAdmin: {
      auth: { getUser: async () => ({ data: { user: userId ? { id: userId, email: `${userId}@example.com` } : null } }) },
      from: table => {
        const filters = {};
        const query = { select() { return this; }, limit() { return this; }, eq(key, value) { filters[key] = value; return this; },
          async maybeSingle() {
            reads.push({ table, filters });
            if (options.fail && table === 'company_members') return { data: null, error: { message: 'database unavailable' } };
            if (table === 'company_members') return { data: fixtures[filters.user_id] || null };
            if (table === 'super_admins') return { data: userId === 'superadmin' ? { is_active: true } : null };
            throw new Error(`Unexpected table ${table}`);
          },
          async single() { reads.push({ table, filters }); return { data: { id: filters.id, name: filters.id, plan: 'gratis', status: 'active' } }; },
        };
        return query;
      },
    } },
  });
  const response = await route.GET(new Request('https://ca46.test/api/tenant/me', { headers: { Authorization: 'Bearer test' } }));
  return { status: response.status, payload: await response.json(), reads };
}

test('each administrator resolves only their own company', async () => {
  for (const [userId, companyId] of [['admin-A', 'company-A'], ['admin-B', 'company-B']]) {
    const { status, payload, reads } = await companyResponse(userId);
    assert.equal(status, 200);
    assert.equal(payload.tenant.company.id, companyId);
    assert.equal(payload.accountKind, 'company');
    assert.equal(reads.find(r => r.table === 'company_members').filters.user_id, userId);
    assert.equal(reads.find(r => r.table === 'companies').filters.id, companyId);
  }
});
test('global administrator is distinguished from new company signup', async () => {
  const { payload } = await companyResponse('superadmin');
  assert.equal(payload.tenant, null);
  assert.equal(payload.accountKind, 'superadmin');
  assert.equal(payload.email, 'superadmin@example.com');
});
test('new account remains eligible for explicit onboarding', async () => {
  const { payload } = await companyResponse('new-user');
  assert.equal(payload.tenant, null);
  assert.equal(payload.accountKind, 'unlinked');
});
test('database error is not reported as a missing company', async () => {
  const { status, payload } = await companyResponse('admin-A', { fail: true });
  assert.equal(status, 503);
  assert.equal(payload.code, 'TENANT_READ_FAILED');
  assert.equal('tenant' in payload, false);
});
test('invalid session cannot resolve a company', async () => assert.equal((await companyResponse(null)).status, 401));

for (const mode of ['success', 'reject', 'error', 'stall']) {
  test(`logout returns to login and removes only project credentials: ${mode}`, async () => {
    const removed = [];
    const destinations = [];
    const calls = [];
    const storage = { removeItem: key => removed.push(key) };
    const logout = moduleAt('../lib/logout.ts', {
      '@/lib/supabaseClient': { supabase: { auth: { signOut: async options => {
        calls.push(options);
        if (mode === 'reject') throw new Error('offline');
        if (mode === 'stall') return new Promise(() => {});
        return { error: mode === 'error' ? new Error('revocation unavailable') : null };
      } } } },
      '@/lib/targetGuard': { ALLOWED_PRODUCTION_PROJECT_REF: 'production-ref' },
    }, {
      window: { localStorage: storage, sessionStorage: storage, location: { replace: url => destinations.push(url) } },
      setTimeout: fn => { queueMicrotask(fn); return 1; }, clearTimeout: () => {},
    });
    await logout.logoutAndRedirect();
    assert.equal(calls[0].scope, 'local');
    assert.deepEqual(destinations, ['/acceso']);
    assert.equal(removed.length, 6);
    assert.ok(removed.every(key => key.startsWith('sb-production-ref-auth-token')));
  });
}
