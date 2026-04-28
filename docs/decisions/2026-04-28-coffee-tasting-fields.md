# Coffee tasting fields in CafeForm

## Context

The "Coffee details" collapsible in `CafeForm` only held bean region + milk
level - both practical drink metadata, no actual tasting signal. The user
wanted richer coffee-review fields. Pro-grade SCA cupping forms evaluate ~10
attributes (Fragrance, Aroma, Flavor, Aftertaste, Acidity, Body, Balance,
Sweetness, Clean Cup, Uniformity, Overall) - too many for a casual log.
Consumer apps (Coffi, CoffeeBee) condense this to ~3-4 sliders + curated
flavor-note chips.

## Decision

Add five new fields to `cafe_visits` and surface them inside the existing
"Coffee details" collapsible (only when `category === "Coffee"`):

- **Roast** (text, optional) - 3 pills: Light / Medium / Dark.
- **Acidity** (numeric, nullable) - 0-10 slider, 0.5 step, labeled
  Smooth -> Bright.
- **Body** (numeric, nullable) - 0-10 slider, Light -> Full.
- **Sweetness** (numeric, nullable) - 0-10 slider, Subtle -> Sweet.
- **Flavor notes** (text[], default `'{}'`) - 9 multi-select chips:
  Chocolate, Fruity, Citrus, Berry, Nutty, Floral, Caramel, Spice, Smoky.

Sliders use the same widget as the main Taste slider (range input, 0-10) but
with a 0.5 step (vs taste's 0.1) - tasting attributes don't benefit from
finer granularity than that. Endpoints are descriptive, not "0 sucks /
10 incredible," because high acidity isn't better than low acidity, just
different.

Bean region (6 pills) and Milk (4 pills) stay verbatim, repositioned below
the new fields inside the same collapsible. Field order top-to-bottom:
Roast, Acidity, Body, Sweetness, Flavor notes, Bean region, Milk.

## Alternatives considered

- **Full SCA cupping form** (10 attributes, 6-10 point scale per attribute,
  defects). Way too heavy for casual logging.
- **JSONB column for the whole tasting bundle.** Easier to evolve schema,
  but loses queryability (we may want flavor-note filters on My Log /
  community feed later, and array columns support GIN indexes natively).
- **Separate component file for `TastingSlider`.** Defined inline inside
  `CafeForm` instead - it's only 12 lines, only used here, and inlining
  keeps the form's structure visible without a hop.
- **Custom "tap to enable" slider** so we could distinguish "didn't rate"
  from "rated as 5." Real UX work for marginal value in a casual log.
  Accepted the conflation: defaulting to 5 is a reasonable neutral.

## Consequences

- New migration [`supabase/migrations/20260502_cafe_tasting_notes.sql`](../../supabase/migrations/20260502_cafe_tasting_notes.sql).
  Filename uses `20260502`, not `20260428` as the original plan suggested,
  because the existing `20260430_restaurant_cafe_places_visits.sql`
  creates `cafe_visits` itself - a `20260428`-dated migration would sort
  *before* table creation and fail on `supabase db reset`. Not a
  semantically meaningful date, just a sort key.
- Acidity / body / sweetness are **nullable** so legacy rows (logged before
  this change) cleanly read back as "not rated" rather than being forced
  into a value. New entries from `INIT_CAFE` start at 5 across the board.
- `cafeVisitInsertPayload` / `cafeVisitUpdatePayload` always send all five
  new fields, defaulting to `null` / `''` / `[]` when the user didn't
  interact - matches the existing pattern for `milk_level` / `bean_region`.
- `mapCafeVisitRow` exposes the new fields in camelCase to the UI shape
  (`flavorNotes`, not `flavor_notes`), parallel to existing renames like
  `order` (vs `order_item`) and `useR` (vs `use_r`).
- The "default 5 vs not rated" conflation in storage is documented here so
  any future analytics knows that a stored 5 may mean "neutral rating" or
  "user didn't open the collapsible." If we ever care, we can add a
  per-field `_rated` boolean later.
- **Display surfaces unchanged.** `CafeGroupRow` / `EntryCard` don't show
  the new fields. They're for capture only in this PR.
- **Files touched:** [`supabase/migrations/20260502_cafe_tasting_notes.sql`](../../supabase/migrations/20260502_cafe_tasting_notes.sql)
  (new), [`src/data/initialData.js`](../../src/data/initialData.js) (INIT_CAFE),
  [`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js)
  (round-trip mapping + insert/update payloads),
  [`src/translations.js`](../../src/translations.js) (en + zh strings for
  labels, slider endpoints, 9 flavor-note chips, 3 roast labels),
  [`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx) (new
  collapsible body + `TastingSlider` inline helper + new fields in
  `buildEntry`).

## Out of scope

- Tea / matcha tasting (`t.matchaDetails` is defined but not wired).
- Showing acidity / body / sweetness / flavor notes in My Log row display,
  community feed, or palette stats.
- Filtering or sorting cafes by tasting attributes.
- Suggesting flavor notes based on past entries.
- Auto-populating defaults for legacy rows.
