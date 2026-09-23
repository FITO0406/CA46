-- CA46 v1 · Cierre de permisos de funciones internas.
-- Estas funciones solo se invocan desde rutas servidor con service_role o
-- como triggers; no deben exponerse mediante PostgREST.

begin;

revoke all on function public.ca46_create_company_subscription() from public, anon, authenticated;
grant execute on function public.ca46_create_company_subscription() to service_role;

revoke all on function public.ca46_next_invoice_number(text) from public, anon, authenticated;
grant execute on function public.ca46_next_invoice_number(text) to service_role;

revoke all on function public.sync_company_subscription_plan() from public, anon, authenticated;
grant execute on function public.sync_company_subscription_plan() to service_role;

revoke all on function public.ca46_issue_service_invoice(
  uuid, text, text, text, text, date, date, text, integer, numeric,
  integer, integer, jsonb, jsonb, text, text, uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.ca46_issue_service_invoice(
  uuid, text, text, text, text, date, date, text, integer, numeric,
  integer, integer, jsonb, jsonb, text, text, uuid, text, uuid
) to service_role;

revoke all on function public.ca46_issue_rectifying_service_invoice(
  uuid, text, text, text, text, date, date, text, integer, numeric,
  integer, integer, jsonb, jsonb, text, text, uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.ca46_issue_rectifying_service_invoice(
  uuid, text, text, text, text, date, date, text, integer, numeric,
  integer, integer, jsonb, jsonb, text, text, uuid, text, text, uuid
) to service_role;

commit;
