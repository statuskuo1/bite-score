-- Notifications table
-- Stores per-user notifications for follow and taste_buds events.
-- user_id      = the person receiving the notification
-- from_user_id = the person who triggered it

create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  from_user_id uuid        not null references public.profiles(id) on delete cascade,
  type         text        not null check (type in ('follow', 'taste_buds')),
  read         boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_id_created_idx
  on public.notifications (user_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.notifications enable row level security;

-- Users can only read their own notifications.
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Any authenticated user may insert a notification (needed so the follower can
-- create notifications for both parties on a taste_buds event without a
-- server-side function or service role key).
create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  to authenticated
  with check (true);

-- Users can mark their own notifications read.
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);
