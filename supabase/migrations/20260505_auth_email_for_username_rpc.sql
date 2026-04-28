-- BITE Score: resolve a profiles.username to its auth.users.email so the client
-- can offer "sign in with email or username" without exposing email lists.
--
-- Runs `security definer` so it can read auth.users (which the anon client
-- cannot SELECT directly under default RLS). The function returns NULL on miss
-- so callers cannot distinguish "no such username" from "no auth row" — keeping
-- enumeration risk to the same level any login-with-username surface has.
--
-- Idempotent: `create or replace` plus `revoke all` lets this re-run safely.

create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public, auth, pg_catalog
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(coalesce(p_username, ''))
    and char_length(coalesce(p_username, '')) between 2 and 30
  limit 1;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;
