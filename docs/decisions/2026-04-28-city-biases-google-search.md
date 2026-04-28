# Decision: City field drives Google Places location bias

## Context

The add forms collect both a free-text City and a venue name (via
[`PlacePicker`](../../src/components/PlacePicker.jsx)). City sat *below* the
name, and the Google Text Search call ignored it — Google fell back to the
caller's IP for location bias, so an NYC user trying to log a Chicago spot
got NYC predictions and had to manually correct everything. We also want to
keep the door open for travel and global-dining use cases (logging trips,
later: "places friends I trust loved in Tokyo") without painting ourselves
into a corner.

## Decision

- Move the City input **above** the venue name in both
  [`RestForm.jsx`](../../src/components/RestForm.jsx) and
  [`CafeForm.jsx`](../../src/components/CafeForm.jsx) so the user sets
  geographic context before searching.
- Plumb `cityHint` through [`PlacePicker`](../../src/components/PlacePicker.jsx)
  → [`searchGooglePlaces`](../../src/utils/googlePlacesApi.js).
- In `searchGooglePlaces`, when `cityHint` is non-empty, build the request as
  `textQuery: \`${q} ${cityHint}\``. Empty string → no change to behavior
  (Google falls back to IP bias as before).
- Add `cityHint` to the `useEffect` dependency array so editing City
  refreshes predictions in place without remounting the picker.
- The pre-existing coord-based `locationBias` parameter stays in the
  function signature, untouched. A future enhancement can geocode City →
  lat/lng once and layer that on top.

## Alternatives considered

- **Geocode City → lat/lng and pass `locationBias`** (radius-based bias).
  More precise, especially for ambiguous names like "Springfield", but
  requires another API (Geocoding) plus a cache layer. Defer until we hit a
  case where Text Search's free-text city handling isn't good enough.
- **Filter the local `*_places` catalog by City too**. Out of scope — the
  user's symptom is Google returning the wrong city, not the catalog.
  Catalog rows already carry `city`/`verified_city`; if it becomes a
  problem we can add a city-aware sort in a separate change.
- **Fall back to the place's stored city when picking a catalog hit that
  contradicts the typed city**. Existing autopopulate behavior already
  prefers the place row's `verified_city` (intentional — it's the canonical
  source of truth). Not changing that here.

## Consequences

- City is now the lead-in for the form. Saving still requires `name`, `cost`,
  and `city`, so the validation surface is unchanged.
- Google Text Search results scale to any city worldwide for free —
  travel-mode logging works today (type "Tokyo", search "afuri" → Tokyo
  ramen results).
- The "places friends I trust loved in Tokyo" feature has no schema blocker:
  `restaurant_visits` already join to `restaurant_places(city)`, and
  `aggregatePlaces` in
  [`visitPlacesApi.js`](../../src/utils/visitPlacesApi.js) can group by
  `(placeId)` filtered to friend `user_id`s + city. That's a future feature,
  not part of this change.
- Switching to a coord-based bias later is a single-call diff: geocode
  `cityHint` once, pass `locationBias` alongside; the textQuery hint can stay
  for redundancy or be dropped.

**Primary files**:
[`src/components/RestForm.jsx`](../../src/components/RestForm.jsx),
[`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx),
[`src/components/PlacePicker.jsx`](../../src/components/PlacePicker.jsx),
[`src/utils/googlePlacesApi.js`](../../src/utils/googlePlacesApi.js).
