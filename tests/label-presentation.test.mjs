import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
const jsx = await import('react/jsx-runtime');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const trace = { description: 'Merluza', lot: 'L-1', origin: 'Atlántico', extraFields: [], consumerNotice: 'Etiqueta provisional · factura pendiente · Consumir preferentemente en 3 días' };
const module = { exports: {} };
const compiled = ts.transpileModule(readFileSync(new URL('../components/TagCard.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
runInNewContext(compiled, { module, exports: module.exports, Date, window: { setInterval, clearInterval }, require: name => {
  if (name === 'react') return React;
  if (name === 'react/jsx-runtime') return jsx;
  if (name === '@/lib/traceability') return { decodeTraceability: () => trace };
  throw new Error(name);
} });
const TagCard = module.exports.default;

test('24 and 72 hour labels share visual styling and preserve food notices with discreet source and duration', async () => {
  const common = { id: 'label', product_name: 'Merluza', origin: 'Atlántico', category: 'test', is_active: true, expires_at: '2026-10-08T18:00:00Z' };
  let physical, invoice;
  await act(async () => {
    physical = create(React.createElement(TagCard, { tag: { ...common, source: 'physical_label', status: 'provisional' } }));
    invoice = create(React.createElement(TagCard, { tag: { ...common, source: 'invoice', status: 'definitive' } }));
  });
  assert.equal(physical.root.findByType('article').props.className, invoice.root.findByType('article').props.className);
  const text = JSON.stringify(physical.toJSON());
  assert.doesNotMatch(text, /factura pendiente|etiqueta provisional|TEMPORAL/i);
  assert.match(text, /Consumir preferentemente en 3 días/);
  assert.match(text, /Etiqueta de caja · 24 h/);
  assert.match(text, /Hasta/);
  assert.match(JSON.stringify(invoice.toJSON()), /Factura · 72 h/);
  await act(async () => { physical.unmount(); invoice.unmount(); });
});
