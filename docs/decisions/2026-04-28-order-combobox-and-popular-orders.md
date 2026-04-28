# Order combobox + cross-user popular orders

## Context

The cafe order field had two different widgets behind one form: `OrderPills`
for Coffee/Tea (preset chips + an "Other" pill that revealed a free-text
input), and `OrderAutocomplete` for Sweets/Other (free-text with typeahead
from the user's own past orders globally). The dual UI made the form's
order section behave differently per category, and there was no way for
multi-user cafe data to influence suggestions even though the schema
already had a shared `cafe_places` catalog with per-user `cafe_visits`.

## Decision

**One combobox** ([`src/components/OrderCombobox.jsx`](../../src/components/OrderCombobox.jsx))
across all four categories. Free typing always works. Suggestions are
sourced in priority order, deduplicated by `lower(trim)`:

1. **Your past orders at this cafe** (Tier 1) - filtered from the in-memory
   `existingCafes` array by name match. Pure client-side.
2. **Popular orders at this cafe across all users** (Tier 2) - fetched via
   `popular_orders_for_place` RPC when a `placeId` is resolved. Privacy
   floor: requires `>=2` distinct users to surface an item.
3. **Curated presets** for the selected category (Coffee, Tea, Sweets,
   Other - all four now have presets; see "Sweets and Other presets"
   below).
4. **Your past orders for this category** (global, deduplicated against
   the above).

No visual badging distinguishes which tier a suggestion came from. They
are all valid orders to pick; provenance is implementation detail.

### Storage: generated normalized column

[`supabase/migrations/20260503_cafe_order_normalized_and_popular_rpc.sql`](../../supabase/migrations/20260503_cafe_order_normalized_and_popular_rpc.sql)
adds:

```sql
alter table public.cafe_visits
  add column order_item_normalized text
    generated always as (lower(btrim(order_item))) stored;
```

Postgres maintains the column on every insert/update. App code never
touches it. Indexed by `(place_id, order_item_normalized)` for the RPC.

### Cross-user RPC

```sql
create or replace function public.popular_orders_for_place(
  p_place_id uuid, p_category text default null
) returns table(order_item text, occurrences bigint)
language sql security definer set search_path = public as $$
  select (array_agg(order_item order by visited_at desc))[1] as order_item,
         count(*) as occurrences
  from public.cafe_visits
  where place_id = p_place_id and order_item_normalized <> ''
    and (p_category is null or category = p_category)
  group by order_item_normalized
  having count(distinct user_id) >= 2
  order by occurrences desc, order_item asc
  limit 8;
$$;
```

`security definer` is necessary because the
[`cafe_visits_select_own`](../../supabase/migrations/20260430_restaurant_cafe_places_visits.sql)
RLS policy restricts `cafe_visits` to a user's own rows. The function
only ever returns aggregated counts and an example display label - no
`user_id` ever leaves the function. `set search_path = public` is the
standard hardening for `security definer`.

The display label for a normalized bucket is the most-recent original
casing (`(array_agg(order_item order by visited_at desc))[1]`), so
"Latte" and "latte" don't both show up - the dropdown gets the casing
the most recent logger used.

### Sweets and Other presets

`Sweets`: Croissant, Cookie, Cake, Tart, Muffin, Ice cream, Soft serve,
Pastry. `Other`: Smoothie, Juice, Hot chocolate, Milkshake, Lemonade,
Soda. Both categories had `null` here before, which is why they fell
back to the typeahead widget. Adding presets means new users (with no
history yet) and unfamiliar cafes (no Tier 2 data) still get useful
suggestions in the dropdown.

## Alternatives considered

- **Native `<select>` like bean region.** Forces a finite enumeration;
  fails for Sweets/Other where users genuinely type one-off names like
  "Black sesame soft serve" or "6 natas combo."
- **Native `<input list>` + `<datalist>`.** Simplest but iOS Safari's
  datalist UX is inconsistent and we couldn't style it to match the
  dark theme. Custom dropdown is ~50 lines and matches the existing
  `OrderAutocomplete` pattern.
- **Defer Tier 2 to a later session.** Considered, then rejected
  because (a) the Community tab makes multi-user cafe data inevitable,
  and (b) shipping the normalized column without the RPC means the
  schema decision lands without the consumer to validate it. Doing
  both at once tests the full path.
- **Trigger-based normalization.** Generated column is the same outcome
  with less moving parts (no trigger to maintain, no possibility of
  divergence between `order_item` and the normalized form).
- **App-side normalization on write.** Would have required updating
  every insert/update payload in `visitPlacesApi.js` and remembering
  to do so for any future write path. Centralizing in the database is
  the single-source-of-truth play.
- **Aggressive normalization** (plural stripping, "the" removal,
  Levenshtein fuzzy match). Real NLP scope creep with diminishing
  returns. `lower(btrim(...))` is the chosen ceiling; revisit if real
  data shows enough variants of the same drink to justify it.
- **Visual badging** for suggestion source ("Your usual" / "Popular
  here"). Adds UI complexity; deferred until ranking confusion is
  observed in practice.
- **Higher privacy floor** (e.g. `>=3` distinct users). `>=2` is the
  minimum that's not just "one user's visit," good enough for the
  current scale. Easy to bump later if needed.

## Consequences

- **No app code maintains `order_item_normalized`.** Postgres does it.
  Every existing row gets the value computed retroactively as part of
  the `add column ... generated always as ... stored` clause - no
  separate backfill statement needed.
- **Tier 2 fails silently.** RPC errors log to dev console only and
  return `[]`. The form stays usable if the RPC is unreachable.
- **Tier 2 only fires when a cafe is matched.** New cafes (no
  `placeId` yet) skip the RPC call entirely - one less network round
  trip on the most common path (logging a brand-new place).
- **`pastOrders` prop dropped from `CafeForm`.** App.jsx call sites
  no longer derive a flat global past-orders list; the component
  derives both `pastOrdersAtCafe` and `pastOrdersForCategory` internally
  from `existingCafes` (which it already had).
- **`_customOrder` flag is gone.** Was only used by `OrderPills` to
  distinguish "user picked a preset" from "user typed Other." The
  combobox treats free typing and pick-from-list identically, so the
  flag becomes meaningless.
- **Files touched / created:**
  [`supabase/migrations/20260503_cafe_order_normalized_and_popular_rpc.sql`](../../supabase/migrations/20260503_cafe_order_normalized_and_popular_rpc.sql) (new),
  [`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js)
  (`fetchPopularOrdersForPlace` helper),
  [`src/constants/cafeCatalog.js`](../../src/constants/cafeCatalog.js)
  (Sweets + Other preset arrays),
  [`src/components/OrderCombobox.jsx`](../../src/components/OrderCombobox.jsx) (new),
  [`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx)
  (combobox wiring + Tier 2 useEffect),
  [`src/App.jsx`](../../src/App.jsx) (drop `pastOrders` prop from
  both `CafeForm` mount sites).
- **Files deleted:** `src/components/OrderPills.jsx`,
  `src/components/OrderAutocomplete.jsx`.

## Out of scope

- **Visual badging for suggestion provenance.** Single deduplicated
  list is enough for v1; revisit if ranking gets confusing.
- **Fuzzy matching beyond `lower(btrim)`.** No plural normalization,
  no "the" stripping, no Levenshtein. Light normalization is the
  chosen ceiling.
- **Backfilling display casing.** `order_item_normalized` is purely a
  grouping key; `order_item` continues to hold whatever the user
  typed, casing preserved.
- **Tea matcha details collapsible.** `t.matchaDetails` exists but is
  not wired today; not touching that here.
- **Sharing infrastructure with future cross-user RPCs** (e.g. Eat
  Together). The popular-orders RPC is purpose-built; if a wider
  pattern emerges later, revisit whether a generic helper is worth
  extracting. Premature for one RPC.
