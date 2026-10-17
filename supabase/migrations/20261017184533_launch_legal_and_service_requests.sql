-- Additive launch preparation. Apply in staging first; no customer data is deleted.
begin;
create table public.legal_acceptances (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 representative_email text not null,
 version text not null,
 checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
 party_checksum text not null check (party_checksum ~ '^[a-f0-9]{64}$'),
 document_snapshot jsonb not null,
 company_snapshot jsonb not null,
 accepted_at timestamptz not null default now(),
 unique(company_id, version, checksum, party_checksum)
);
create index legal_acceptances_user_idx on public.legal_acceptances(user_id, accepted_at desc);
create table public.company_service_requests (
 id uuid primary key default gen_random_uuid(),
 company_id uuid references public.companies(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 requester_email text not null,
 kind text not null check (kind in ('soporte','derechos','baja','exportacion','restauracion')),
 message text not null check (char_length(message) between 10 and 4000),
 status text not null default 'pendiente' check (status in ('pendiente','en_revision','resuelta')),
 response text not null default '',
 due_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index service_requests_user_idx on public.company_service_requests(user_id, created_at desc);
create index service_requests_queue_idx on public.company_service_requests(status, created_at);
create index service_requests_company_idx on public.company_service_requests(company_id);
create table public.service_request_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.company_service_requests(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 status text not null,
 response text not null,
 created_at timestamptz not null default now()
);
alter table public.legal_acceptances enable row level security;
alter table public.company_service_requests enable row level security;
alter table public.service_request_events enable row level security;
revoke all on public.legal_acceptances,public.company_service_requests,public.service_request_events from public,anon,authenticated,service_role;
grant select,insert on public.legal_acceptances to service_role;
grant select on public.company_service_requests,public.service_request_events to service_role;
-- No direct update/delete grants: receipts and events are append-only through the API.
create function public.ca46_create_service_request(p_user_id uuid,p_company_id uuid,p_email text,p_kind text,p_message text,p_due_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.company_service_requests;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 4601));
 if (select count(*) from public.company_service_requests where user_id=p_user_id and created_at>now()-interval '1 hour') >= 5 then
  raise exception 'REQUEST_RATE_LIMIT';
 end if;
 insert into public.company_service_requests(company_id,user_id,requester_email,kind,message,due_at)
 values(p_company_id,p_user_id,p_email,p_kind,p_message,p_due_at) returning * into result;
 return jsonb_build_object('id',result.id,'created_at',result.created_at,'due_at',result.due_at);
end; $$;
create function public.ca46_update_service_request(p_actor_id uuid,p_request_id uuid,p_status text,p_response text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.super_admins where user_id=p_actor_id and is_active=true) then raise insufficient_privilege; end if;
 if p_status not in ('pendiente','en_revision','resuelta') or char_length(p_response)>4000 or (p_status='resuelta' and char_length(trim(p_response))<10) then raise check_violation; end if;
 update public.company_service_requests set status=p_status,response=p_response,updated_at=now() where id=p_request_id;
 if not found then return false; end if;
 insert into public.service_request_events(request_id,actor_id,status,response) values(p_request_id,p_actor_id,p_status,p_response);
 return true;
end; $$;
revoke all on function public.ca46_create_service_request(uuid,uuid,text,text,text,timestamptz),public.ca46_update_service_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ca46_create_service_request(uuid,uuid,text,text,text,timestamptz),public.ca46_update_service_request(uuid,uuid,text,text) to service_role;
-- Tenant plan/status cannot be elevated through a direct authenticated REST update.
revoke update on public.companies from public,anon,authenticated;
create or replace function public.ca46_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  company_name text;
  requested_plan text;
  company_slug text;
  new_company_id uuid;
begin
  -- Solo los usuarios creados desde /registro deben generar una empresa nueva.
  if coalesce(new.raw_user_meta_data ->> 'signup_source', '') <> 'ca46_public' then
    return new;
  end if;

  company_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
  if company_name is null then
    company_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Empresa CA46');
  end if;

  requested_plan := 'gratis'; -- Never trust editable signup metadata for entitlements.

  company_slug := public.ca46_slugify(company_name);
  if company_slug = '' then
    company_slug := 'empresa';
  end if;
  company_slug := company_slug || '-' || left(replace(new.id::text, '-', ''), 8);

  insert into public.companies (name, slug, plan, status, owner_user_id)
  values (company_name, company_slug, requested_plan, 'active', new.id)
  returning id into new_company_id;

  insert into public.company_members (company_id, user_id, role, is_active)
  values (new_company_id, new.id, 'admin_empresa', true);

  return new;
end;
$$;


revoke all on function public.ca46_handle_new_user() from public,anon,authenticated;
commit;
