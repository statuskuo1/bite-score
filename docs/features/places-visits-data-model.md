---
title: Places & visits data model
scope:
  - src/utils/visitPlacesApi.js
  - src/components/PlacePicker.jsx
  - supabase/migrations/20260430_restaurant_cafe_places_visits.sql
  - supabase/migrations/20260502_cafe_tasting_notes.sql
  - supabase/migrations/20260503_cafe_order_normalized_and_popular_rpc.sql
last_reviewed: 2026-04-28
---

## Purpose

Why we have **places** and **visits** as separate tables, what each row holds, and how the client flattens the join into one entry per visit.

## Schema (current)

From [`supabase/migrations/20260430_restaurant_cafe_places_visits.sql`](../../supabase/migrations/20260430_restaurant_cafe_places_visits.sql):

### `restaurant_places`

Venue identity, shared across users.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | not null |
| `cuisine` | `text` | default `''` |
| `cuisine2` | `text` | default `''` (for fusion) |
| `is_fusion` | `boolean` | default false |
| `city` | `text` | default `''` |

### `restaurant_visits`

One row per visit, one user.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `place_id` | `uuid` FK → `restaurant_places(id)` | `on delete restrict` |
| `user_id` | `uuid` FK → `auth.users(id)` | `on delete cascade` |
| `taste`, `cost`, `portions`, `wait` | `numeric` | scoring inputs |
| `repeatability` | `smallint` | 0–3 |
| `use_r` | `boolean` | apply repeatability multiplier |
| `notes` | `text` | |
| `visited_at` | `timestamptz` | order by this — there is **no** `created_at` |

### `cafe_places` / `cafe_visits`

Same shape as the restaurant tables, plus:

- `cafe_places`: `name`, `city`.
- `cafe_visits`: `category` (`Coffee` / `Drinks` / `Sweets`), `order_item`, plus tasting fields added by `20260502_cafe_tasting_notes.sql`: `bean_region`, `milk_level`, `roast`, `acidity`, `body`, `sweetness`, `flavor_notes` (text array).

### `profiles`

`id` FK → `auth.users(id)`, plus `username`, `display_name`, `avatar_url`. Visit rows can join via `visits.user_id → profiles(id)` to populate `author`. See [`features/auth-rls.md`](auth-rls.md).

## Why split

- **Identity vs experience**: a venue exists once; many users visit. Splitting prevents stale duplicates (e.g. casing drift in `name`) and lets stats aggregate per place.
- **Shared catalog**: place tables are SELECT-able by all authenticated users, so PlacePicker autocomplete works cross-user without leaking visit data.
- **Privacy**: visits are own-row-only via RLS, so per-user logs stay private.

## Read path (single visit list)

PostgREST embedded resource — *not* raw SQL — fired from [`fetchRestaurantVisitsJoined` / `fetchCafeVisitsJoined`](../../src/utils/visitPlacesApi.js):

```
restaurant_visits
  .select("*, restaurant_places(name, cuisine, cuisine2, is_fusion, city)")
  .eq("user_id", userId)
  .order("visited_at", { ascending: false })
```

Author profiles are attached in a second query (`attachAuthorProfiles`) instead of via embed, because the FK `visits.user_id → profiles(id)` is added in a later migration and embed support depends on PostgREST's view of FKs at runtime.

## Mappers (flatten the embed)

[`mapRestaurantVisitRow`](../../src/utils/visitPlacesApi.js) flattens `{ ...visit, ...restaurant_places[0] }` and outputs the UI shape:

```
{ id, placeId, name, cuisine, cuisine2, isFusion, city, taste, cost, portions,
  wait, repeatability, useR, notes, letter, ownerId, visitedAt,
  authorUsername, authorDisplayName, authorAvatarUrl }
```

`mapCafeVisitRow` does the equivalent, plus all tasting fields.

The embed can come back as either an object or a single-element array depending on PostgREST's introspection — `normalizeRestaurantVisitEmbed` / `normalizeCafeVisitEmbed` collapse that to one shape.

## Write path

- **Place**: `ensureRestaurantPlace` / `ensureCafePlace` — case-insensitive `ilike` lookup; if not found, insert. Pass `placeId` from PlacePicker to short-circuit and avoid creating near-duplicates.
- **Visit**: `restaurantVisitInsertPayload(placeId, userId, e)` / `cafeVisitInsertPayload(...)`; update payloads omit `user_id` so RLS doesn't reject ownership transfers.
- The shared place catalog (`fetchAllRestaurantPlaces` / `fetchAllCafePlaces`) is loaded once on auth boot and cached in `App` state for PlacePicker.

## Aggregates (Community Global)

`fetchAggregatedRestaurantPlaces` / `fetchAggregatedCafePlaces` group all visits per place, return per-place mean inputs and visit counts. The viewer then applies their own weights via `calcBiteOutOf10` / `calcCafeOutOf10` (mean-then-BITE — see [`features/scoring.md`](scoring.md)).

## Decisions

- [2026-04-30 — Places & visits Supabase schema](../decisions/2026-04-30-places-visits-supabase-schema.md)
- [2026-04-29 — Assign legacy visits to owner](../decisions/2026-04-29-assign-legacy-visits-to-owner.md)
- [2026-04-28 — Place picker shared catalog](../decisions/2026-04-28-place-picker-shared-catalog.md)
- [2026-04-28 — Order combobox & popular orders](../decisions/2026-04-28-order-combobox-and-popular-orders.md)
- [2026-04-28 — Coffee tasting fields](../decisions/2026-04-28-coffee-tasting-fields.md)
- [2026-04-28 — Bean origin countries](../decisions/2026-04-28-bean-origin-countries.md)
- [2026-04-27 — My Log fetch query shape](../decisions/2026-04-27-my-log-fetch-query-shape.md)
- [2026-04-27 — My Log visits two-query merge](../decisions/2026-04-27-my-log-visits-two-query-merge.md)
