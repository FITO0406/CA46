begin;

-- Preserve the existing RLS helper, excluding creation-only employees from reads.
create or replace function public.ca46_has_company_access(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.company_members cm
    where cm.company_id=target_company_id and cm.user_id=auth.uid()
      and cm.is_active=true and cm.role <> 'empleado');
$$;

-- These helpers are called only by the server after authenticating the administrator.
-- SECURITY INVOKER preserves the caller's database privileges.
create function public.ca46_employee_identity(p_email text)
returns table(user_id uuid, confirmed boolean, company_id uuid, member_role text, active boolean)
language sql stable security invoker set search_path = '' as $$
  select u.id, u.email_confirmed_at is not null, m.company_id, m.role, m.is_active
  from auth.users u left join public.company_members m on m.user_id=u.id
  where lower(u.email)=lower(p_email);
$$;

create function public.ca46_company_member_list(p_company_id uuid)
returns table(user_id uuid, email text, member_role text, active boolean, confirmed boolean)
language sql stable security invoker set search_path = '' as $$
  select m.user_id, u.email::text, m.role, m.is_active, u.email_confirmed_at is not null
  from public.company_members m join auth.users u on u.id=m.user_id
  where m.company_id=p_company_id order by m.created_at;
$$;

create function public.ca46_bind_employee(p_admin_id uuid, p_company_id uuid, p_user_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
  if not exists(select 1 from public.company_members m join public.companies c on c.id=m.company_id
    where m.user_id=p_admin_id and m.company_id=p_company_id and m.role='admin_empresa'
      and m.is_active and c.status in ('active','trial')) then
    raise exception 'EMPLOYEE_ADMIN_REQUIRED';
  end if;
  if exists(select 1 from public.companies where owner_user_id=p_user_id)
    or exists(select 1 from public.super_admins where user_id=p_user_id and is_active)
    or exists(select 1 from public.company_members where user_id=p_user_id
      and (company_id<>p_company_id or role<>'empleado')) then
    raise exception 'EMPLOYEE_ACCOUNT_IN_USE';
  end if;
  insert into public.company_members(company_id,user_id,role,is_active)
  values(p_company_id,p_user_id,'empleado',true)
  on conflict(company_id,user_id) do update set is_active=true where public.company_members.role='empleado';
end;
$$;

create function public.ca46_set_employee_active(p_admin_id uuid,p_company_id uuid,p_user_id uuid,p_active boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.company_members m join public.companies c on c.id=m.company_id
    where m.user_id=p_admin_id and m.company_id=p_company_id and m.role='admin_empresa'
      and m.is_active and c.status in ('active','trial')) then
    raise exception 'EMPLOYEE_ADMIN_REQUIRED';
  end if;
  update public.company_members set is_active=p_active
  where company_id=p_company_id and user_id=p_user_id and role='empleado';
  return found;
end;
$$;

revoke all on function public.ca46_employee_identity(text) from public,anon,authenticated;
revoke all on function public.ca46_company_member_list(uuid) from public,anon,authenticated;
revoke all on function public.ca46_bind_employee(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.ca46_set_employee_active(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ca46_employee_identity(text) to service_role;
grant execute on function public.ca46_company_member_list(uuid) to service_role;
grant execute on function public.ca46_bind_employee(uuid,uuid,uuid) to service_role;
grant execute on function public.ca46_set_employee_active(uuid,uuid,uuid,boolean) to service_role;
commit;
