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

function harness(mode, saved) {
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
  let complete;
  let deferred=new Promise(r=>{complete=r;});
  const Component=compiledModule(mode==='invoice'?'../components/InvoiceLabelCreator.tsx':'../components/PhysicalLabelCreator.tsx',{
    'next/image':{ __esModule:true,default:props=>React.createElement('img',{ alt:props.alt }) },
    'next/link':{ __esModule:true,default:props=>React.createElement('a',props) },
    '@/lib/tenant-company-config':auth,
    '@/lib/use-creator-draft':{ useCreatorDraft:hook },
    '@/lib/label-analysis-client':{
      ANALYSIS_MESSAGES: { preparing:'Preparando foto. Espera antes de salir…', uploading:'Enviando foto. Espera antes de salir…', server:'Foto recibida. CA46 sigue trabajando aunque salgas.', reconnecting:'Recuperando conexión. Tu trabajo sigue guardado.', recovering:'Comprobando trabajo guardado…' },
      analyzeSavedPhoto:async(id,kind,file,retry,scope,progress)=>{invocations.push({id,kind,file,retry,progress});return deferred;},
      discardAnalysisJobs:async()=>{},
    },
  }).default;
  const key=`company-A:user-A:${mode}`;
  if(saved)storage.set(key,saved);
  let renderer;
  return { storage,key,invocations,progress(stage){ invocations.at(-1).progress(stage); },scope(value){scope=value;},complete(value){complete(value);},
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
