-- Temporary private OCR jobs only. No existing business tables/policies change.
create table public.label_analysis_jobs (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  mode text not null check (mode in ('invoice', 'physical_label')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  file_name text not null,
  mime_type text not null,
  image_base64 text check (length(image_base64) <= 8388608),
  result jsonb,
  error text,
  run_id uuid,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (company_id, user_id, id)
);
create index label_analysis_jobs_expiry_idx on public.label_analysis_jobs(expires_at);
alter table public.label_analysis_jobs enable row level security;
-- Only authenticated, server-scoped endpoints can access these jobs. No browser
-- role has table privileges, including employees; RLS has no public policies.
revoke all on public.label_analysis_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.label_analysis_jobs to service_role;

-- Erase abandoned jobs automatically even if their owner never returns.
-- Images are also erased immediately when analysis completes or fails.
create extension if not exists pg_cron;
select cron.schedule('ca46-expire-label-analysis-jobs', '17 * * * *',
  $$delete from public.label_analysis_jobs where expires_at <= now()$$);
