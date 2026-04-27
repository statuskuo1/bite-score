# BITE Score — system architecture (agent reference)

Last reviewed from codebase snapshot (Vite + React 18 SPA). Use this when implementing Supabase Auth, per-user data, or multi-rater aggregates.

## Product intent

Single-page **restaurant and café rating** experience: users record visits (taste, cost, portions, wait, repeatability, notes), see **BITE** scores derived from a formula, filter/sort/group listings, and track **quest** progress (A–Z cuisines, regional cuisine checklist). The product may evolve toward **social** discovery; **signed-in visit logs are private per user** (RLS + client filter). Aggregates across users are not implemented in-app yet. **Supabase Auth** (magic link + optional Google) backs sign-in; **RLS** enforces **own-row** access on visit tables (`restaurant_visits` / `cafe_visits`) and authenticated read/write on shared **place** tables (`restaurant_places` / `cafe_places`). The anon client **does not write** global `settings` (curators use SQL / service role). See [`docs/SUPABASE_AUTH_SETUP.md`](../docs/SUPABASE_AUTH_SETUP.md) and migrations under [`supabase/migrations/`](../supabase/migrations/).

## Tech stack

| Layer | Choice |
|--------|--------|
| UI | React 18 (`src/App.jsx` is the main shell; many presentational components under `src/components/`) |
| Build | Vite 6 (`vite.config.js`, `@vitejs/plugin-react`) |
| Data / backend | Supabase (`@supabase/supabase-js`), anon client in `src/config/supabaseClient.js` via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| i18n | `LangContext` + `translations.js`; language persisted in `localStorage` (`bite_lang`) |
| State | `useReducer` + `logReducer.js` for restaurant “entries”; `useState` for cafés, UI, filters; **`AuthContext`** exposes `user`, `session`, **`authReady`** |

No React Router — **views** are a string on reducer state (`log`, `add`, `palette`, `community`, `suggest`, `faq`) plus local edit modes (`editR`, `editC`). Quest UI lives inline under **My Taste → Restaurants** (`QuestsPaletteSection`), not as its own root view.

## Runtime data flow

1. **Boot**: `App` mounts with **empty** restaurant/café state until **`authReady`**. If the user is **signed out**, no seed data is shown: a **sign-in gate** blocks the log until authentication. If **signed in**, that user’s **visits** are loaded with **`place`** rows embedded via Supabase join (`restaurant_visits` + `restaurant_places`, `cafe_visits` + `cafe_places`). Demo lists in `initialData.js` are **not** used for anonymous browsing anymore.
2. **Supabase load** (`useEffect`, depends on `authReady` + `user.id`): fetches **`settings`** (read-only from the client’s perspective); fetches visits only when signed in (`user_id` filter + RLS). Mapping lives in [`src/utils/visitPlacesApi.js`](../src/utils/visitPlacesApi.js). Hydrates FAQ overrides and welcome copy from `settings` where applicable. **A–Z quest letter toggles** for signed-in users override from **`localStorage`** (`bite_questLetters_<userId>`) when present; otherwise defaults / `settings.questLetters` bootstrap.
3. **Scores**: never stored as a single “BITE” column in app code for restaurants; **computed on the fly** in the UI via `src/utils/scoring.js` (`calcBiteOutOf10`, `calcCafeOutOf10`, built on raw `calcBite` / `calcCafe`, weights, repeatability).
4. **Mutations**: restaurant/café rows go through **`App.jsx`**. Global **`settings`** are not written from the browser client.

## Supabase schema (as implied by the client)

### `restaurant_places` / `restaurant_visits`

Places hold venue identity: `name`, `cuisine`, `cuisine2`, `is_fusion`, `city`. Visits hold per-visit scores: `place_id`, `user_id`, `taste`, `cost`, `portions`, `wait`, `repeatability`, `use_r`, `notes`, `visited_at`. The UI flattens join → one object per visit (`placeId`, `ownerId` ← `user_id`, `letter` from cuisine).

Adds resolve place by **case-insensitive name** (`ilike`); insert place if missing, then insert visit.

### `cafe_places` / `cafe_visits`

Places: `name`, `city`. Visits: `place_id`, `user_id`, `category`, `order_item`, scoring fields, `visited_at`. UI maps `order_item` ↔ `order`, snake_case ↔ camelCase like before.

Adds resolve café place by name (`ilike`); insert place if missing; batch café items share one `place_id`.

### `profiles`

`id` (FK to `auth.users`), `username`, `display_name`, `avatar_url`, optional legacy `is_admin`. Sign-up trigger fills names/avatar from OAuth **`raw_user_meta_data`** (see [`20260431_profiles_display_leaderboard.sql`](../supabase/migrations/20260431_profiles_display_leaderboard.sql)). Client [`profileApi.js`](../src/utils/profileApi.js) **`ensureProfile`** patches missing fields after login. **`AuthContext`** exposes **`displayName`** for the shell; visit rows embed **`author:profiles`** via FK `visits.user_id → profiles(id)`.

