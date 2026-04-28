# Cafe form tweaks: items section, button row, coffee details cleanup

## Context

Follow-up tweaks after the initial cafe-form unification + coffee tasting
fields shipped earlier today. The user's feedback after using it:

1. The collapsed cafe row in My Log was listing every order in the subtitle
   ("Flat White, Cappuccino, ..."), which got noisy fast.
2. "The basics" had drifted to include cafe-specific bits (Category + Order)
   that don't really fit "basics" semantics.
3. "Save & add another" sat as a separate full-width button below
   Cancel/Save, which felt out of place.
4. Coffee details was visually cluttered and Milk was confusing.

## Decision

### 1. CafeGroupRow subtitle

`[`src/components/CafeGroupRow.jsx`](../../src/components/CafeGroupRow.jsx)`
no longer joins order strings into the subtitle; the collapsed row shows just
`group[0].category` (e.g. "Coffee" / "Sweets"). Order info is still visible
inside the visits modal.

### 2. CafeForm sections

[`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx) regrouped:

- **The basics** - just Name + City. Mirrors restaurant's "basics" semantics
  (name, location).
- **Items** (new section, label `t.cafeItems`) - Category pills + Order
  field + Coffee details collapsible (only when category=Coffee).
- **Score inputs** / **Repeatability** / **Notes** - unchanged.

This breaks the "byte-identical sections" goal we had with `RestForm`, but
the user explicitly accepted that trade. Rest's "basics" stays Cuisine-heavy
because cuisine *is* a basic restaurant property; cafe's "what did you
order" deserves its own section header.

### 3. Three-button action row

Cancel | Save & add another | Save are now siblings in a single
`display:flex` row with `flex:1 / 2 / 2` weights. The middle button is only
rendered for new entries (`!initial.id && onSaveAndContinue`). Style: dashed
border + accent-color text (clearly secondary), vs the solid accent fill on
Save (clearly primary). Replaces the previous full-width button below.

### 4. Coffee details cleanup

- **Bean region** is now a native `<select>` instead of a 6-pill grid. Same
  options, much less vertical space, native single-select semantics.
- **Flavor notes** moved into a **nested `<details>`** inside the Coffee
  details collapsible. Closed state shows `Flavor notes: Berry, Chocolate`
  (or `(optional)` if none picked); open state reveals the 9 chips. Keeps
  the expressive multi-select chip UX but only when the user actually wants
  it.
- **Milk** removed from the form entirely. The `milk_level` column stays in
  the DB and `mapCafeVisitRow` still surfaces `milkLevel` so legacy rows
  continue to populate the existing My Log "Milk" filter
  ([`src/App.jsx`](../../src/App.jsx) line 320 / 622-635) and
  [`src/components/DrinksPalette.jsx`](../../src/components/DrinksPalette.jsx)'
  milk-personality stat. New entries simply don't contribute milk data.
  Those orphaned consumers will degrade gracefully as new data accumulates;
  flagged below as a follow-up.

## Alternatives considered

- **Keep order list in the subtitle but truncate.** Truncation adds visual
  noise without adding signal. Visits modal already covers it.
- **Custom multi-select dropdown component for flavor notes.** A bespoke
  popover/dropdown would be cleaner than nested `<details>`, but it'd be a
  new component file just for this; nested `<details>` solves the
  clutter problem with zero new dependencies.
- **Native `<select multiple>` for flavor notes.** Renders as a sized
  scrolling list; ugly on mobile, no checkbox affordance, hard to discover.
- **Full Milk removal (DB column drop + filter UI removal + palette stat
  removal).** Too aggressive for one tweak: would break stats over historical
  data. Doing the surgical removal preserves the past while stopping new
  collection.

## Consequences

- **Files touched:**
  [`src/components/CafeGroupRow.jsx`](../../src/components/CafeGroupRow.jsx),
  [`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx),
  [`src/data/initialData.js`](../../src/data/initialData.js)
  (`INIT_CAFE.milkLevel` removed),
  [`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js)
  (`milk_level` removed from insert/update payloads, kept in
  `mapCafeVisitRow`).
- **Save & add another** still keeps `name` + `city` between iterations,
  unchanged from the prior behavior. Just rehoused visually.
- **Form structure now diverges from restaurant** by design - "Items" is a
  cafe-only section. RestForm keeps its current shape.
- **Coffee details vertical footprint** is roughly halved when the user
  doesn't open the flavor-notes nested collapsible. Bean region went from a
  3-column grid (3 rows) to a single `<select>` row.
- **Future cleanup candidates** (separate ticket when ready):
  - Milk filter pill in My Log toolbar will eventually look stale; either
    remove it or replace with a "Roast" filter.
  - DrinksPalette milk-personality card likewise.
  - Add an Acidity / Body / Sweetness summary somewhere in the palette to
    actually use the new tasting data we're collecting.

## Out of scope

- Dropping the `milk_level` DB column.
- Removing the milk filter or the milk-personality palette card.
- Surfacing the new tasting fields anywhere besides the form.
- Adding a Roast filter or roast palette card.
