-- Extend local recovery only; exposure times and private Drive copies are unchanged.
create or replace function public.drive_purge_archived_labels(p_company_id uuid, p_root_folder_id text)
returns integer language plpgsql security invoker set search_path = '' as $$
declare eligible uuid[]; deleted_count integer; total integer := 0;
begin
  if not exists (select 1 from public.company_settings s
    join public.company_drive_credentials c on c.company_id = s.company_id
    where s.company_id = p_company_id and s.drive_connected
      and s.drive_folder_id = p_root_folder_id and c.refresh_token_encrypted is not null)
    then return 0; end if;
  select array_agg(t.id) into eligible from public.digital_tags t
    join public.company_drive_archives a on a.company_id = t.company_id and a.tag_id = t.id
    where t.company_id = p_company_id and t.expires_at <= now()
      and a.root_folder_id = p_root_folder_id and a.archived_at >= t.expires_at
      -- Keep invoice and box labels recoverable for 15 days after creation.
      and (t.source = 'kitchen' or t.created_at <= now() - interval '15 days');
  if eligible is null then return 0; end if;
  delete from public.kitchen_transformations k where k.company_id = p_company_id
    and k.parent_tag_id = any(eligible)
    and (k.child_tag_id is null or k.child_tag_id = any(eligible))
    and not exists (
      with recursive chain as (
        select t.id from public.digital_tags t where t.id = k.parent_tag_id
        union all
        select t.id from public.digital_tags t join chain c on t.parent_tag_id = c.id
      ) select 1 from chain where not (id = any(eligible))
    );
  loop
    delete from public.digital_tags t where t.company_id = p_company_id and t.id = any(eligible)
      and not exists (select 1 from public.digital_tags child where child.parent_tag_id = t.id)
      and not exists (select 1 from public.kitchen_transformations k where k.parent_tag_id = t.id or k.child_tag_id = t.id);
    get diagnostics deleted_count = row_count;
    total := total + deleted_count;
    exit when deleted_count = 0;
  end loop;
  return total;
end;
$$;
revoke all on function public.drive_purge_archived_labels(uuid,text) from public, anon, authenticated;
grant execute on function public.drive_purge_archived_labels(uuid,text) to service_role;
