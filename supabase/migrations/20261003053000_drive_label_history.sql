-- Drive-only state. No changes to tags, publication, expiry or other modules.
create table public.company_drive_credentials (
  company_id uuid primary key references public.companies(id) on delete cascade,
  refresh_token_encrypted text,
  lease_id uuid,
  lease_until timestamptz,
  last_archive_at timestamptz,
  last_error text
);
create table public.company_drive_archives (
  company_id uuid not null references public.companies(id) on delete cascade,
  tag_id uuid not null,
  root_folder_id text not null,
  file_id text not null,
  archived_at timestamptz,
  primary key (company_id, tag_id, root_folder_id)
);
alter table public.company_drive_credentials enable row level security;
alter table public.company_drive_archives enable row level security;
revoke all on public.company_drive_credentials, public.company_drive_archives from public, anon, authenticated;
grant all on public.company_drive_credentials, public.company_drive_archives to service_role;

create function public.drive_pending_labels(p_company_id uuid, p_root_folder_id text, p_limit integer default 30)
returns table (tag jsonb, file_id text)
language sql security invoker set search_path = '' as $$
  select to_jsonb(t) - 'price', a.file_id
  from public.digital_tags t
  left join public.company_drive_archives a on a.company_id = t.company_id
    and a.tag_id = t.id and a.root_folder_id = p_root_folder_id
  where t.company_id = p_company_id and a.archived_at is null
  order by t.created_at, t.id
  limit greatest(1, least(p_limit, 100));
$$;
revoke all on function public.drive_pending_labels(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.drive_pending_labels(uuid,text,integer) to service_role;
