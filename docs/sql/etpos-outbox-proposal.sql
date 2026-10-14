-- Proposed migration for the CA46 → ETPOS outbox.
-- Do not execute automatically: release only after reviewing production schema and RLS.
create table if not exists public.etpos_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label_id uuid not null references public.digital_tags(id) on delete cascade,
  revision integer not null check (revision > 0),
  action text not null check (action in ('upsert','deactivate')),
  source text not null check (source in ('24h','72h','cocina_hija')),
  status text not null default 'pending_mapping'
    check (status in ('pending_mapping','pending','blocked','synced','failed')),
  payload jsonb not null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (company_id, label_id, revision, action)
);
create index if not exists etpos_sync_outbox_pending_idx
  on public.etpos_sync_outbox (company_id, status, created_at);
alter table public.etpos_sync_outbox enable row level security;
-- Deliberately no public client grants or policies: only server-side privileged
-- backend with explicit company scoping can access these rows.
revoke all on public.etpos_sync_outbox from anon, authenticated;
