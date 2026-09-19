-- CA46 · Guardia de restablecimiento SuperAdmin
-- Permite marcar como usado un restablecimiento puntual de contraseña.

begin;

alter table public.super_admin_invites
  add column if not exists password_reset_used_at timestamptz;

commit;
