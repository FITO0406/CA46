-- CA46 · Google Drive OAuth por empresa
-- Cada empresa conecta su propia cuenta de Google. Las credenciales se usan solo desde servidor.

begin;

create table if not exists public.company_drive_credentials (
  company_id uuid primary key references public.companies(id) on delete cascade,
  google_account_email text not null default '',
  refresh_token text not null,
  access_token text not null default '',
  token_expiry timestamptz,
  scope text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_drive_credentials enable row level security;

revoke all on table public.company_drive_credentials from public;
revoke all on table public.company_drive_credentials from anon;
revoke all on table public.company_drive_credentials from authenticated;

drop trigger if exists trg_company_drive_credentials_updated_at on public.company_drive_credentials;
create trigger trg_company_drive_credentials_updated_at
before update on public.company_drive_credentials
for each row execute function public.ca46_set_updated_at();

commit;
