# Welcome InfoBubble: simple 0–10 tier sentence

## Context

Welcome `welcome2` had grown into a long normalization explainer; the modal already shows weights and FAQ covers detail. Users wanted the bubble to read like the earlier concise line (“scores range … Great / Elite”) but on the **0–10** display scale.

## Decision

- **`welcome2` (en/zh):** One short paragraph: BITE definition + **0–10** range + **Great ≈ 6.5–8**, **Elite ≈ 8–10**, aligned with `RATING_010_BANDS_NORMALIZED` in `docs/decisions/2026-04-26-normalized-bite-tier-bands.md`; pointer to FAQ for full bands.

## Alternatives considered

- Repeat full utility-ratio formula in welcome: rejected — FAQ + tier legend carry it.
- Round cutoffs to “> 7 / > 8”: rejected — mismatches normalized band edges.

## Consequences

- **Primary file:** `src/translations.js`. Supabase `welcome_*` overrides apply in **production builds** (`import.meta.env.PROD`). **`npm run dev`** ignores those keys so copy edits show immediately without editing the DB.

## Follow-up

- **`src/App.jsx`:** `welcomeTitleDisplay` / `welcomeBodyDisplay` use Supabase `welcome_*` when **production build** (`import.meta.env.PROD`) **and** `VITE_WELCOME_USE_SUPABASE !== 'false'`. **`npm run dev`** always uses bundled strings.

### Welcome copy source (bundle vs Supabase)

**Decision (follow-up):** Use **`translations.js` everywhere by default.** Load `welcome_*` from Supabase **only** when **`VITE_WELCOME_USE_SUPABASE=true`** is set at build time (e.g. production if you still want DB-driven welcome without redeploying). Otherwise PR previews, `vite preview`, and production builds all show the same bundled strings as the repo.

To opt back into DB-driven welcome on a host: add `VITE_WELCOME_USE_SUPABASE=true` to that environment’s build variables.
