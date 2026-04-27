# BITE Score — system architecture (agent reference)

Last reviewed from codebase snapshot (Vite + React 18 SPA). Use this when implementing Supabase Auth, per-user data, or multi-rater aggregates.

## Product intent

Single-page **restaurant and café rating** experience: users record visits (taste, cost, portions, wait, repeatability, notes), see **BITE** scores derived from a formula, filter/sort/group listings, and track **quest** progress (A–Z cuisines, regional cuisine checklist). The product may evolve toward **social** discovery; **signed-in visit logs are private per user** (RLS + client filter). Aggregates across users are not implemented in-app yet. **Supabase Auth** (magic link + optional Google) backs sign-in; **RLS** enforces row ownership (`user_id`) and **admin-only** `settings` writes. See [`docs/SUPABASE_AUTH_SETUP.md`](../docs/SUPABASE_AUTH_SETUP.md) and [`supabase/migrations/20260426_auth_rls.sql`](../supabase/migrations/20260426_auth_rls.sql).

## Tech stack

| Layer | Choice |
|--------|--------|
| UI | React 18 (`src/App.jsx` is the main shell; many presentational components under `src/components/`) |
| Build | Vite 6 (`vite.config.js`, `@vitejs/plugin-react`) |
| Data / backend | Supabase (`@supabase/supabase-js`), anon client in `src/config/supabaseClient.js` via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| i18n | `LangContext` + `translations.js`; language persisted in `localStorage` (`bite_lang`) |
| State | `useReducer` + `logReducer.js` for restaurant “entries”; `useState` for cafés, UI, filters; **`AuthContext`** exposes `user`, `session`, `isAdmin` (from `profiles.is_admin`), **`authReady`** |

No React Router — **views** are a string on reducer state (`log`, `add`, `palette`, `quests`, `suggest`, `faq`) plus local edit modes (`editR`, `editC`).

## Runtime data flow

1. **Boot**: `App` mounts with **empty** restaurant/café state until **`authReady`**. If the user is **signed out**, seed data from `src/data/initialData.js` (`RESTAURANTS` / `CAFES_INIT`) is applied **without** loading other users’ rows from Supabase. If **signed in**, only that user’s `restaurants` / `cafes` rows are fetched (`user_id` filter + RLS).
2. **Supabase load** (`useEffect`, depends on `authReady` + `user.id`): fetches **`settings`** every time; fetches visit tables only when signed in, scoped to the current user. Hydrates quest letters, FAQ overrides, welcome copy from `settings` where applicable.
3. **Scores**: never stored as a single “BITE” column in app code for restaurants; **computed on the fly** in the UI via `src/utils/scoring.js` (`calcBiteOutOf10`, `calcCafeOutOf10`, built on raw `calcBite` / `calcCafe`, weights, repeatability).
4. **Mutations**: restaurant/café/settings writes go through **`App.jsx`**; FAQ answer overrides are written from **`FaqView.jsx`**. Components receive callbacks.

## Supabase schema (as implied by the client)

### `restaurants`

Read mapping (snake_case → camelCase in UI): `id`, `name`, `cuisine`, `cuisine2`, `is_fusion`, `taste`, `cost`, `portions`, `wait`, `repeatability`, `use_r`, `notes`, `user_id` → `ownerId`; `letter` is derived from first character of `cuisine`.

Insert/update payloads use the same snake_case fields plus `letter` on insert. **Note:** `city` exists on seed objects and in UI filters (`e.city || "NYC"`) but is **not** included in current insert/update/load mapping — if the DB has a `city` column, wire it through load + insert + update for parity.

### `cafes`

Fields: `name`, `category`, `order_item` ↔ UI `order`, `taste`, `cost`, `portions`, `wait`, `bean_region`, `milk_level`, `repeatability`, `use_r`, `notes`, `user_id` → `ownerId`.

### `profiles`

`id` (FK to `auth.users`), `is_admin` (boolean). Row created by trigger on signup. Curators set `is_admin` in SQL (see auth setup doc).

### `settings`

Key-value table: rows have `key` and `value` (string). Known keys:

- `questLetters` — JSON stringified array of letters for the A–Z quest toggle state  
- `faq_override_{index}` — FAQ answer overrides (admin)  
- `welcome_{en|zh}_title`, `welcome_{en|zh}_body` — welcome modal copy  

Upserts use `onConflict: "key"` (unique constraint on `key` assumed).

## Scoring module (`src/utils/scoring.js`)

