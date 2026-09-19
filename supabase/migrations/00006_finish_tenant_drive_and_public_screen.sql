-- CA46 · Cierre del circuito multiempresa antes de SuperAdmin
-- Drive por empresa con sincronización controlada y pantalla pública solo por token.

begin;

alter table public.company_settings
  add column if not exists drive_last_sync_at timestamptz;

-- La pantalla pública ya se sirve por token mediante la API del servidor.
-- Elimina la lectura anónima del legado para evitar cualquier mezcla entre empresas.
drop policy if exists public_read_legacy_active_tags on public.digital_tags;

commit;
