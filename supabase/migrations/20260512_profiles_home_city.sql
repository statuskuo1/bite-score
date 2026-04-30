alter table public.profiles
  add column if not exists home_city text not null default '';
