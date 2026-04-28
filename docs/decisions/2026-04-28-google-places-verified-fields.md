# Decision: Google Places verification on shared `*_places` rows

## Context

Autopopulate (cuisine / city / canonical name) used to depend on whatever the
**first user** typed for a place — typos and casing drift leaked into the
shared catalog and stuck around forever (see
[`2026-04-28-place-picker-shared-catalog.md`](2026-04-28-place-picker-shared-catalog.md)
for the picker that exposed this). We wanted authoritative venue data so the
form is correct on first contact, capped to a fraction of Google's $200/mo
free tier, with an admin alert before we ever block users.

## Decision

- **Live Google Autocomplete in [`PlacePicker`](../../src/components/PlacePicker.jsx)**:
  catalog matches still render first; once `q.length >= 3` and there's no
  exact catalog hit, predictions appear in a "via Google" section beneath.
  Picking a Google prediction calls Place Details, inserts a verified row,
  and treats the result like any other catalog hit.
- **Edge Functions hold the API key**:
  [`supabase/functions/places-search`](../../supabase/functions/places-search/index.ts)
  proxies Autocomplete (New);
  [`supabase/functions/places-resolve`](../../supabase/functions/places-resolve/index.ts)
  proxies Place Details (New) and upserts the `*_places` row. Browser never
  sees `GOOGLE_MAPS_API_KEY`. Both functions verify the caller's JWT via
  [`_shared/places.ts`](../../supabase/functions/_shared/places.ts) — anon
  callers are rejected.
- **Schema additions**
  ([`20260505_places_google_verified.sql`](../../supabase/migrations/20260505_places_google_verified.sql)):
  `google_place_id`, `verified_name`, `verified_cuisine` (restaurants only),
  `verified_city`, `lat`, `lng`, `verified_at`. Unique partial index on
  `google_place_id` enforces dedup across users / racing inserts.
- **Catalog read prefers verified fields**:
  [`fetchAllRestaurantPlaces` / `fetchAllCafePlaces`](../../src/utils/visitPlacesApi.js)
  surface the new columns; the picker's `displayName` / `displayCity`
  helpers and [`RestForm.jsx`](../../src/components/RestForm.jsx) autopopulate
  treat `verified_*` as the source of truth, falling back to user-typed when
  null. Existing rows stay as-is; no backfill.
- **Budget guardrail**: monthly counter
  (`places_api_usage_increment` SECURITY DEFINER RPC) atomically increments per
  Google call. **Soft cap (5000)** logs a `places_api_alerts` row + fires the
  optional Slack/Discord webhook (`PLACES_API_ALERT_WEBHOOK_URL`). **Hard cap
  (6000)** still serves the search request but returns
  `{ predictions: [], capped: true }` and the picker silently falls back to
  the manual "+ Add new" branch for the rest of the page session. Resolve
  calls past the hard cap return HTTP 429.
- **Session tokens** are minted client-side in `PlacePicker` and rotated after
  each successful resolve so Google bundles the autocomplete + details billing
  into one session (~$0.020 / unique place instead of $0.0285 + $0.020).

### Cost model

Autocomplete (New) is ~$0.0285/call, Place Details (New) ~$0.020/call. With
session tokens bundling them, a "complete" pick is ~$0.020. $200/mo free tier
≈ 10,000+ verified places per month. Defaults reserve ~80% (soft) / ~95%
(hard) headroom, configurable via env.

### Alert / "ping me" channel

Two layers, additive:

1. Always: insert into `places_api_alerts` (queryable via Supabase Studio).
2. Optional: post to `PLACES_API_ALERT_WEBHOOK_URL` — Slack/Discord webhook
   format works (`{ text, content, ...row }` body covers both).

## Alternatives considered

- **Direct client call with a referrer-restricted browser key** — rejected:
  ships the key publicly, no place to enforce dedup or budget caps, no
  session-token billing.
- **Behind-the-scenes text search after "+ Add new"** (no live UI) — fewer
  Google calls but worse UX; user can't see what Google thinks before
  committing. Rejected.
- **Backfill existing rows** — deferred. Current `*_places` rows stay
  unverified; verified data only attaches to **newly-resolved** rows. We can
  run a one-shot job later (Edge Function calling Place Search by name+city)
  if we want canonical data on the legacy long tail.
- **Email alerts via Resend / Supabase SMTP** — out of scope for v1; the
  webhook covers the same need with less moving parts.

## Consequences

- New env requirement (server-only): `GOOGLE_MAPS_API_KEY` plus optional
  `PLACES_API_SOFT_CAP`, `PLACES_API_HARD_CAP`,
  `PLACES_API_ALERT_WEBHOOK_URL`. See
  [`supabase/.env.example`](../../supabase/.env.example).
- Picker's "+ Add new" branch is now a **fallback** (used when typed query is
  too short, when Google has no predictions, or when the hard cap fires) —
  not the default path for new places. Most new places will have
  `google_place_id` from day one.
- `upsertPlace` in [`App.jsx`](../../src/App.jsx) now merges fields rather
  than skipping when a row already exists, so `verified_*` data populated
  later doesn't get dropped. Empty values never overwrite non-empty existing
  ones.
- The cuisine mapping in
  [`_shared/places.ts`](../../supabase/functions/_shared/places.ts) is small
  (`CUISINE_MAP`) and will need extending as we encounter unmapped Google
  primary types — alternative is to log unmapped values into
  `places_api_alerts.details` so we notice them. Worth doing if many leak
  through.
- No admin UI for alerts yet; for now ykuo queries `places_api_alerts`
  directly (or watches the webhook channel).

**Primary files**:
[`supabase/migrations/20260505_places_google_verified.sql`](../../supabase/migrations/20260505_places_google_verified.sql),
[`supabase/functions/places-search/index.ts`](../../supabase/functions/places-search/index.ts),
[`supabase/functions/places-resolve/index.ts`](../../supabase/functions/places-resolve/index.ts),
[`supabase/functions/_shared/places.ts`](../../supabase/functions/_shared/places.ts),
[`supabase/functions/_shared/cors.ts`](../../supabase/functions/_shared/cors.ts),
[`src/utils/googlePlacesApi.js`](../../src/utils/googlePlacesApi.js),
[`src/components/PlacePicker.jsx`](../../src/components/PlacePicker.jsx),
[`src/components/RestForm.jsx`](../../src/components/RestForm.jsx),
[`src/components/CafeForm.jsx`](../../src/components/CafeForm.jsx),
[`src/utils/visitPlacesApi.js`](../../src/utils/visitPlacesApi.js),
[`src/App.jsx`](../../src/App.jsx),
[`supabase/.env.example`](../../supabase/.env.example),
[`supabase/config.toml`](../../supabase/config.toml).
