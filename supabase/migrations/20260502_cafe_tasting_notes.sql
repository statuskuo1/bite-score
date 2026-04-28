-- Add Coffee tasting fields to cafe_visits.
-- Acidity / body / sweetness are nullable so existing rows aren't forced to a
-- value. Flavor notes default to an empty array so reads can always treat the
-- column as a string[]. Roast defaults to '' (empty = unset) matching the
-- existing milk_level / bean_region pattern.

alter table public.cafe_visits
  add column if not exists acidity numeric,
  add column if not exists body numeric,
  add column if not exists sweetness numeric,
  add column if not exists flavor_notes text[] not null default '{}',
  add column if not exists roast text not null default '';
