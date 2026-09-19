-- CA46 · Núcleo seguro de SuperAdmin
-- Separa completamente la administración global de los roles de cada empresa.

begin;

create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

-- Nunca se consulta esta tabla directamente desde el navegador.
-- Todo acceso SuperAdmin pasa por API servidor + service role.
revoke all on table public.super_admins from anon;
revoke all on table public.super_admins from authenticated;

create index if not exists idx_super_admins_active
  on public.super_admins(is_active)
  where is_active = true;

commit;
