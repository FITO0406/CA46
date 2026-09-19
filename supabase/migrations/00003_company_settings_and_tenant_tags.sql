-- CA46 · Configuración multiempresa y ámbito de etiquetas
-- Aplicada en producción mediante Supabase MCP.

begin;

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  business_name text not null default '',
  legal_name text not null default '',
  tax_id text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  province text not null default '',
  contact_first_name text not null default '',
  contact_last_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  selected_bank_ids text[] not null default '{}',
  screen_name text not null default '',
  labels_hours integer not null default 72 check (labels_hours between 1 and 720),
  public_screen_enabled boolean not null default true,
  public_screen_token uuid not null default gen_random_uuid() unique,
  drive_connected boolean not null default false,
  drive_folder_id text not null default '',
  drive_folder_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

drop policy if exists company_settings_read_members on public.company_settings;
create policy company_settings_read_members on public.company_settings
for select to authenticated
using (public.ca46_has_company_access(company_id));

drop policy if exists company_settings_insert_admin on public.company_settings;
create policy company_settings_insert_admin on public.company_settings
for insert to authenticated
with check (public.ca46_is_company_admin(company_id));

drop policy if exists company_settings_update_admin on public.company_settings;
create policy company_settings_update_admin on public.company_settings
for update to authenticated
using (public.ca46_is_company_admin(company_id))
with check (public.ca46_is_company_admin(company_id));

grant select, insert, update on public.company_settings to authenticated;

drop trigger if exists trg_company_settings_updated_at on public.company_settings;
create trigger trg_company_settings_updated_at
before update on public.company_settings
for each row execute function public.ca46_set_updated_at();

alter table public.digital_tags
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_digital_tags_company_active
  on public.digital_tags(company_id, is_active, expires_at desc);

-- Los registros anteriores permanecen con company_id NULL hasta conocer su empresa real.
drop policy if exists digital_tags_read_members on public.digital_tags;
create policy digital_tags_read_members on public.digital_tags
for select to authenticated
using (company_id is not null and public.ca46_has_company_access(company_id));

commit;
