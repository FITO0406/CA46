-- CA46 · Endurecimiento de funciones auxiliares

begin;

alter function public.ca46_slugify(text) set search_path = public;
alter function public.ca46_set_updated_at() set search_path = public;

revoke all on function public.ca46_handle_new_user() from public, anon, authenticated;
revoke all on function public.ca46_set_updated_at() from public, anon, authenticated;
revoke all on function public.ca46_slugify(text) from public, anon, authenticated;

revoke all on function public.ca46_has_company_access(uuid) from public, anon;
revoke all on function public.ca46_is_company_admin(uuid) from public, anon;
grant execute on function public.ca46_has_company_access(uuid) to authenticated;
grant execute on function public.ca46_is_company_admin(uuid) to authenticated;

commit;
