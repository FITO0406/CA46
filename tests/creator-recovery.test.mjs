import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
const jsx = await import('react/jsx-runtime');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

function compiledModule(path, imports, globals = {}) {
  const module={ exports:{} };
  const compiled=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{ compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true } }).outputText;
  runInNewContext(compiled,{ module,exports:module.exports,console,crypto:{ randomUUID },File,AbortController,
    URL:{ createObjectURL:()=>`blob:${randomUUID()}`,revokeObjectURL(){} },
    window:{ scrollTo(){} },...globals,
    require:name=>{ if(name==='react')return React; if(name==='react/jsx-runtime')return jsx; assert.ok(imports[name],name); return imports[name]; },
  });
  return module.exports;
}

function harness(mode, saved, publishResponse) {
  const storage=new Map();
  let scope={ companyId:'company-A',userId:'user-A' };
  const auth={ tenantAuthorizationHeader:async()=>({ Authorization:'Bearer test-token' }) };
  const api=async url=>{ assert.equal(url,'/api/label-jobs'); return Response.json(scope); };
  const hook=compiledModule('../lib/use-creator-draft.ts',{
    '@/lib/tenant-company-config':auth,
    '@/lib/creator-draft-storage':{
      readCreatorDraft:async key=>storage.get(key)||null,
      writeCreatorDraft:async(key,value)=>{ storage.set(key,value); },
    },
  },{ fetch:api }).useCreatorDraft;
  const invocations=[];
  const waiters = new Map();
  const publications = [];
  const Shared=compiledModule('../components/InvoiceLabelCreator.tsx',{
    'next/image':{ __esModule:true,default:props=>React.createElement('img',{ alt:props.alt }) },
    'next/link':{ __esModule:true,default:props=>React.createElement('a',props) },
    '@/lib/tenant-company-config':auth,
    '@/lib/use-creator-draft':{ useCreatorDraft:hook },
    '@/lib/label-analysis-client':{
      ANALYSIS_MESSAGES: { preparing:'Preparando foto. Espera antes de salir…', uploading:'Enviando foto. Espera antes de salir…', server:'Foto recibida. CA46 sigue trabajando aunque salgas.', reconnecting:'Recuperando conexión. Tu trabajo sigue guardado.', recovering:'Comprobando trabajo guardado…' },
      analyzeSavedPhoto:async(id,kind,file,retry,scope,progress)=>{invocations.push({id,kind,file,retry,progress});return new Promise((resolve, reject) => waiters.set(id, { resolve, reject }));},
      discardAnalysisJobs:async()=>{},
    },
  }, { fetch: async (url, init) => { assert.equal(url, '/api/publish-labels'); publications.push(JSON.parse(init.body)); const labels = publications.at(-1).invoices.flatMap(i => i.labels).map(() => ({ id: randomUUID() })); return Response.json(publishResponse ?? { published: labels.length, labels, company_id: scope.companyId, expires_at: '2026-10-08T18:00:00Z' }); } }).default;
  const Component = mode === 'invoice' ? Shared : props => React.createElement(Shared, { ...props, sourceMode: 'physical_label' });
  const key=`company-A:user-A:${mode}`;
  if(saved)storage.set(key,saved);
  let renderer;
  return { storage,key,invocations,publications,finish(id, value){waiters.get(id).resolve(value);},fail(id){waiters.get(id).reject(new Error('Foto ilegible'));},progress(stage){ invocations.at(-1).progress(stage); },scope(value){scope=value;},complete(value){for (const waiter of waiters.values()) waiter.resolve(value);},
    async mount(){await act(async()=>{renderer=create(React.createElement(Component));});return renderer;},
    async unmount(){await act(async()=>renderer.unmount());},
    text(){return JSON.stringify(renderer.toJSON());},get renderer(){return renderer;},
  };
}
function label(overrides={}) {
  const keys=['description','scientific_name','lote','marca','kg_neto','metodo','presentacion','procedencia','fao','frescura','arte','ce','subzona','primer_expedidor','poblacion','fecha_captura','comprador','nif'];
  return { ...Object.fromEntries(keys.map(k=>[k,''])),description:'Merluza',lote:'A',procedencia:'Atlántico',extra_fields:[],confidence:1,needs_review:false,review_fields:[],...overrides };
}
const file=new File(['photo'],'factura.jpg',{type:'image/jpeg'});
function invoice(photoId,overrides={}) {return { photoId,fileName:'factura.jpg',invoice_number:'123',invoice_date:'',expedidor:'',cif_expedidor:'',registro_sanitario_expedidor:'',buyer:'',buyer_nif:'',buyer_number:'46',invoice_extra_fields:[],warnings:[],labels:[label()],...overrides };}