- **Restaurants (display)**: `calcBiteOutOf10(...)` — raw weighted score `calcBite` (taste / bang-per-buck / wait, optional `applyR`), divided by `calcMaxBite(weights)` (best case: taste 10, zero buck/wait penalty, 3★), ×10, clamped to **0–10**. Weights default `{ taste: 50, bpb: 40, wait: 10 }` and are user-tunable in the welcome flow and palette view.
- **Cafés (display)**: `calcCafeOutOf10(...)` — raw `calcCafe` (fixed ~70/30-style blend, wait penalty, `/1.593`), divided by `calcCafeMax()` (same pipeline, best inputs), ×10, clamped to **0–10**.
- **Presentation**: `scoreColor`, `scoreLabel`, `tasteLabel`, `cafeScoreColor`, `cafeScoreLabel` in `scoring.js` delegate to **`src/constants/ratingTiers0to10.js`** (`label010`, `color010`). Tier edges and colors live in `RATING_010_BANDS` there; FAQ can reuse **`RatingTierLegend.jsx`**.

## UI aggregation (“social-like” today)

- Restaurant **rows are grouped by `name`**; multiple DB rows with the same name appear as one card with **visit count** and **averages** (BITE, taste, $/portion, wait, repeat) computed client-side from the group.
- Drinks/sweets **café rows** group by venue `name` similarly via `CafeGroupRow`.
- There is **no** separate table for “votes” or “reviews from user X”; each row is effectively one **visit log line** at the same granularity as stored in `restaurants` / `cafes`.

## Admin / authorization (current)

- **Supabase Auth** — `AuthProvider` (`src/contexts/AuthContext.jsx`): `getSession` + `onAuthStateChange`; profile row for `is_admin`. Sign-in UI: `AuthModal` (header / triple-tap logo).
- **Persistence** — Logged-in users **insert/update/delete** their own `restaurants`/`cafes` rows (`user_id` on insert). Legacy rows with `user_id` null: **admins only** for DB mutate (matches RLS). Logged-out users: adds/edits are **local-only** (synthetic ids) unless they sign in.
- **Settings** — `questLetters` and FAQ overrides: **admin** in UI (`FaqView`) where applicable; **`welcome_*` keys** in Supabase override bundled welcome copy **only** when **`VITE_WELCOME_USE_SUPABASE=true`** at build time (otherwise `translations.js`). No in-app welcome editor; update DB via Supabase if using overrides. RLS as in migrations.
- **RLS** — Base policies in [`supabase/migrations/20260426_auth_rls.sql`](../supabase/migrations/20260426_auth_rls.sql); **SELECT** on `restaurants` / `cafes` is restricted per user (and admin read-all) in [`supabase/migrations/20260427_restaurants_cafes_select_own.sql`](../supabase/migrations/20260427_restaurants_cafes_select_own.sql). Apply both in Supabase SQL Editor for the project.

## File map (high signal)

| Path | Role |
|------|------|
| `src/App.jsx` | Shell: data load, auth-aware CRUD, navigation, sorting/filtering, grouping |
| `src/contexts/AuthContext.jsx` | Session + `profiles.is_admin` |
| `src/components/AuthModal.jsx` | Magic link + Google + sign out |
| `src/config/supabaseClient.js` | Singleton Supabase client |
| `src/state/logReducer.js` | `ADD` / `DEL` / `UPD` / `VIEW` / `LOAD` for restaurant entries |
| `src/utils/scoring.js` | BITE math and labels |
| `src/data/initialData.js` | Offline seed + form defaults |
| `src/contexts/LangContext.jsx` | `t`, `lang`, `toggleLang` |
| `src/components/RestForm.jsx`, `CafeForm.jsx` | Create/edit flows |
| `src/components/FaqView.jsx` | Reads/writes `settings` for FAQ overrides |

## Gaps vs. stated roadmap (social / scale)

1. **Public vs private read** — `restaurants`/`cafes` SELECT is **private per user** (plus admin); re-open reads only if you add an explicit social/discovery feed and policies.
2. **Option B data model** — split **venues** from **ratings** if aggregates and discovery need server-side structure.
3. **Aggregates** — today averages are **client-side** over grouped names; with many users consider **SQL views/materialized aggregates** or Edge Functions.
4. **`city` (and any other)** fields: align DB columns, RLS, and all insert/update/select paths.

## Commands

- Dev: `npm run dev`
- Build: `npm run build`

---

*This file is maintained for Cursor/agent continuity; update it when schema or auth behavior changes materially.*
