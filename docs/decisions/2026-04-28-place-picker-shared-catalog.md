# Decision: Shared-catalog Place Picker for restaurant/café names

## Context

Free-text name entry on the Add forms produced near-duplicate `*_places` rows
across the user base — typos ("Raqu" vs "Raku"), capitalization variants, and
location-suffixed duplicates ("Raku" vs "Raku - SoHo"). The previous typeahead
([`CafeNameInput`](../../src/components/CafeNameInput.jsx)) only suggested from
the **current user's own** log, so newcomers never saw existing canonical rows
and re-spelled the same place their own way.

## Decision

- New shared-catalog component
  [`PlacePicker`](../../src/components/PlacePicker.jsx). Suggestions are pulled
  from the cross-user `restaurant_places` / `cafe_places` tables and rendered as
  `name · city`, so users disambiguate by **city** instead of stuffing location
  into the name. A `+ Add new: "<typed>"` row at the bottom is the only path to
  a brand-new place row.
- The picker tracks a pinned `placeId`. Editing the input after a pick clears
  it, so we never save a mutated name against the wrong place row.
- New helpers `fetchAllRestaurantPlaces` / `fetchAllCafePlaces` in
  [`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js); RLS already
  permits authenticated SELECT on the full `*_places` catalog.
- `ensureRestaurantPlace` / `ensureCafePlace` short-circuit when the caller
  passes a known `placeId` — skip the `ilike` lookup/insert entirely.
- App-side, the catalog is loaded in parallel with the visits fetch and threaded
  into both forms. After every save we `upsertPlace` into local state so newly
  created (or newly observed) places appear in the dropdown immediately without
  a full refetch.
- Existing autofill (cuisine, fusion, category, etc.) now keys off
  `e.placeId === pickedId` instead of `e.name === v` — survives any casing or
  whitespace drift.
- **Place-level basics (cuisine, cuisine2, isFusion, city) come from the
  canonical `restaurant_places` row**, not the user's own past visits. Picking
  a place fills in the basics section even when the current user has never
  logged a visit there. Visit-level fields (portions, wait reset, useR,
  repeatability) still layer in from the user's own log when present.

## Alternatives considered

- **Google Places Autocomplete** — strongest dedup (canonical name +
  `place_id` + address), but adds an API key, billing, and a third-party
  dependency. Deferred; schema can be extended later (`google_place_id` column)
  without breaking the picker.
- **Pure normalization on save** (lowercase, strip "- {neighborhood}" suffix) —
  fragile, doesn't help with typos, and silently merges legitimately distinct
  places.
- **Admin merge tool over duplicates** — reactive, not preventive; still useful
  later for cleanup but doesn't solve the input-time problem.

## Consequences

- First-time visit to a place still creates the row from typed text — same as
  today, but now it's an explicit "Add new" choice rather than the default.
- Editing the venue metadata on a shared place row still affects all visits
  pointing at that row (same caveat as the original
  [places/visits decision](2026-04-30-places-visits-supabase-schema.md)).
- No fuzzy "did you mean…?" guard yet. If duplicates still leak (e.g. a user
  ignores the dropdown and re-types a near-match), revisit with a soft warning
  before insert.
- [`CafeNameInput`](../../src/components/CafeNameInput.jsx) is removed —
  superseded by `PlacePicker`.

**Primary files:**
[`src/components/PlacePicker.jsx`](../../src/components/PlacePicker.jsx),
[`src/components/RestForm.jsx`](../../src/components/RestForm.jsx),
[`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx),
[`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js),
[`src/App.jsx`](../../src/App.jsx).