// Real React components + real persistence hook: exercise restoration rather
// than asserting source strings or mirroring the implementation.
test('invoice restores photos and corrected labels without rerunning completed OCR',async()=>{
  const id=randomUUID();
  const h=harness('invoice',{ photos:[{id,file}],photoStates:{[id]:{state:'done'}},results:[invoice(id,{labels:[label({lote:'LOTE-CORREGIDO'})]})],analysisErrors:[],analyzing:false,publishedCount:null,publishedExpiresAt:'' });
  await h.mount();
  assert.match(h.text(),/LOTE-CORREGIDO/); assert.match(h.text(),/1 factura seleccionada/);
  assert.equal(h.invocations.length,0);
  const field=h.renderer.root.findAllByType('input').find(i=>i.props.value==='LOTE-CORREGIDO');
  await act(async()=>field.props.onChange({target:{value:'NUEVO-LOTE'}}));
  await h.unmount(); await h.mount();
  assert.match(h.text(),/NUEVO-LOTE/); assert.equal(h.invocations.length,0);
  await h.unmount();
});

test('returning during batch resumes only unfinished photo and keeps manual corrections',async()=>{
  const a=randomUUID(),b=randomUUID();
  const h=harness('invoice',{ photos:[{id:a,file},{id:b,file}],photoStates:{[a]:{state:'done'},[b]:{state:'analyzing'}},results:[invoice(a,{labels:[label({lote:'MANUAL'})]})],analysisErrors:[],analyzing:true,publishedCount:null,publishedExpiresAt:'' });
  await h.mount();
  assert.equal(h.invocations.length,1);assert.equal(h.invocations[0].id,b);assert.equal(h.invocations[0].retry,false);
  await act(async()=>h.complete({analysis:invoice(b)}));
  assert.match(h.text(),/MANUAL/);assert.ok(h.renderer.root.findAllByType('h2').some(node=>node.children.join('')==='2 etiquetas generadas'));
  assert.equal(h.storage.get(h.key).analyzing,false);
  await h.unmount();await h.mount();assert.equal(h.invocations.length,1);await h.unmount();
});

test('newly selected invoice survives leaving the page before analysis starts',async()=>{
  const h=harness('invoice');await h.mount();
  const picker=h.renderer.root.findAllByType('input').find(i=>i.props.multiple);
  await act(async()=>picker.props.onChange({target:{files:[file]},currentTarget:{value:'selected'}}));
  await h.unmount();await h.mount();
  assert.match(h.text(),/1 factura seleccionada/);assert.equal(h.invocations.length,0);
  assert.equal(h.storage.get(h.key).photos[0].file,file);await h.unmount();
});

test('physical label resumes accepted OCR and retains corrected fields on another reload',async()=>{
  const id=randomUUID();
  const h=harness('physical_label',{file,jobId:id,label:label({description:'',lote:'',procedencia:''}),warnings:[],analyzing:true,error:'',publishedExpiresAt:''});
  await h.mount();assert.equal(h.invocations[0].kind,'physical_label');assert.equal(h.invocations[0].id,id);
  await act(async()=>h.complete({analysis:{labels:[label()],warnings:[]}}));
  const field=h.renderer.root.findAllByType('input').find(i=>i.props.value==='A');
  await act(async()=>field.props.onChange({target:{value:'CAJA-CORREGIDA'}}));
  await h.unmount();await h.mount();assert.match(h.text(),/CAJA-CORREGIDA/);assert.equal(h.invocations.length,1);await h.unmount();
});

test('switching account does not expose another company draft',async()=>{
  const id=randomUUID();
  const h=harness('invoice',{photos:[{id,file}],photoStates:{},results:[invoice(id,{labels:[label({lote:'PRIVADO-EMPRESA-A'})]})],analysisErrors:[],analyzing:false,publishedCount:null,publishedExpiresAt:''});
  await h.mount();assert.match(h.text(),/PRIVADO-EMPRESA-A/);await h.unmount();
  h.scope({companyId:'company-B',userId:'user-B'});await h.mount();
  assert.doesNotMatch(h.text(),/PRIVADO-EMPRESA-A/);assert.match(h.text(),/Añade facturas para empezar/);await h.unmount();
});


