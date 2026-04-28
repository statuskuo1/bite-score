# Unify cafe + restaurant forms

## Context

`RestForm` and `CafeForm` had drifted into noticeably different shapes even
though most of their content (basics, scoring inputs, repeatability, notes) is
the same. `CafeForm` carried a multi-item editor (`items[]` + `CafeItemBlock`)
that had no analog on the restaurant side, mixed Wait into "The basics" while
rest put it under "Score Inputs," and surfaced Coffee-only extras (bean region,
milk pills) inline so the form's height jumped depending on category. The user
wanted "pretty much identical forms" with the only obvious difference being
Cuisine on rest vs the cafe-specific category/order block.

## Decision

Restructure `CafeForm` to mirror `RestForm` section-by-section:

1. `FormScoreHeader` (already shared)
2. **The basics** - name, then domain block (cafe: Category 4-pill grid +
   Order field + collapsible Coffee details when `category === "Coffee"`),
   then City
3. **Score inputs** - Taste slider, then Cost / Portions / Wait row (Wait
   moved here from basics)
4. **Repeatability** - identical to rest
5. **Notes** - identical to rest
6. Buttons - Cancel | Save | (cafe only, when `!initial.id`) "Save & add
   another"

Specific decisions:

- **Multi-item is gone.** Each cafe entry is one DB row (data model already
  worked this way). The "Save & add another" button replaces the in-form
  `items[]` UX. It calls a new `onSaveAndContinue` prop, then resets the
  form's local state to `INIT_CAFE` defaults while keeping `name` + `city`.
  Visible only on new entries (`!initial.id`).
- **`CafeItemBlock` deleted.** Its category/order/coffee-extras markup
  collapsed inline into `CafeForm` since there's no longer a per-item loop.
- **Coffee details (bean region + milk) hidden behind a native
  `<details>` collapsible** with `t.coffeeDetails` summary. Renders only
  when `category === "Coffee"` so other categories don't see the empty
  affordance. Keeps the form's vertical rhythm category-independent and
  uses zero extra component code.
- **City added to cafes.** `INIT_CAFE` gets `city: ""`. Both `<CafeForm>`
  callsites in `App.jsx` reuse the existing `lastCity.current` ref so a
  single ref drives both forms and "Save & add another" carries the city
  forward.
- **`insertCafeEntry` extracted** in `App.jsx` so `onSave` (navigate back to
  log) and `onSaveAndContinue` (stay on form, scroll to top) share the
  Supabase insert path. Also drops the `Array.isArray(entries)` unwrap that
  multi-item required.
- **No "Save & add another" on restaurant.** A restaurant entry is one
  visit by design.
- **No Fusion toggle on cafe.** Fusion is a cuisine concept.
- **`OrderPills` / `OrderAutocomplete` keep their dual-widget behavior**
  (pills for Coffee/Tea, free-text autocomplete for Sweets/Other). It's the
  one place the cafe domain block meaningfully diverges from rest's
  `CuisineInput`.

## Alternatives considered

- **Keep `items[]` but slim each item to Category + Order + Taste + Cost,
  share Wait/Repeat/Notes at visit level.** Less typing for "coffee +
  pastry" trips, but the form still didn't structurally match rest. User
  preferred the cleaner "1 entry = 1 save" with an explicit
  re-populate-and-continue path.
- **Drop Coffee extras (bean region, milk) entirely.** Tempting for
  simplicity, but they're real signal for coffee drinkers and live cleanly
  inside a `<details>` so the cost is just one extra click when wanted.
- **Single-button "Save" with a checkbox for "and add another."** Two
  buttons reads better: the second action is rare and doesn't deserve a
  persistent toggle.

## Consequences

- `CafeForm` is now a single flat state object (`f`) with the same
  `inp(k,v)` setter pattern as `RestForm` - much easier to compare diffs.
- New entries seeded with `lastCity.current` regardless of which form (rest
  or cafe) last set it. Existing data doesn't migrate; cities backfill as
  users log new visits.
- Multi-item cafe visits already in the DB are still rendered correctly by
  `CafeGroupRow` (it groups by name) - this change only affects how new
  entries are *created*, not how historical ones are displayed.
- Files touched: [`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx)
  (rewritten), [`src/App.jsx`](../../src/App.jsx) (both `<CafeForm>` callsites
  + new `insertCafeEntry` helper), [`src/data/initialData.js`](../../src/data/initialData.js)
  (`INIT_CAFE.city`), [`src/translations.js`](../../src/translations.js)
  (`t.saveAndAddAnother` en + zh).
- Files deleted: [`src/components/CafeItemBlock.jsx`](../../src/components/CafeItemBlock.jsx).
- Translations: only one new string (`saveAndAddAnother`); `coffeeDetails`
  was already defined.

## Out of scope

- Restaurant getting "Save & add another."
- Removing bean region / milk fields entirely.
- Persisting "last category" or "last order" across sessions.
- Touching `OrderPills` / `OrderAutocomplete` internals.
