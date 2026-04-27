# Welcome modal: copy filter, readability, no in-app CMS

## Context

Welcome may still load `welcome_*` copy from **settings** (read-only hydration). A playful “play mode” paragraph should not appear in the UI. The weight block needs readable contrast and a larger “How much do you care…” line. In-app **admin-only editors** that write welcome copy to Supabase from the client are removed in favor of changing copy via controlled channels (e.g. DB console / migrations).

## Decision

- **Weights:** Welcome uses the same **three sliders**, **`updW`**, and **`manualKeys={restaurantSliderPair}`** as My Taste so taste / bpb / wait are all adjustable in any order.
- **Copy display:** **`omitPlayWelcomeAside`** still strips paragraphs containing `Play around! Nothing saves permanently` from the displayed body; **`welcomeOverride`** continues to be **loaded** from settings for display only.
- **Admin UI:** Remove welcome **Edit** / **Save** / **Reset** / **Cancel** flows and the header **Edit welcome** control; no client writes to `welcome_*` keys from this app.
- **WeightSliders:** Keep optional **`careHeadingPx`**; light label text and **Reset** styling as implemented for readability.

## Alternatives considered

- Keep two-slider welcome only: rejected — users need wait adjustable without following a fixed order.
- Remove `welcome_*` hydration entirely: rejected — server-driven copy for deployments is still useful without an in-app editor.

## Consequences

- **Primary files:** `src/App.jsx`, `src/translations.js`, `src/components/WeightSliders.jsx`.
