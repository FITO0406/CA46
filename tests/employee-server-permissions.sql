-- Run as the database owner. All temporary test records are rolled back.
begin;
do $$
declare emp uuid := gen_random_uuid(); company uuid; admin uuid;
begin
  select m.company_id,m.user_id into company,admin
    from public.company_members m join public.companies c on c.id=m.company_id
    where m.role='admin_empresa' and m.is_active and c.status in ('active','trial') limit 1;
  if company is null then raise exception 'No active administrator for regression test'; end if;
  insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at)
    values(emp,emp::text||'@employee-permission-test.invalid','{}',now());
  perform set_config('ca46.test_employee',emp::text,true);
  perform set_config('ca46.test_company',company::text,true);
  perform set_config('ca46.test_admin',admin::text,true);
  perform set_config('request.jwt.claim.sub',emp::text,true);
end $$;
set local role service_role;
do $$
declare emp uuid := current_setting('ca46.test_employee')::uuid;
company uuid := current_setting('ca46.test_company')::uuid;
admin uuid := current_setting('ca46.test_admin')::uuid;
begin
  if not exists(select 1 from public.ca46_employee_identity(emp::text||'@employee-permission-test.invalid') where user_id=emp) then
    raise exception 'Server identity lookup failed'; end if;
  perform public.ca46_bind_employee(admin,company,emp);
  if not exists(select 1 from public.ca46_company_member_list(company) where user_id=emp and member_role='empleado') then
    raise exception 'Server company member listing failed'; end if;
  if not public.ca46_set_employee_active(admin,company,emp,false) then raise exception 'Server deactivation failed'; end if;
  if not public.ca46_set_employee_active(admin,company,emp,true) then raise exception 'Server activation failed'; end if;
  if has_column_privilege('service_role','auth.users','encrypted_password','SELECT') then
    raise exception 'Password column unnecessarily granted'; end if;
  if has_function_privilege('anon','public.ca46_employee_identity(text)','EXECUTE')
    or has_function_privilege('authenticated','public.ca46_employee_identity(text)','EXECUTE') then
    raise exception 'Identity lookup exposed to frontend'; end if;
end $$;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.digital_tags) or exists(select 1 from public.company_settings)
    or exists(select 1 from public.company_members) then raise exception 'Employee can read private records'; end if;
end $$;
rollback;
select 'PASS: actual service-role lookup, list, bind, activate and deactivate; no password access; employee RLS intact' as verification;
