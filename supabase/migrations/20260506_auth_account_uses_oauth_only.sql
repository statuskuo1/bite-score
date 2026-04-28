-- BITE Score: detect "Google-only" accounts so the sign-in form can show a
-- friendly "This account uses Google sign-in" message instead of the generic
-- "Invalid login credentials" Supabase returns when a password sign-in attempt
-- hits a user who has no `email` provider in auth.identities.
--
-- Returns TRUE only when:
--   1. the identifier matches a real auth.users row (by email if it contains
--      '@', otherwise by profiles.username), AND
--   2. that user has NO row in auth.identities with provider='email'.
--
-- Returns FALSE for non-existent accounts (so we don't enumerate) and for
-- accounts that DO have a password identity. The client only calls this AFTER
-- a failed signInWithPassword attempt, so a TRUE response uniquely means
-- "stop guessing the password — they need to use Google."
--
-- security definer + revoke-all + grant to anon/authenticated mirrors the
-- pattern in 20260505_auth_email_for_username_rpc.sql.

create or replace function public.account_uses_oauth_only(p_identifier text)
returns boolean
language sql
security definer
set search_path = public, auth, pg_catalog
as $$
  with target as (
    select u.id
    from auth.users u
    left join public.profiles p on p.id = u.id
    where coalesce(p_identifier, '') <> ''
      and (
        (position('@' in p_identifier) > 0 and lower(u.email) = lower(p_identifier))
        or (position('@' in p_identifier) = 0 and lower(p.username) = lower(p_identifier))
      )
    limit 1
  )
  select case
    when not exists (select 1 from target) then false
    when not exists (
      select 1
      from auth.identities i
      join target t on t.id = i.user_id
      where i.provider = 'email'
    ) then true
    else false
  end;
$$;

revoke all on function public.account_uses_oauth_only(text) from public;
grant execute on function public.account_uses_oauth_only(text) to anon, authenticated;
