-- CA46 · Núcleo multiempresa
-- Migración aditiva: no modifica ni elimina datos existentes.
-- Crea empresas, miembros y el alta automática del primer administrador.

begin;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'gratis'
    check (plan in ('gratis', 'autonomo', 'empresa', 'personalizado')),
  status text not null default 'active'
    check (status in ('active', 'trial', 'suspended', 'cancelled')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'empleado'
    check (role in ('admin_empresa', 'encargado', 'empleado', 'asesor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists idx_companies_owner on public.companies(owner_user_id);
create index if not exists idx_companies_plan on public.companies(plan);
create index if not exists idx_company_members_user on public.company_members(user_id) where is_active = true;
create index if not exists idx_company_members_company on public.company_members(company_id) where is_active = true;

create or replace function public.ca46_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.ca46_set_updated_at();

drop trigger if exists trg_company_members_updated_at on public.company_members;
create trigger trg_company_members_updated_at
before update on public.company_members
for each row execute function public.ca46_set_updated_at();

-- Helpers de autorización. SECURITY DEFINER evita recursión de RLS sobre company_members.
create or replace function public.ca46_has_company_access(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
  );
$$;

create or replace function public.ca46_is_company_admin(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.role = 'admin_empresa'
  );
$$;

revoke all on function public.ca46_has_company_access(uuid) from public;
revoke all on function public.ca46_is_company_admin(uuid) from public;
grant execute on function public.ca46_has_company_access(uuid) to authenticated;
grant execute on function public.ca46_is_company_admin(uuid) to authenticated;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists companies_read_members on public.companies;
create policy companies_read_members
on public.companies
for select
to authenticated
using (public.ca46_has_company_access(id));

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin
on public.companies
for update
to authenticated
using (public.ca46_is_company_admin(id))
with check (public.ca46_is_company_admin(id));

drop policy if exists company_members_read_members on public.company_members;
create policy company_members_read_members
on public.company_members
for select
to authenticated
using (public.ca46_has_company_access(company_id));

drop policy if exists company_members_insert_admin on public.company_members;
create policy company_members_insert_admin
on public.company_members
for insert
to authenticated
with check (public.ca46_is_company_admin(company_id));

drop policy if exists company_members_update_admin on public.company_members;
create policy company_members_update_admin
on public.company_members
for update
to authenticated
using (public.ca46_is_company_admin(company_id))
with check (public.ca46_is_company_admin(company_id));

drop policy if exists company_members_delete_admin on public.company_members;
create policy company_members_delete_admin
on public.company_members
for delete
to authenticated
using (public.ca46_is_company_admin(company_id));

grant select, update on public.companies to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;

-- Slug estable y legible. El sufijo del UUID del usuario garantiza unicidad.
create or replace function public.ca46_slugify(input_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(input_text, ''),
      'áéíóúüñÁÉÍÓÚÜÑ',
      'aeiouunAEIOUUN')),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- Alta atómica de empresa al crear un usuario desde el registro público CA46.
create or replace function public.ca46_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  company_name text;
  requested_plan text;
  company_slug text;
  new_company_id uuid;
begin
  -- Solo los usuarios creados desde /registro deben generar una empresa nueva.
  if coalesce(new.raw_user_meta_data ->> 'signup_source', '') <> 'ca46_public' then
    return new;
  end if;

  company_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
  if company_name is null then
    company_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Empresa CA46');
  end if;

  requested_plan := lower(coalesce(new.raw_user_meta_data ->> 'plan', 'gratis'));
  if requested_plan not in ('gratis', 'autonomo', 'empresa', 'personalizado') then
    requested_plan := 'gratis';
  end if;

  company_slug := public.ca46_slugify(company_name);
  if company_slug = '' then
    company_slug := 'empresa';
  end if;
  company_slug := company_slug || '-' || left(replace(new.id::text, '-', ''), 8);

  insert into public.companies (name, slug, plan, status, owner_user_id)
  values (company_name, company_slug, requested_plan, 'active', new.id)
  returning id into new_company_id;

  insert into public.company_members (company_id, user_id, role, is_active)
  values (new_company_id, new.id, 'admin_empresa', true);

  return new;
end;
$$;

drop trigger if exists on_ca46_auth_user_created on auth.users;
create trigger on_ca46_auth_user_created
after insert on auth.users
for each row execute function public.ca46_handle_new_user();

-- Backfill prudente para cuentas creadas por el formulario anterior a esta migración.
-- Solo actúa si tienen company_name y role=admin_empresa en metadata y aún no pertenecen a una empresa.
do $$
declare
  u record;
  company_name text;
  requested_plan text;
  company_slug text;
  new_company_id uuid;
begin
  for u in
    select id, email, raw_user_meta_data
    from auth.users au
    where coalesce(au.raw_user_meta_data ->> 'company_name', '') <> ''
      and coalesce(au.raw_user_meta_data ->> 'role', '') = 'admin_empresa'
      and not exists (
        select 1 from public.company_members cm where cm.user_id = au.id
      )
  loop
    company_name := trim(u.raw_user_meta_data ->> 'company_name');
    requested_plan := lower(coalesce(u.raw_user_meta_data ->> 'plan', 'gratis'));
    if requested_plan not in ('gratis', 'autonomo', 'empresa', 'personalizado') then
      requested_plan := 'gratis';
    end if;

    company_slug := public.ca46_slugify(company_name);
    if company_slug = '' then
      company_slug := 'empresa';
    end if;
    company_slug := company_slug || '-' || left(replace(u.id::text, '-', ''), 8);

    insert into public.companies (name, slug, plan, status, owner_user_id)
    values (company_name, company_slug, requested_plan, 'active', u.id)
    on conflict (slug) do update set
      name = excluded.name,
      plan = excluded.plan,
      updated_at = now()
    returning id into new_company_id;

    insert into public.company_members (company_id, user_id, role, is_active)
    values (new_company_id, u.id, 'admin_empresa', true)
    on conflict (company_id, user_id) do update set
      role = 'admin_empresa',
      is_active = true,
      updated_at = now();
  end loop;
end;
$$;

commit;