test('a transport error after upload recovers the cached result automatically on return',async()=>{
  const id=randomUUID();
  const h=harness('invoice',{photos:[{id,file}],photoStates:{[id]:{state:'error',message:'Failed to fetch'}},results:[],analysisErrors:['Failed to fetch'],analyzing:false,publishedCount:null,publishedExpiresAt:''});
  await h.mount();assert.equal(h.invocations.length,1);assert.equal(h.invocations[0].retry,false);
  await act(async()=>h.complete({analysis:invoice(id)}));assert.match(h.text(),/Merluza/);await h.unmount();
});


test('invoice distinguishes pending upload from server acceptance in the visible UI',async()=>{
  const id=randomUUID();
  const h=harness('invoice',{photos:[{id,file}],photoStates:{[id]:{state:'pending'}},results:[],analysisErrors:[],analyzing:true,publishedCount:null,publishedExpiresAt:''});
  await h.mount();
  await act(async()=>h.progress('uploading'));assert.match(h.text(),/Enviando foto. Espera antes de salir/);
  await act(async()=>h.progress('server'));assert.match(h.text(),/Foto recibida. CA46 sigue trabajando aunque salgas/);
  await act(async()=>h.complete({analysis:invoice(id)}));
  assert.match(h.text(),/Merluza/);assert.doesNotMatch(h.text(),/Enviando foto/);await h.unmount();
});

test('physical label displays upload and background-processing status',async()=>{
  const id=randomUUID();
  const h=harness('physical_label',{file,jobId:id,label:label({description:'',lote:'',procedencia:''}),warnings:[],analyzing:true,error:'',publishedExpiresAt:''});
  await h.mount();
  await act(async()=>h.progress('preparing'));assert.match(h.text(),/Preparando foto. Espera antes de salir/);
  await act(async()=>h.progress('server'));assert.match(h.text(),/Foto recibida. CA46 sigue trabajando aunque salgas/);
  await act(async()=>h.complete({analysis:{labels:[label()],warnings:[]}}));
  assert.match(h.text(),/Merluza/);assert.doesNotMatch(h.text(),/Foto recibida. CA46 sigue trabajando/);await h.unmount();
});


test('24-hour gallery appends several photos, preserves edits and publishes all in physical mode', async () => {
  const h = harness('physical_label'); await h.mount();
  const picker = () => h.renderer.root.findAllByType('input').find(i => i.props.multiple);
  const second = new File(['second'], 'caja2.jpg', { type: 'image/jpeg' });
  await act(async () => picker().props.onChange({ target: { files: [file, second] }, currentTarget: { value: 'selected' } }));
  assert.match(h.text(), /2 fotos seleccionadas/);
  const analyze = () => h.renderer.root.findAllByType('button').find(b => b.children.join('').startsWith('Analizar y separar'));
  await act(async () => { void analyze().props.onClick(); });
  assert.equal(h.invocations.length, 2);
  assert.ok(h.invocations.every(call => call.kind === 'physical_label'));
  await act(async () => h.finish(h.invocations[0].id, { analysis: { labels: [label({ lote: 'LOTE-1' })] } }));
  await act(async () => h.fail(h.invocations[1].id));
  let publish = h.renderer.root.findAllByType('button').find(b => b.children.join('').startsWith('Publicar '));
  assert.equal(publish.props.disabled, true);
  const input = h.renderer.root.findAllByType('input').find(i => i.props.value === 'LOTE-1');
  await act(async () => input.props.onChange({ target: { value: 'LOTE-MANUAL' } }));
  await act(async () => { void analyze().props.onClick(); });
  assert.equal(h.invocations.length, 3); // Only retry the failed photo.
  await act(async () => h.finish(h.invocations[2].id, { analysis: { labels: [label({ lote: 'LOTE-2' })] } }));
  const third = new File(['third'], 'caja3.jpg', { type: 'image/jpeg' });
  await act(async () => picker().props.onChange({ target: { files: [third] }, currentTarget: { value: 'selected' } }));
  assert.match(h.text(), /LOTE-MANUAL/);
  await h.unmount(); await h.mount();
  assert.match(h.text(), /3 fotos seleccionadas/); assert.match(h.text(), /LOTE-MANUAL/);
  assert.equal(h.invocations.length, 3); // New photo has not been submitted yet.
  await act(async () => { void analyze().props.onClick(); });
  await act(async () => h.finish(h.invocations[3].id, { analysis: { labels: [label({ lote: 'LOTE-3' })] } }));
  publish = h.renderer.root.findAllByType('button').find(b => b.children.join('').startsWith('Publicar '));
  assert.equal(publish.props.disabled, false);
  await act(async () => publish.props.onClick());
  assert.equal(h.publications.length, 1);
  assert.equal(h.publications[0].sourceMode, 'physical_label');
  assert.deepEqual(h.publications[0].invoices.map(i => i.labels[0].lote), ['LOTE-MANUAL', 'LOTE-2', 'LOTE-3']);
  assert.match(h.text(), /3.*etiquetas publicadas/);
  assert.match(h.text(), /Vigencia de.*24/);
  assert.doesNotMatch(h.text(), /factura pendiente/i);
  await h.unmount();
});

