-- Generated, indexed grouping key for popular-orders aggregation.
-- The app keeps reading/writing order_item as-is; Postgres maintains the
-- normalized form on every insert/update, no trigger required.

alter table public.cafe_visits
  add column order_item_normalized text
    generated always as (lower(btrim(order_item))) stored;

create index if not exists cafe_visits_place_order_norm_idx
  on public.cafe_visits (place_id, order_item_normalized);

-- Cross-user popular orders for a cafe place. SECURITY DEFINER so the
-- function bypasses cafe_visits_select_own RLS for aggregation only.
-- Privacy floor: requires >=2 distinct users to expose an item.
-- Display label: most-recently-logged original casing for the normalized
-- bucket (avoids mixing "Latte" and "latte" in the same dropdown row).

create or replace function public.popular_orders_for_place(
  p_place_id uuid,
  p_category text default null
)
returns table(order_item text, occurrences bigint)
language sql
security definer
set search_path = public
as $$
  select
    (array_agg(order_item order by visited_at desc))[1] as order_item,
    count(*) as occurrences
  from public.cafe_visits
  where place_id = p_place_id
    and order_item_normalized <> ''
    and (p_category is null or category = p_category)
  group by order_item_normalized
  having count(distinct user_id) >= 2
  order by occurrences desc, order_item asc
  limit 8;
$$;

revoke all on function public.popular_orders_for_place(uuid, text) from public;
grant execute on function public.popular_orders_for_place(uuid, text) to authenticated;
