-- CA46 · Invitaciones seguras de SuperAdmin
-- La lista de emails autorizados se mantiene como dato de producción, no en el repositorio.

begin;

create table if not exists public.super_admin_invites (
  email text primary key,
  display_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint super_admin_invites_email_lower check (email = lower(email))
);

alter table public.super_admin_invites enable row level security;
revoke all on table public.super_admin_invites from anon;
revoke all on table public.super_admin_invites from authenticated;

create index if not exists idx_super_admin_invites_active
  on public.super_admin_invites(is_active)
  where is_active = true;

commit;
