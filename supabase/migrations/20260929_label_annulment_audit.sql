-- CA46 · Anulación auditable de etiquetas
-- La etiqueta no se borra: se desactiva y conserva motivo, nota, usuario y fecha.

begin;

alter table public.digital_tags
  add column if not exists annulled_at timestamptz,
  add column if not exists annulled_reason text,
  add column if not exists annulled_note text,
  add column if not exists annulled_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_digital_tags_company_annulled
  on public.digital_tags(company_id, annulled_at desc)
  where annulled_at is not null;

commit;
