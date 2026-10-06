import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function componentAt(path, imports, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(compiled, { module, exports: module.exports, console, AbortController,
    window: { setTimeout, clearTimeout, location: { replace() {} } }, ...globals,
    require: name => {
      if (name === 'react') return React;
      if (name === 'react/jsx-runtime') return imports.jsx;
      if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) };
      assert.ok(imports[name], name); return imports[name];
    },
  });
  return module.exports.default;
}
const jsx = await import('react/jsx-runtime');
const session = { user: { id: 'user-A', email: 'admin@example.com', user_metadata: {} }, access_token: 'test' };

async function renderGate(payload, status = 200, signedIn = true) {
  const logoutCalls = [];
  const Gate = componentAt('../components/PrivateAreaGate.tsx', {
    jsx,
    '@/lib/supabaseClient': { supabase: { auth: {
      getSession: async () => ({ data: { session: signedIn ? session : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } } },
    '@/lib/logout': { logoutAndRedirect: async () => logoutCalls.push('logout') },
  }, { fetch: async () => Response.json(payload, { status }) });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Gate, { requireTenant: false }, React.createElement('p', null, 'COMPANY_FORM'))); });
  return { renderer, logoutCalls };
}

test('SuperAdmin cannot see a new-company form and can switch back to login', async () => {
  const { renderer, logoutCalls } = await renderGate({ tenant: null, accountKind: 'superadmin' });
  const content = JSON.stringify(renderer.toJSON());
  assert.match(content, /Estás usando SuperAdmin/);
  assert.match(content, /admin@example.com/);
  assert.doesNotMatch(content, /COMPANY_FORM/);
  const button = renderer.root.findAllByType('button').find(b => b.children.includes('Cambiar de cuenta'));
  assert.ok(button);
  await act(async () => { await button.props.onClick(); });
  assert.deepEqual(logoutCalls, ['logout']);
  assert.match(JSON.stringify(renderer.toJSON()), /Cerrando sesión/);
  await act(async () => renderer.unmount());
});

test('linked company administrator sees company content and visible account identity', async () => {
  const { renderer } = await renderGate({ accountKind: 'company', tenant: {
    company: { id: 'company-A', name: 'Company A', status: 'active' }, membership: { isActive: true, role: 'admin_empresa' },
  } });
  const content = JSON.stringify(renderer.toJSON());
  assert.match(content, /COMPANY_FORM/);
  assert.match(content, /Company A/);
  assert.match(content, /admin@example.com/);
  await act(async () => renderer.unmount());
});

test('failed company lookup blocks the form instead of starting over', async () => {
  const { renderer } = await renderGate({ error: 'No se pudo consultar la empresa.' }, 503);
  const content = JSON.stringify(renderer.toJSON());
  assert.match(content, /No se pudo consultar la empresa/);
  assert.doesNotMatch(content, /COMPANY_FORM/);
  await act(async () => renderer.unmount());
});

test('signed-out session requires email and password before mounting company content', async () => {
  const { renderer } = await renderGate({}, 200, false);
  const content = JSON.stringify(renderer.toJSON());
  assert.match(content, /Entrar en CA46/);
  assert.doesNotMatch(content, /COMPANY_FORM/);
  assert.equal(renderer.root.findAllByType('input').length, 2);
  await act(async () => renderer.unmount());
});

test('company card lookup errors never offer to activate another company', async () => {
  const Card = componentAt('../components/TenantCompanyCard.tsx', {
    jsx, '@/lib/supabaseClient': { supabase: { auth: { getSession: async () => ({ data: { session } }) } } },
  }, { fetch: async () => Response.json({ error: 'No se pudo consultar la empresa.' }, { status: 503 }) });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Card, { companyName: 'Company A' })); });
  const content = JSON.stringify(renderer.toJSON());
  assert.match(content, /No se pudo cargar tu empresa/);
  assert.doesNotMatch(content, /Activar empresa CA46/);
  await act(async () => renderer.unmount());
});

test('SuperAdmin logout blocks new login until old account cleanup completes', async () => {
  let finishLogout;
  const Gate = componentAt('../components/SuperAdminGate.tsx', {
    jsx,
    '@/lib/supabaseClient': { supabase: { auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } } },
    '@/lib/logout': { logoutAndRedirect: () => new Promise(resolve => { finishLogout = resolve; }) },
  }, { fetch: async () => Response.json({ superAdmin: { userId: session.user.id, email: session.user.email } }) });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Gate, null, React.createElement('p', null, 'GLOBAL_DASHBOARD'))); });
  const logout = renderer.root.findAllByType('button').find(b => b.children.includes('Cerrar sesión'));
  assert.ok(logout);
  await act(async () => { void logout.props.onClick(); });
  assert.match(JSON.stringify(renderer.toJSON()), /Cerrando sesión/);
  assert.equal(renderer.root.findAllByType('input').length, 0);
  await act(async () => { finishLogout(); });
  await act(async () => renderer.unmount());
});
