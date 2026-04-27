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

### PR preview vs localhost

GitHub has the same committed files as local; **deploy previews** still run `vite build` (`PROD`), so they load Supabase overrides like production unless you either:

1. Set **`VITE_WELCOME_USE_SUPABASE=false`** on the preview environment (Netlify/Vercel “Preview” env vars), **or**
2. Update/delete **`welcome_en_body` / `welcome_zh_body`** in Supabase `settings` so they match `translations.js`.

Localhost stayed “correct” because dev mode never applied DB welcome copy.
