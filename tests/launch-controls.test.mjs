import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
function moduleAt(path, imports = {}, env = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, { module: loaded, exports: loaded.exports, URL, Buffer, Date, process: { env },
    require: name => { assert.ok(imports[name], name); return imports[name]; } });
  return loaded.exports;
}
const requests = moduleAt('../lib/service-requests.ts');
test('rights calendar month handles end of month and leap year', () => {
  assert.equal(requests.rightsDueAt(new Date('2028-01-31T10:00:00Z')), '2028-02-29T10:00:00.000Z');
  assert.equal(requests.rightsDueAt(new Date('2027-01-31T10:00:00Z')), '2027-02-28T10:00:00.000Z');
  assert.equal(requests.rightsDueAt(new Date('2026-12-15T10:00:00Z')), '2027-01-15T10:00:00.000Z');
});
test('employee may exercise personal rights but cannot terminate or restore company', () => {
  for (const kind of ['soporte','derechos']) assert.ok(requests.validateServiceRequest({ kind, message: 'Solicitud suficientemente larga' }, false));
  for (const kind of ['baja','restauracion','exportacion']) assert.equal(requests.validateServiceRequest({ kind, message: 'Solicitud suficientemente larga' }, false), null);
  assert.equal(requests.validateServiceRequest({ kind:'soporte', message:'x'.repeat(4001) },true),null);
  assert.equal(requests.validateServiceRequest({ kind:'inventado', message:'Solicitud suficientemente larga' },true),null);
});
test('courtesy honors start and expiry, including invalid dates', () => {
  const { accessOverrideIsEffective: effective } = moduleAt('../lib/company-access-server.ts', { '@/lib/supabase': {} });
  const now = Date.parse('2026-10-17T12:00:00Z');
  assert.equal(effective({ is_active:true, starts_at:'2026-10-18' },now),false);
  assert.equal(effective({ is_active:true, starts_at:'invalid' },now),false);
  assert.equal(effective({ is_active:true, starts_at:'2026-10-01',ends_at:'2026-10-17T12:00:00Z' },now),false);
  assert.equal(effective({ is_active:true, starts_at:'2026-10-01',ends_at:null },now),true);
  assert.equal(effective({ is_active:false },now),false);
});
test('service auth ignores forged company/role and remains independent of commercial status', async () => {
  const filters=[];
  const auth=moduleAt('../lib/service-auth-server.ts',{'@/lib/supabase':{supabaseAdmin:{
    auth:{getUser:async()=>({data:{user:{id:'real-user',email:'real@example.test',email_confirmed_at:'2026-10-01',user_metadata:{company_id:'victim',role:'admin_empresa'}}}})},
    from:table=>({select(){assert.equal(table,'company_members');return this;},eq(key,value){filters.push([key,value]);return this;},limit:async()=>({data:[{company_id:'own-company',role:'empleado',is_active:true}]})}),
  }}});
  assert.equal(await auth.serviceContext(new Request('https://test')),null);
  const ctx=await auth.serviceContext(new Request('https://test?companyId=victim',{headers:{Authorization:'Bearer valid'}}));
  assert.equal(ctx.companyId,'own-company'); assert.equal(ctx.isAdmin,false);
  assert.deepEqual(filters,[['user_id','real-user']]);
});
test('export binds every page to server company and excludes secret columns',async()=>{
  const calls=[];
  const exporter=moduleAt('../lib/company-export-server.ts',{'@/lib/supabase':{supabaseAdmin:{from(table){
    const call={table};calls.push(call);
    return {select(fields){call.fields=fields;return this;},eq(key,value){call.scope=[key,value];return this;},order(){return this;},async range(start,end){call.ranges??=[];call.ranges.push([start,end]);return {data:table==='digital_tags' ? (start===0 ? Array.from({length:500},(_,i)=>({id:String(i)})) : [{id:'500'}]) : []};}};
  }}}});
  const data=await exporter.exportCompany('own-company');
  assert.equal(data.tables.digital_tags.length,501);
  assert.ok(calls.every(c=>c.scope[1]==='own-company'));
  assert.ok(calls.every(c=>!c.fields.includes('*')&&!/token|encrypted|external_customer/i.test(c.fields)));
  assert.ok(!calls.some(c=>c.table==='company_drive_credentials'));
  assert.deepEqual(calls.find(c=>c.table==='digital_tags').ranges,[[0,499]]);
  assert.equal(calls.filter(c=>c.table==='digital_tags').length,2);
});
test('oversized export fails rather than returning a partial successful document',async()=>{
  const exporter=moduleAt('../lib/company-export-server.ts',{'@/lib/supabase':{supabaseAdmin:{from:()=>({select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:[{id:'x',payload:'x'.repeat(15_000_001)}]})})}}});
  await assert.rejects(()=>exporter.exportCompany('own-company'),error=>error instanceof exporter.ExportTooLarge);
});
test('legal readiness requires identity, retention, transfers and explicit approval',()=>{
  assert.equal(moduleAt('../lib/legal-documents.ts').legalProfile().ready,false);
  const env={CA46_LEGAL_NAME:'Proveedor de prueba',CA46_LEGAL_TAX_ID:'TEST',CA46_LEGAL_ADDRESS:'Dirección ficticia',CA46_CONTACT_EMAIL:'test@example.test',CA46_RETENTION_POLICY:'Política ficticia',CA46_TRANSFER_SAFEGUARDS:'Garantías ficticias',CA46_LEGAL_APPROVED:'true'};
  assert.equal(moduleAt('../lib/legal-documents.ts',{},env).legalProfile().ready,true);
  delete env.CA46_RETENTION_POLICY;
  assert.equal(moduleAt('../lib/legal-documents.ts',{},env).legalProfile().ready,false);
});
async function acceptance(body,overrides={}) {
  const writes=[];
  const ctx={userId:'user-A',companyId:'company-A',isAdmin:true,confirmed:true,email:'admin@example.test',...overrides.ctx};
  const current={version:'v1',checksum:'a'.repeat(64),snapshot:JSON.stringify({version:'v1',documents:['server text']}),ready:overrides.ready??true};
  const route=moduleAt('../app/api/legal/acceptance/route.ts',{
    'next/server':{NextResponse:{json:(b,i)=>Response.json(b,i)}},
    '@/lib/service-auth-server':{serviceContext:async()=>ctx},
    '@/lib/legal-contract-server':{contractSnapshot:()=>current,partyChecksum:()=> 'b'.repeat(64),companyContractParty:async()=>overrides.noParty ? null : {legal_name:'Empresa A',tax_id:'TEST',address:'Dirección ficticia'}},
    '@/lib/supabase':{supabaseAdmin:{from:()=>({insert:async row=>{writes.push(row);return {};}})}},
  });
  const response=await route.POST(new Request('https://test',{method:'POST',body:JSON.stringify(body)}));
  return {status:response.status,writes};
}
const accepted={version:'v1',checksum:'a'.repeat(64),terms:true,processing:true,representative:true,companyId:'victim',document_snapshot:'forged'};
test('contract requires approved text, current checksum and authorized representative',async()=>{
  assert.equal((await acceptance(accepted,{ready:false})).status,503);
  assert.equal((await acceptance({...accepted,checksum:'stale'})).status,409);
  assert.equal((await acceptance({...accepted,representative:false})).status,400);
  assert.equal((await acceptance(accepted,{ctx:{isAdmin:false}})).status,403);
  assert.equal((await acceptance(accepted,{ctx:{confirmed:false}})).status,403);
  assert.equal((await acceptance(accepted,{noParty:true})).status,409);
  const result=await acceptance(accepted);
  assert.equal(result.status,200);assert.equal(result.writes[0].company_id,'company-A');
  assert.equal(result.writes[0].document_snapshot.documents[0],'server text');
});
test('document checksum changes when approved identity/text changes',()=>{
  const make=name=>moduleAt('../lib/legal-contract-server.ts',{'node:crypto':crypto,'@/lib/supabase':{},'@/lib/legal-documents':{LEGAL_VERSION:'v1',legalProfile:()=>({ready:true}),legalDocuments:()=>[{title:name}]}}).contractSnapshot();
  assert.notEqual(make('First').checksum,make('Second').checksum);
});
test('mandatory contract blocks operations while keeping company identity editing possible',async()=>{
  const imports={
    '@/lib/employee-access':{employeeOperationAllowed:()=>true},
    '@/lib/legal-contract-server':{companyContractAccepted:async()=>false},
    '@/lib/supabase':{supabaseAdmin:{auth:{getUser:async()=>({data:{user:{id:'A'}}})},from:table=>({
      select(){return this;},eq(){return this;},limit(){return this;},maybeSingle:async()=>({data:{company_id:'company-A',role:'admin_empresa',is_active:true}}),single:async()=>{assert.equal(table,'companies');return {data:{id:'company-A',status:'active'}};},
    })}},
  };
  const guard=moduleAt('../lib/tenant-auth-server.ts',imports,{CA46_REQUIRE_LEGAL_ACCEPTANCE:'true'});
  const req=path=>new Request('https://test'+path,{headers:{Authorization:'Bearer valid'}});
  assert.equal((await guard.tenantContextForRequest(req('/api/kitchen'))).status,428);
  assert.equal((await guard.tenantContextForRequest(req('/api/tenant/settings'))).ok,true);
});
test('new tenant ignores paid-plan metadata and browser payload',async()=>{
  let inserted;
  const route=moduleAt('../app/api/tenant/me/route.ts',{
    'next/server':{NextResponse:{json:(b,i)=>Response.json(b,i)}},
    '@/lib/company-access-server':{resolveCompanyEffectiveAccess:async()=>({plan:'gratis',features:{}})},
    '@/lib/supabase':{supabaseAdmin:{auth:{getUser:async()=>({data:{user:{id:'user-A',user_metadata:{company_name:'Test',plan:'empresa'}}}})},from:table=>({
      select(){return this;},eq(){return this;},limit(){return this;},maybeSingle:async()=>({data:null}),
      insert(row){assert.equal(table,'companies');inserted=row;return this;},
      single:async()=>({data:{id:'company-A',plan:inserted.plan,status:'active'}}),upsert:async()=>({}),
    })}},
  });
  const response=await route.POST(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer token'},body:JSON.stringify({companyName:'Test',plan:'personalizado'})}));
  assert.equal(response.status,200);assert.equal(inserted.plan,'gratis');assert.equal(inserted.owner_user_id,'user-A');
});
test('pilot checkout does not call Stripe even if configuration exists',async()=>{
  const route=moduleAt('../app/api/billing/checkout/route.ts',{
    'next/server':{NextResponse:{json:(b,i)=>Response.json(b,i)}},
    '@/lib/supabase':{},'@/lib/company-access-server':{},'@/lib/stripe-server':{},
    '@/lib/billing-auth-server':{billingAdminContextForRequest:async()=>({ok:true,context:{companyId:'A'}})},
  });
  const response=await route.POST(new Request('https://test',{method:'POST'}));
  assert.equal(response.status,503);assert.equal((await response.json()).code,'BILLING_DISABLED');
});
test('public display removes buyer, invoice identifiers, file IDs and unapproved extras while retaining safety fields',()=>{
  const trace=moduleAt('../lib/traceability.ts');
  const screen=moduleAt('../lib/public-screen-tag.ts',{'@/lib/traceability':trace});
  const category='TRACE_V1:'+JSON.stringify({description:'Merluza',lot:'L-46',buyer:'PRIVATE BUYER',buyerNumber:'PRIVATE NIF',invoiceNumber:'PRIVATE INVOICE',shipperTaxId:'PRIVATE SHIPPER',origin:'Atlántico',extraFields:[{label:'Fecha límite de consumo',value:'2026-10-20'},{label:'Ingredientes / aditivos',value:'Sal'},{label:'Email comprador',value:'PRIVATE EMAIL'},{label:'Conservación',value:'Frío',unexpected:'PRIVATE NESTED'}]});
  const projected=screen.publicScreenTag({id:'tag',product_name:'Merluza',category,drive_file_id:'PRIVATE FILE',token:'PRIVATE TOKEN',company_id:'PRIVATE COMPANY'});
  assert.ok(!JSON.stringify(projected).includes('PRIVATE'));
  const safe=trace.decodeTraceability(projected.category);
  assert.equal(safe.lot,'L-46');assert.equal(safe.origin,'Atlántico');assert.equal(safe.extraFields.length,3);
  for(const category of ['TRACE_V1:garbage','TRACE_V1:null','TRACE_V1:[]','General']) assert.equal(screen.publicScreenTag({category}).category,'');
});
