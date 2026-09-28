-- CA46 · Cuenta de Google Drive elegida por empresa
-- La cuenta se usa para mostrar al administrador qué Drive está conectado.

alter table public.company_settings
  add column if not exists drive_account_email text not null default '';
