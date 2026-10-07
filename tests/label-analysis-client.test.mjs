import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function harness(fetch) {
  const module = { exports: {} }, stages = [], waits = [];
  const window = new EventTarget(), document = new EventTarget();
  document.visibilityState = 'visible';
  const navigator = { onLine: true };
  let timerId = 0;
  const timers = new Map();
  const source = ts.transpileModule(readFileSync(new URL('../lib/label-analysis-client.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, File, FormData, AbortSignal, Error, window, document, navigator,
    fetch, setTimeout(cb,delay) { const id=++timerId; waits.push(delay); timers.set(id,cb); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) { assert.equal(name,'@/lib/tenant-company-config'); return { tenantAuthorizationHeader:async()=>({ Authorization:'Bearer synthetic-token' }) }; },
  });
  return { stages, waits, timers, window, document, navigator,
    run(file = new File(['photo'],'photo.jpg'), retry = false, signal) {
      return module.exports.analyzeSavedPhoto('photo-id','invoice',file,retry,{ companyId:'A',userId:'U' },stage=>stages.push(stage),signal);
    },
    async tick() { await new Promise(r=>setImmediate(r)); },
    wake() { window.dispatchEvent(new Event('online')); },
  };
}
const result={ analysis:{ labels:[{description:'Merluza',lote:'A',procedencia:'Atlántico'}] } };
const job=(status='done')=>({id:'photo-id',status,result:status==='done'?result:null,error:status==='error'?'comprador incorrecto':null});

test('recovering an accepted result never compresses or uploads the photo',async()=>{
  let calls=0,compressions=0;
  const h=harness(async(url,options)=>{ calls++;assert.match(url,/id=photo-id/);assert.equal(options.method,'GET');assert.equal(options.headers['X-CA46-Company'],'A');return Response.json({job:job()}); });
  assert.deepEqual(await h.run(async()=>{compressions++;throw Error('should not compress');}),result);
  assert.equal(calls,1);assert.equal(compressions,0);
});

test('lost upload acknowledgement recovers without a second upload',async()=>{
  let received=false,uploads=0,compressions=0;
  const h=harness(async(url,options)=>{
    if(options.method==='POST'){ uploads++;received=true;assert.equal(options.body.get('image').name,'photo.jpg');throw new TypeError('Failed to fetch'); }
    return Response.json({job:received?job():null});
  });
  const running=h.run(async()=>{compressions++;return new File(['photo'],'photo.jpg');});
  await h.tick();assert.equal(h.stages.at(-1),'reconnecting');h.wake();
  assert.deepEqual(await running,result);assert.equal(uploads,1);assert.equal(compressions,1);assert.equal(h.timers.size,0);
});

test('a connection cut on the same page recovers automatically on return',async()=>{
  let reads=0,uploads=0;
  const h=harness(async(url,options)=>{
    if(options.method==='POST'){ uploads++;return Response.json({job:job('queued')}); }
    reads++;
    if(reads===1)return Response.json({job:null});
    if(reads===2)throw new TypeError('network disconnected');
    return Response.json({job:job()});
  });
  const running=h.run();await h.tick();assert.equal(h.stages.at(-1),'server');
  h.wake();await h.tick();assert.equal(h.stages.at(-1),'reconnecting');
  h.document.visibilityState='visible';h.document.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(await running,result);assert.equal(uploads,1);assert.equal(h.timers.size,0);
});

test('hidden/offline time does not exhaust transport retries',async()=>{
  let recovered=false,reads=0;
  const h=harness(async()=>{reads++;if(!recovered)throw new TypeError('offline');return Response.json({job:job()});});
  h.document.visibilityState='hidden';h.navigator.onLine=false;
  const running=h.run();
  for(let i=0;i<12;i++){await h.tick();h.wake();}
  await h.tick();assert.ok(reads>8);
  recovered=true;h.document.visibilityState='visible';h.navigator.onLine=true;h.wake();
  assert.deepEqual(await running,result);
});

test('an account mismatch is terminal and never retries or uploads',async()=>{
  let calls=0;
  const h=harness(async()=>{calls++;return Response.json({error:'La cuenta ha cambiado.'},{status:409});});
  await assert.rejects(h.run(),/cuenta ha cambiado/);assert.equal(calls,1);assert.equal(h.timers.size,0);
});

test('validation rejection is not automatically retried on restoration',async()=>{
  const h=harness(async(url,options)=>{assert.equal(options.method,'GET');return Response.json({job:job('error')});});
  await assert.rejects(h.run(),/comprador incorrecto/);assert.equal(h.timers.size,0);
});

test('leaving the page stops client polling without cancelling the server job',async()=>{
  let calls=0;
  const h=harness(async(url,options)=>{calls++;assert.equal(options.method,'GET');return Response.json({job:job('running')});});
  const controller=new AbortController();
  const running=h.run(undefined,false,controller.signal);
  const rejection=assert.rejects(running,{name:'AbortError'});
  await h.tick();assert.equal(h.stages.at(-1),'server');controller.abort();await rejection;
  assert.equal(calls,1);assert.equal(h.timers.size,0);
});
