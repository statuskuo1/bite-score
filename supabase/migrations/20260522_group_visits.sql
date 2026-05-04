-- Group visits v1
--
-- A "group visit" is an explicit, server-side record that user A and a set of
-- tagged users B/C/... ate at the same place around the same time. It layers
-- on top of `restaurant_visits` (each member's eventual visit row) and the
-- existing `dine_with_tags` system (which still drives the "dined with …"
-- co-diner rendering on feed/log cards). Group visits add:
--   1. dedupe — when several diners independently log the same dinner, we
--      collapse them into one shared record instead of N parallel tag chains;
--   2. status tracking — pending → resolved/expired, so we can surface "still
--      waiting on B/C" UI and auto-clear stale prompts after 7 days;
--   3. structured prefill — a tap on the notification can prefill the Add
--      form with all other members in one shot.
--
-- Restaurants only for v1 — `place_id` is a uuid FK to `restaurant_places.id`,
-- the same shape `restaurant_visits.place_id` uses. Adding cafés would mean a
-- second `kind` column + nullable cafe_visits FK; we'll do that in a follow-up
-- if it's worth the complexity.
--
-- No new scheduling infrastructure: see `tick_group_visits_expiry()` at the
-- bottom — we run the day-7 sweep opportunistically whenever any user opens
-- their notification panel.

-- ── 1. group_visits ──────────────────────────────────────────────────────────

create table if not exists public.group_visits (
  id              uuid        primary key default gen_random_uuid(),
  created_by      uuid        not null references public.profiles(id)          on delete cascade,
  place_id        uuid        not null references public.restaurant_places(id) on delete restrict,
  restaurant_name text        not null default '',
  visited_at      timestamptz not null,
  resolved_at     timestamptz,
  status          text        not null default 'pending'
                  check (status in ('pending', 'resolved', 'expired')),
  created_at      timestamptz not null default now()
);

-- Lookup-by-place for the candidate-match search at Save time.
create index if not exists group_visits_place_visited_idx
  on public.group_visits (place_id, visited_at desc);

-- Filtered by status='pending' so day-7 sweep + candidate search both stay cheap.
create index if not exists group_visits_pending_visited_idx
  on public.group_visits (visited_at)
  where status = 'pending';

-- ── 2. group_visit_members ───────────────────────────────────────────────────

create table if not exists public.group_visit_members (
  id              uuid        primary key default gen_random_uuid(),
  group_visit_id  uuid        not null references public.group_visits(id)        on delete cascade,
  user_id         uuid        not null references public.profiles(id)            on delete cascade,
  visit_id        uuid        references public.restaurant_visits(id)            on delete set null,
  tagged_by       uuid        not null references public.profiles(id)            on delete cascade,
  status          text        not null default 'pending'
                  check (status in ('pending', 'logged', 'skipped')),
  notified_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (group_visit_id, user_id)
);

-- Used by the candidate-match query (overlap on (group_visit_id, user_id)).
create index if not exists group_visit_members_group_idx
  on public.group_visit_members (group_visit_id);

-- Used by the candidate-match query when filtering "is this user already a
-- member of any pending group at this place?". Partial index keeps it small.
create index if not exists group_visit_members_user_pending_idx
  on public.group_visit_members (user_id)
  where status = 'pending';

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

alter table public.group_visits        enable row level security;
alter table public.group_visit_members enable row level security;

-- A group visit is visible to its creator and to every tagged member.
drop policy if exists "group_visits select member" on public.group_visits;
create policy "group_visits select member"
  on public.group_visits for select
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1
      from public.group_visit_members m
      where m.group_visit_id = id
        and m.user_id = auth.uid()
    )
  );

-- Only the creator can insert the parent row (the save flow runs as A).
drop policy if exists "group_visits insert own" on public.group_visits;
create policy "group_visits insert own"
  on public.group_visits for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Members and the creator can update status (auto-resolve trigger does most
-- of this, but the tick RPC and the join-existing flow update too). Locked to
-- people who can already see the row.
drop policy if exists "group_visits update member" on public.group_visits;
create policy "group_visits update member"
  on public.group_visits for update
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1
      from public.group_visit_members m
      where m.group_visit_id = id
        and m.user_id = auth.uid()
    )
  );

-- Member rows visible to: the member themselves, the user who tagged them,
-- and any other member of the same group (so "still waiting on …" UI works).
drop policy if exists "group_visit_members select member" on public.group_visit_members;
create policy "group_visit_members select member"
  on public.group_visit_members for select
  to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = tagged_by
    or exists (
      select 1
      from public.group_visit_members m2
      where m2.group_visit_id = group_visit_members.group_visit_id
        and m2.user_id = auth.uid()
    )
  );

-- Tagger inserts member rows for everyone (themselves + tagged friends).
drop policy if exists "group_visit_members insert tagger" on public.group_visit_members;
create policy "group_visit_members insert tagger"
  on public.group_visit_members for insert
  to authenticated
  with check (auth.uid() = tagged_by);

-- The member can flip their own status (logged/skipped); the tagger can also
-- update (auto-link variant writes status='logged' before the member acts).
drop policy if exists "group_visit_members update self" on public.group_visit_members;
create policy "group_visit_members update self"
  on public.group_visit_members for update
  to authenticated
  using (auth.uid() = user_id or auth.uid() = tagged_by);

-- ── 4. Notification type-check expansion ─────────────────────────────────────

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
      'group_visit_logged'
    ));

-- ── 5. Auto-resolve trigger ──────────────────────────────────────────────────

-- When the last pending member of a group transitions to logged/skipped, flip
-- the parent to resolved. Idempotent — re-resolving a resolved row is a no-op.
create or replace function public.group_visit_members_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> old.status and new.status in ('logged', 'skipped') then
    update public.group_visits gv
       set status      = 'resolved',
           resolved_at = coalesce(gv.resolved_at, now())
     where gv.id = new.group_visit_id
       and gv.status = 'pending'
       and not exists (
         select 1
         from public.group_visit_members m
         where m.group_visit_id = gv.id
           and m.status = 'pending'
       );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_group_visit_members_auto_resolve on public.group_visit_members;
create trigger trg_group_visit_members_auto_resolve
  after update of status on public.group_visit_members
  for each row
  execute function public.group_visit_members_after_status_change();

-- ── 6. Day-7 expiry / safety-net resolve RPC ─────────────────────────────────
--
-- Cheap, idempotent. Called by the app every time the notification panel
-- opens. Three sweeps in one transaction:
--   a. Mark stale pending members 'skipped' (parent older than 7 days).
--   b. Mark stale pending parents 'expired'.
--   c. Backstop: any pending parent with no remaining pending members → resolved.
--      The trigger above usually handles this, but the sweep covers cases
--      where a member was deleted directly (cascade on profiles delete).

create or replace function public.tick_group_visits_expiry()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_visit_members m
     set status = 'skipped'
   where m.status = 'pending'
     and exists (
       select 1
       from public.group_visits gv
       where gv.id = m.group_visit_id
         and gv.status = 'pending'
         and gv.visited_at < now() - interval '7 days'
     );

  update public.group_visits gv
     set status = 'expired'
   where gv.status = 'pending'
     and gv.visited_at < now() - interval '7 days';

  update public.group_visits gv
     set status      = 'resolved',
         resolved_at = coalesce(gv.resolved_at, now())
   where gv.status = 'pending'
     and not exists (
       select 1
       from public.group_visit_members m
       where m.group_visit_id = gv.id
         and m.status = 'pending'
     );
end;
$$;

revoke all on function public.tick_group_visits_expiry() from public;
grant execute on function public.tick_group_visits_expiry() to authenticated;
