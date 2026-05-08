-- Anniversary / "month-aversary" milestone notifications.
--
-- Adds a new notification type 'milestone' that fires when a user crosses
-- one of {1 month, 6 months, 1 year, 5 years, 10 years} past their
-- profiles.created_at. No new scheduling infrastructure: the
-- public.tick_user_milestones() RPC is called opportunistically when the
-- user opens the notification panel, mirroring the existing
-- tick_group_visits_expiry() pattern (20260522_group_visits.sql).
--
-- Backfill rule on first sweep per user: only the SINGLE highest already-
-- passed milestone fires. After that, any newly-crossed milestone with a
-- rank higher than what's already recorded fires on the next panel open.
-- This keeps existing long-time users from getting spammed with every
-- past anniversary at once.

-- ── 1. Notification type-check expansion ────────────────────────────────────
--
-- Previous full set was defined in 20260522_group_visits.sql plus the
-- group_visit_all_logged addition in 20260526_consolidate_to_group_visit_members.sql.
-- We re-list the full set here and add 'milestone'.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
    check (type in (
      'follow',
      'taste_buds',
      'dine_tag',
      'dine_tag_back',
      'dine_tag_accepted',
      'dine_tag_mutual',
      'heart_reaction',
      'group_visit_tagged',
      'group_visit_logged',
      'group_visit_all_logged',
      'milestone'
    ));

-- ── 2. Dedupe index ─────────────────────────────────────────────────────────
--
-- One milestone row per (user, milestone-key). Partial index keyed on
-- meta->>'milestone' so only milestone rows are constrained — same shape as
-- notifications_group_visit_tagged_dedup in 20260530_notifications_dedup.sql.

create unique index if not exists notifications_milestone_dedup
  on public.notifications (user_id, (meta->>'milestone'))
  where type = 'milestone';

-- ── 3. tick_user_milestones() RPC ───────────────────────────────────────────
--
-- Called by the client whenever the notification panel opens (and on
-- post-action refetch). Cheap, idempotent: the dedupe index above plus
-- ON CONFLICT DO NOTHING make repeat calls a no-op.
--
-- SECURITY DEFINER bypasses notifications RLS for the insert, but we still
-- pin the recipient (and the from_user_id self-reference) to auth.uid()
-- so a caller cannot inject milestones for anyone else.

create or replace function public.tick_user_milestones()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user             uuid := auth.uid();
  v_joined           timestamptz;
  v_max_passed_ord   int;
  v_existing_max_ord int;
begin
  if v_user is null then return; end if;

  select created_at into v_joined
    from public.profiles
   where id = v_user;
  if v_joined is null then return; end if;

  -- Highest threshold ordinal whose anniversary has already passed.
  select max(t.ord) into v_max_passed_ord
    from (values
      ('1mo',  1, interval '1 month'),
      ('6mo',  2, interval '6 months'),
      ('1yr',  3, interval '1 year'),
      ('5yr',  4, interval '5 years'),
      ('10yr', 5, interval '10 years')
    ) as t(key, ord, span)
   where v_joined + t.span <= now();

  if v_max_passed_ord is null then return; end if;

  -- Highest milestone ordinal already recorded for this user. NULL means
  -- this is the first sweep for them.
  select max(t.ord) into v_existing_max_ord
    from public.notifications n
    join (values
      ('1mo',  1),
      ('6mo',  2),
      ('1yr',  3),
      ('5yr',  4),
      ('10yr', 5)
    ) as t(key, ord) on t.key = n.meta->>'milestone'
   where n.user_id = v_user
     and n.type    = 'milestone';

  if v_existing_max_ord is null then
    -- First-run backfill: fire only the single highest passed milestone.
    insert into public.notifications (user_id, from_user_id, type, meta)
    select v_user, v_user, 'milestone',
           jsonb_build_object('milestone', t.key)
      from (values
        ('1mo',  1),
        ('6mo',  2),
        ('1yr',  3),
        ('5yr',  4),
        ('10yr', 5)
      ) as t(key, ord)
     where t.ord = v_max_passed_ord
    on conflict do nothing;
  else
    -- Subsequent runs: insert each passed threshold strictly above the
    -- highest already-recorded one. Skips intermediate milestones the
    -- first-run backfill intentionally dropped.
    insert into public.notifications (user_id, from_user_id, type, meta)
    select v_user, v_user, 'milestone',
           jsonb_build_object('milestone', t.key)
      from (values
        ('1mo',  1, interval '1 month'),
        ('6mo',  2, interval '6 months'),
        ('1yr',  3, interval '1 year'),
        ('5yr',  4, interval '5 years'),
        ('10yr', 5, interval '10 years')
      ) as t(key, ord, span)
     where v_joined + t.span <= now()
       and t.ord > v_existing_max_ord
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.tick_user_milestones() from public;
grant execute on function public.tick_user_milestones() to authenticated;