### `settings`

Key-value table: rows have `key` and `value` (string). Known keys:

- `questLetters` — optional bootstrap for A–Z quest UI when no per-user `localStorage`  
- `faq_override_{index}` — FAQ answer overrides (maintain via SQL / service role)  
- `welcome_{en|zh}_title`, `welcome_{en|zh}_body` — welcome modal copy  

Client writes to `settings` are **disabled** under current RLS (see [`20260428_flat_user_rls_no_admin.sql`](../supabase/migrations/20260428_flat_user_rls_no_admin.sql)).

## Scoring module (`src/utils/scoring.js`)

- **Restaurants (display)**: `calcBiteOutOf10(...)` — raw weighted score `calcBite` (taste / bang-per-buck / wait, optional `applyR`), divided by `calcMaxBite(weights)` (best case: taste 10, zero buck/wait penalty, 3★), ×10, clamped to **0–10**. Weights default `{ taste: 50, bpb: 40, wait: 10 }` and are user-tunable in the welcome flow and palette view.
- **Cafés (display)**: `calcCafeOutOf10(...)` — raw `calcCafe` (fixed ~70/30-style blend, wait penalty, `/1.593`), divided by `calcCafeMax()` (same pipeline, best inputs), ×10, clamped to **0–10**.
- **Presentation**: `scoreColor`, `scoreLabel`, `tasteLabel`, `cafeScoreColor`, `cafeScoreLabel` in `scoring.js` delegate to **`src/constants/ratingTiers0to10.js`** (`label010`, `color010`). Tier edges and colors live in `RATING_010_BANDS` there; FAQ can reuse **`RatingTierLegend.jsx`**.

## UI aggregation (“social-like” today)

- Restaurant **rows are grouped by `name`**; multiple DB rows with the same name appear as one card with **visit count** and **averages** (BITE, taste, $/portion, wait, repeat) computed client-side from the group.
- Drinks/sweets **café rows** group by venue `name` similarly via `CafeGroupRow`.
- There is **no** separate table for “votes” or “reviews from user X”; each **visit** row is one log line; venue display names come from joined **place** rows.

## Authorization (current)

- **Supabase Auth** — `AuthProvider` (`src/contexts/AuthContext.jsx`): `getSession` + `onAuthStateChange`; **`authReady`** when the initial session check finishes. Sign-in UI: `AuthModal` (header / triple-tap logo).
- **Persistence** — Logged-in users **insert/update/delete** only rows where **`user_id = auth.uid()`**. Legacy rows with `user_id` null are **not** mutable from the app. Logged-out users: adds/edits are **local-only** (synthetic ids) until sign-in.
- **Settings** — Read in-app for FAQ overrides / welcome copy / quest bootstrap. **`welcome_*`** applies when **`VITE_WELCOME_USE_SUPABASE=true`**. FAQ in **`FaqView`** is read-only; edits are done in the DB with elevated credentials.
- **RLS** — Legacy policies may exist on `restaurants` / `cafes`. Current app uses [`20260430_restaurant_cafe_places_visits.sql`](../supabase/migrations/20260430_restaurant_cafe_places_visits.sql): own-row CRUD on `*_visits`; authenticated policies on `*_places`. No client **`settings`** writes.

## File map (high signal)

| Path | Role |
|------|------|
| `src/App.jsx` | Shell: data load, auth-aware CRUD, navigation, sorting/filtering, grouping |
| `src/contexts/AuthContext.jsx` | Session + `authReady` |
| `src/components/AuthModal.jsx` | Magic link + Google + sign out |
| `src/config/supabaseClient.js` | Singleton Supabase client |
| `src/state/logReducer.js` | `ADD` / `DEL` / `UPD` / `VIEW` / `LOAD` for restaurant entries |
| `src/utils/scoring.js` | BITE math and labels |
| `src/data/initialData.js` | Offline seed + form defaults |
| `src/contexts/LangContext.jsx` | `t`, `lang`, `toggleLang` |
| `src/components/RestForm.jsx`, `CafeForm.jsx` | Create/edit flows |
| `src/components/FaqView.jsx` | Reads FAQ + optional DB overrides (read-only) |

## Gaps vs. stated roadmap (social / scale)

1. **Public vs private read** — Visit `SELECT` is **private per user**; place tables are readable by all signed-in users for joins.
2. **Option B data model** — split **venues** from **ratings** if aggregates and discovery need server-side structure.
3. **Aggregates** — today averages are **client-side** over grouped names; with many users consider **SQL views/materialized aggregates** or Edge Functions.
4. **`city` (and any other)** fields: align DB columns, RLS, and all insert/update/select paths.

## Commands

- Dev: `npm run dev`
- Build: `npm run build`

---

*This file is maintained for Cursor/agent continuity; update it when schema or auth behavior changes materially.*
