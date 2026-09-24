-- DIRECTOR CA46 V1: conversación, control manual, autorizaciones y auditoría.
-- Todas las tablas son exclusivamente de servidor. No se conceden permisos
-- directos a anon ni authenticated; el acceso pasa por rutas SuperAdmin.

create table if not exists public.director_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id) on delete set null
);

insert into public.director_settings (id, enabled)
values (true, false)
on conflict (id) do nothing;

create table if not exists public.director_conversations (
  id uuid primary key default gen_random_uuid(),
  super_admin_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Conversación principal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (super_admin_user_id)
);

create table if not exists public.director_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.director_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (char_length(content) between 1 and 30000),
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists director_messages_conversation_created_idx
  on public.director_messages (conversation_id, created_at desc);

create table if not exists public.director_action_proposals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  company_id uuid references public.companies(id) on delete restrict,
  action_key text not null,
  summary text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  parameters jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'authorized', 'rejected', 'expired', 'executed', 'failed')),
  reversible boolean not null default false,
  expires_at timestamptz not null,
  authorized_by_user_id uuid references auth.users(id) on delete restrict,
  authorized_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_action_proposals_status_idx
  on public.director_action_proposals (status, created_at desc);

create table if not exists public.director_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  super_admin_user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  event_type text not null,
  action_key text not null,
  reason text,
  tool_name text,
  result_status text not null check (result_status in ('success', 'denied', 'failed', 'pending')),
  authorization_required boolean not null default false,
  authorization_code text,
  reversible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists director_audit_log_occurred_idx
  on public.director_audit_log (occurred_at desc);

create table if not exists public.director_daily_briefings (
  id uuid primary key default gen_random_uuid(),
  super_admin_user_id uuid not null references auth.users(id) on delete cascade,
  period_from timestamptz,
  period_to timestamptz not null default now(),
  content text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists director_daily_briefings_user_created_idx
  on public.director_daily_briefings (super_admin_user_id, created_at desc);

alter table public.director_settings enable row level security;
alter table public.director_conversations enable row level security;
alter table public.director_messages enable row level security;
alter table public.director_action_proposals enable row level security;
alter table public.director_audit_log enable row level security;
alter table public.director_daily_briefings enable row level security;

revoke all on table public.director_settings from anon, authenticated;
revoke all on table public.director_conversations from anon, authenticated;
revoke all on table public.director_messages from anon, authenticated;
revoke all on table public.director_action_proposals from anon, authenticated;
revoke all on table public.director_audit_log from anon, authenticated;
revoke all on table public.director_daily_briefings from anon, authenticated;
revoke all on sequence public.director_audit_log_id_seq from anon, authenticated;

grant all on table public.director_settings to service_role;
grant all on table public.director_conversations to service_role;
grant all on table public.director_messages to service_role;
grant all on table public.director_action_proposals to service_role;
grant all on table public.director_audit_log to service_role;
grant all on table public.director_daily_briefings to service_role;
grant usage, select on sequence public.director_audit_log_id_seq to service_role;
