-- CA46 · Etiquetas provisionales de 24 h desde etiqueta física
-- Aplicada en producción mediante Supabase MCP.

begin;

alter table public.digital_tags
  add column if not exists source text not null default 'invoice',
  add column if not exists status text not null default 'definitive',
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

update public.digital_tags
set source = 'legacy', status = 'definitive'
where company_id is null and source = 'invoice';

alter table public.digital_tags
  drop constraint if exists digital_tags_source_check,
  drop constraint if exists digital_tags_status_check;

alter table public.digital_tags
  add constraint digital_tags_source_check check (source in ('invoice','physical_label','legacy')),
  add constraint digital_tags_status_check check (status in ('definitive','provisional'));

alter table public.digital_tags
  drop constraint if exists digital_tags_drive_file_id_key;

drop index if exists public.digital_tags_drive_file_id_key;
create unique index if not exists digital_tags_company_drive_unique
  on public.digital_tags(company_id, drive_file_id)
  where company_id is not null;

create index if not exists idx_digital_tags_company_status_expiry
  on public.digital_tags(company_id, status, expires_at desc);

-- Mientras llega la pantalla pública por token, las lecturas anónimas solo ven el legado sin empresa.
drop policy if exists public_read_active_tags on public.digital_tags;
create policy public_read_legacy_active_tags
on public.digital_tags
for select
to anon
using (company_id is null and is_active = true and expires_at > now());

commit;
