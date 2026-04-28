-- Social layer: friendships + groups + group_members.
--
-- Friend lookup is by username (already unique case-insensitive in profiles).
-- Compatibility math runs client-side over already-readable visits, so we
-- only need to gate friend-graph and group membership here.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- friendships: one row per (unordered) pair of users, status flag
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- One row per (unordered) pair — prevents both duplicate and reciprocal requests.
create unique index if not exists friendships_unique_pair_idx
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_status_idx on public.friendships (status);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_involved" on public.friendships;
create policy "friendships_select_involved"
  on public.friendships for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friendships_insert_self" on public.friendships;
create policy "friendships_insert_self"
  on public.friendships for insert
  to authenticated
  with check (requester_id = auth.uid() and addressee_id <> auth.uid());

-- Only the addressee can flip pending → accepted (or back).
drop policy if exists "friendships_update_addressee" on public.friendships;
create policy "friendships_update_addressee"
  on public.friendships for update
  to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid());

-- Either party can withdraw / unfriend / decline.
drop policy if exists "friendships_delete_involved" on public.friendships;
create policy "friendships_delete_involved"
  on public.friendships for delete
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- groups + group_members
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists groups_owner_idx on public.groups (owner_id);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers — break RLS recursion on group_members policies
-- and centralise friend-pair lookup so policies stay readable.
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = p_user_id
  );
$$;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = p_a and addressee_id = p_b)
        or (requester_id = p_b and addressee_id = p_a)
      )
  );
$$;

grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- groups RLS
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;

drop policy if exists "groups_select_member_or_owner" on public.groups;
create policy "groups_select_member_or_owner"
  on public.groups for select
  to authenticated
  using (owner_id = auth.uid() or public.is_group_member(id, auth.uid()));

drop policy if exists "groups_insert_owner_self" on public.groups;
create policy "groups_insert_owner_self"
  on public.groups for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner"
  on public.groups for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner"
  on public.groups for delete
  to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- group_members RLS
-- ---------------------------------------------------------------------------
alter table public.group_members enable row level security;

drop policy if exists "group_members_select_in_group" on public.group_members;
create policy "group_members_select_in_group"
  on public.group_members for select
  to authenticated
  using (
    public.is_group_member(group_id, auth.uid())
    or public.is_group_owner(group_id, auth.uid())
  );

-- Owner can insert: self (on group creation) OR an accepted friend of owner.
drop policy if exists "group_members_insert_owner_invites_friend" on public.group_members;
create policy "group_members_insert_owner_invites_friend"
  on public.group_members for insert
  to authenticated
  with check (
    public.is_group_owner(group_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.are_friends(auth.uid(), user_id)
    )
  );

-- Self-leave is always allowed; owner can remove any member.
drop policy if exists "group_members_delete_self_or_owner" on public.group_members;
create policy "group_members_delete_self_or_owner"
  on public.group_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_group_owner(group_id, auth.uid())
  );
