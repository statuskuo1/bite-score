# Bean origin countries instead of broad geos

## Context

The `bean_region` field on `cafe_visits` previously offered 6 broad-geo
options (Africa, Central America, South America, Asia-Pacific, Blend,
Unknown). Specialty cafe menus almost always label single-origin coffees
at the country level (Ethiopia, Colombia, Brazil, etc.), so picking
"Africa" felt vague compared to what a user actually sees written on the
bag or menu. The user wanted country-level granularity.

## Decision

Replace the 6 broad-geo options with a tight Tier-1 list of **8 origin
countries** that dominate specialty cafe menus globally:

```
Ethiopia, Colombia, Brazil, Guatemala, Kenya, Sumatra, Blend, Other
```

Bucketed at the **country** level for storage (`bean_region` column
keeps its name but now stores country names), and rolled up to broad
regions on display surfaces that benefit from coarser grouping:

- **Form dropdown** ([`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx)):
  shows the 8 countries.
- **Bean breakdown donut** ([`src/components/DrinksPalette.jsx`](../../src/components/DrinksPalette.jsx)):
  buckets via `regionOf(beanRegion)` so the 5-color palette stays
  legible (Ethiopia + Kenya combine into "Africa", etc.).
- **Cafe filter chips** ([`src/App.jsx`](../../src/App.jsx)):
  remain at region level (Africa / Central America / South America /
  Asia-Pacific / Blend), comparing via `regionOf(e.beanRegion)` so
  picking "South America" matches both legacy rows tagged "South
  America" and new rows tagged "Colombia" or "Brazil".

Centralized to a single source of truth in
[`src/constants/coffeeConstants.js`](../../src/constants/coffeeConstants.js),
which exports `BEAN_ORIGINS`, `BEAN_REGIONS`, `BEAN_REGION_COLORS`, and
a `regionOf(origin)` helper.

## Alternatives considered

- **Keep broad geos.** Simpler, but loses the menu-vocabulary match the
  user actually wanted - this whole change is about specificity.
- **Comprehensive ~22-country list** (Tier 1 + Tier 2 + Tier 3:
  Ethiopia, Colombia, Brazil, Guatemala, Kenya, Sumatra, Costa Rica,
  Honduras, Mexico, Peru, Panama, Nicaragua, Rwanda, Burundi, Papua New
  Guinea, Yemen, Vietnam, Hawaii, Jamaica, Bolivia, Tanzania, Uganda).
  Rejected: dropdown becomes a chore to scroll, and every country past
  the top 6 hits maybe 1-2 entries per user. `Other` covers the long
  tail without bloating the picker.
- **Country-level slices in the donut.** With 8+ slice colors the donut
  becomes a confusing rainbow at the size we render it. Rollup keeps
  the existing 5-color palette and at-a-glance read.
- **Datalist (curated suggestions, free-text input).** More flexibility
  but loses the constraint that lets us roll up consistently. We'd have
  to either fuzzy-match free-text to regions or accept "Ethiopian" /
  "ethiopia" / "ETH" as separate buckets.
- **Backfill existing `bean_region` rows from "Africa" -> "Ethiopia"**
  etc. Lossy guess - "Africa" might mean Kenya, Burundi, anywhere.
  Leave legacy values intact and let `regionOf()` keep them in the
  right bucket.

## Consequences

- **Legacy values keep working.** `regionOf()` maps the old broad-geo
  strings (Africa, Central America, South America, Asia-Pacific,
  Unknown) to themselves (Unknown -> Other), so the donut, filter, and
  per-bean stats all behave for rows logged before this change.
- **CafeForm preserves legacy values on edit.** When editing an entry
  whose `beanRegion` isn't in `BEAN_ORIGINS`, an extra `<option>` with
  ` (legacy)` suffix is appended so the select doesn't render blank.
  Saving without changing it round-trips the legacy string unchanged.
- **No DB migration.** `bean_region` is still a free-form `text`
  column with no enum constraint, so country names slot in without
  schema changes. Mixed legacy + new values coexist.
- **The personality line** in `DrinksPalette` ("Your beans tend to come
  from X.") now reads at country granularity for new entries, which is
  a small free win - "Your beans tend to come from Colombia" lands
  better than "Your beans tend to come from South America."
- **Files touched:**
  [`src/constants/coffeeConstants.js`](../../src/constants/coffeeConstants.js)
  (new),
  [`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx)
  (dropdown options + legacy fallback),
  [`src/components/DrinksPalette.jsx`](../../src/components/DrinksPalette.jsx)
  (donut bucketing via `regionOf`),
  [`src/App.jsx`](../../src/App.jsx) (filter chips + equality check).

## Out of scope

- **Translating country names to zh-TW.** Country names render
  literally from `BEAN_ORIGINS`. Localizing them is a separate i18n
  pass.
- **Country-level visualization.** Donut stays at region level by
  design; no country leaderboard added.
- **Backfilling Supabase rows.** Legacy values map cleanly via
  `regionOf` so a destructive rewrite isn't worth the risk.
- **Adding more origins to Tier 1.** If users start picking `Other`
  often, that's a signal to expand - revisit then.
