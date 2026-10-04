-- The invitation RPCs are SECURITY INVOKER and server-role only.
-- Allow only the identity columns they read; do not grant passwords, tokens or writes.
grant select (id, email, email_confirmed_at) on auth.users to service_role;
