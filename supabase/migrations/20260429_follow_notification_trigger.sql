-- Trigger: auto-insert notifications when a follow row is created.
-- Runs as SECURITY DEFINER so it bypasses RLS and can insert for any user_id.
-- This replaces the unreliable client-side notification inserts in followsApi.js.

create or replace function public.handle_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reverse_exists boolean;
begin
  select exists (
    select 1 from public.follows
    where follower_id = new.following_id
      and following_id = new.follower_id
  ) into reverse_exists;

  if reverse_exists then
    -- mutual follow → taste_buds notification for both parties
    insert into public.notifications (user_id, from_user_id, type) values
      (new.follower_id,  new.following_id, 'taste_buds'),
      (new.following_id, new.follower_id,  'taste_buds');
  else
    -- one-way → follow notification for the person being followed
    insert into public.notifications (user_id, from_user_id, type)
    values (new.following_id, new.follower_id, 'follow');
  end if;

  return new;
end;
$$;

drop trigger if exists on_follow_created on public.follows;
create trigger on_follow_created
  after insert on public.follows
  for each row execute function public.handle_follow_notification();
