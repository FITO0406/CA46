import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
test('launch migration enforces receipts, queue permissions and free signup in isolated Postgres',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create table public.companies(id uuid primary key default gen_random_uuid(),name text,slug text,plan text,status text,owner_user_id uuid);
      create table public.company_members(company_id uuid,user_id uuid,role text,is_active boolean);
      create table public.super_admins(user_id uuid,is_active boolean);
      create function public.ca46_slugify(text) returns text language sql as 'select lower($1)';
      grant update on public.companies to authenticated;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261017184533_launch_legal_and_service_requests.sql',import.meta.url),'utf8'));
    await db.exec(`create trigger new_user after insert on auth.users for each row execute function public.ca46_handle_new_user();
      insert into auth.users values ('11111111-1111-1111-1111-111111111111','test@example.test','{"signup_source":"ca46_public","company_name":"Test","plan":"empresa"}');`);
    assert.equal((await db.query('select plan from companies')).rows[0].plan,'gratis');
    const {rows:[rights]}=await db.query(`select has_table_privilege('authenticated','companies','update') plan_update,
      has_table_privilege('authenticated','legal_acceptances','select') client_read,
      has_table_privilege('service_role','legal_acceptances','update') receipt_update,
      has_function_privilege('anon','ca46_create_service_request(uuid,uuid,text,text,text,timestamptz)','execute') anon_rpc`);
    assert.deepEqual(rights,{plan_update:false,client_read:false,receipt_update:false,anon_rpc:false});
    const company=(await db.query('select id from companies')).rows[0].id;
    const user='11111111-1111-1111-1111-111111111111';
    const acceptance=[company,user,'test@example.test','v1','a'.repeat(64),'b'.repeat(64),'{}','{}'];
    await db.query('insert into legal_acceptances(company_id,user_id,representative_email,version,checksum,party_checksum,document_snapshot,company_snapshot) values($1,$2,$3,$4,$5,$6,$7,$8)',acceptance);
    await assert.rejects(()=>db.query('insert into legal_acceptances(company_id,user_id,representative_email,version,checksum,party_checksum,document_snapshot,company_snapshot) values($1,$2,$3,$4,$5,$6,$7,$8)',acceptance),/duplicate/);
    let receipt;
    for(let i=0;i<5;i++) receipt=(await db.query('select ca46_create_service_request($1,$2,$3,$4,$5,$6) receipt',[user,company,'test@example.test','baja','Solicitud de prueba',null])).rows[0].receipt;
    await assert.rejects(()=>db.query('select ca46_create_service_request($1,$2,$3,$4,$5,$6)',[user,company,'test@example.test','baja','Solicitud de prueba',null]),/REQUEST_RATE_LIMIT/);
    assert.equal((await db.query('select count(*)::int count from companies')).rows[0].count,1);
    await assert.rejects(()=>db.query('select ca46_update_service_request($1,$2,$3,$4)',[user,receipt.id,'resuelta','Tramitación ficticia de prueba']),/insufficient|privilege/i);
    await db.query('insert into super_admins values($1,true)',[user]);
    await db.query('select ca46_update_service_request($1,$2,$3,$4)',[user,receipt.id,'resuelta','Tramitación ficticia de prueba']);
    assert.equal((await db.query('select count(*)::int count from service_request_events')).rows[0].count,1);
    assert.equal((await db.query('select status from company_service_requests where id=$1',[receipt.id])).rows[0].status,'resuelta');
  } finally { await db.close(); }
});
