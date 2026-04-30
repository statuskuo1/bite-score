-- Returns profiles of everyone else the same tagger tagged on the same entry.
-- SECURITY DEFINER bypasses RLS so the tagged user can see co-diners they
-- wouldn't otherwise have SELECT access to.
create or replace function public.fetch_co_diners(
  p_tagger_id  uuid,
  p_entry_id   uuid,
  p_exclude_id uuid
)
returns table(id uuid, username text, display_name text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from   dine_with_tags dt
  join   profiles p on p.id = dt.tagged_id
  where  dt.tagger_id  = p_tagger_id
    and  dt.entry_id   = p_entry_id
    and  dt.tagged_id <> p_exclude_id;
$$;