test('24-hour batch resumes only unfinished jobs without overwriting completed manual review', async () => {
  const a = randomUUID(), b = randomUUID();
  const h = harness('physical_label', { photos: [{ id: a, file }, { id: b, file }], photoStates: { [a]: { state: 'done' }, [b]: { state: 'analyzing' } }, results: [invoice(a, { labels: [label({ lote: 'MANUAL-CAJA' })] })], analysisErrors: [], analyzing: true, publishedCount: null, publishedExpiresAt: '' });
  await h.mount();
  assert.equal(h.invocations.length, 1); assert.equal(h.invocations[0].id, b); assert.equal(h.invocations[0].retry, false);
  await act(async () => h.complete({ analysis: { labels: [label()] } }));
  assert.match(h.text(), /MANUAL-CAJA/);
  await h.unmount(); await h.mount(); assert.equal(h.invocations.length, 1);
  await h.unmount();
});


test('stale publication banner cannot hide a pending 24h batch or trigger publication', async () => {
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const h = harness('physical_label', { photos: ids.map(id => ({ id, file })), photoStates: {}, results: [], analysisErrors: [], analyzing: false, publishedCount: 3, publishedExpiresAt: '2026-10-01T00:00:00Z' });
  await h.mount();
  assert.match(h.text(), /5 fotos seleccionadas/);
  assert.doesNotMatch(h.text(), /Publicación completada/);
  assert.equal(h.publications.length, 0); assert.equal(h.invocations.length, 0);
  assert.equal(h.storage.get(h.key).publishedExpiresAt, '');
  const picker = h.renderer.root.findAllByType('input').find(i => i.props.multiple);
  await act(async () => picker.props.onChange({ target: { files: [file, file] }, currentTarget: { value: '' } }));
  await h.unmount(); await h.mount();
  assert.match(h.text(), /7 fotos seleccionadas/);
  assert.equal(h.invocations.length, 0);
  await act(async () => { void h.renderer.root.findAllByType('button').find(b => b.children.join('').startsWith('Analizar y separar')).props.onClick(); });
  assert.equal(h.invocations.length, 3);
  for (let i = 0; i < 7; i++) {
    await act(async () => h.finish(h.invocations[i].id, { analysis: { labels: [label({ lote: `BATCH-${i}` })] } }));
  }
  assert.equal(h.invocations.length, 7); assert.equal(h.publications.length, 0);
  const publish = h.renderer.root.findAllByType('button').find(b => b.children.join('').startsWith('Publicar '));
  assert.equal(publish.props.disabled, false);
  await act(async () => publish.props.onClick());
  assert.equal(h.publications[0].invoices.length, 7);
  assert.match(h.text(), /7.*etiquetas publicadas/);
  assert.equal(h.storage.get(h.key).photos.length, 0);
  await h.unmount(); await h.mount();
  assert.doesNotMatch(h.text(), /Publicación completada/);
  await h.unmount();
});

test('legacy expiry never discards an unpublished photo or its manual edits', async () => {
  const h = harness('physical_label', { file, jobId: randomUUID(), label: label({ lote: 'CONSERVAR' }), warnings: [], analyzing: false, error: '', publishedExpiresAt: '2026-10-01T00:00:00Z' });
  await h.mount(); assert.match(h.text(), /CONSERVAR/);
  assert.match(h.text(), /1 foto seleccionada/);
  assert.doesNotMatch(h.text(), /Publicación completada/);
  assert.equal(h.publications.length, 0); await h.unmount();
});

test('incomplete publication acknowledgement preserves review and shows no success', async () => {
  const id = randomUUID();
  const h = harness('physical_label', { photos: [{ id, file }], photoStates: { [id]: { state: 'done' } }, results: [invoice(id)], analysisErrors: [], analyzing: false, publishedCount: null, publishedExpiresAt: '' }, { published: 1 });
  await h.mount();
  await act(async () => h.renderer.root.findAllByType('button').find(b => b.children.join('').startsWith('Publicar ')).props.onClick());
  assert.match(h.text(), /No se ha recibido una confirmación completa/);
  assert.doesNotMatch(h.text(), /Publicación completada/);
  assert.equal(h.storage.get(h.key).photos.length, 1); await h.unmount();
});
