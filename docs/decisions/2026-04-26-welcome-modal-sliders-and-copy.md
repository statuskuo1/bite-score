# Welcome modal: copy filter, readability, no in-app CMS

## Context

Welcome may still load `welcome_*` copy from **settings** (read-only hydration). A playful “play mode” paragraph should not appear in the UI. The weight block needs readable contrast and a larger “How much do you care…” line. In-app **admin-only editors** that write welcome copy to Supabase from the client are removed in favor of changing copy via controlled channels (e.g. DB console / migrations).

## Decision

- **Weights:** Welcome and My Taste both use the same **three sliders** and a simplified **`updW`** where each key updates independently (`0-100`) with no automatic rebalancing or pair logic.
- **Welcome guardrail:** In the welcome modal, users can proceed only when `taste + bpb + wait === 100`. UI shows a live total (`Total: x/100`) and a short guidance message until valid.
- **Copy display:** **`omitPlayWelcomeAside`** still strips paragraphs containing `Play around! Nothing saves permanently` from the displayed body; **`welcomeOverride`** continues to be **loaded** from settings for display only.
- **Admin UI:** Remove welcome **Edit** / **Save** / **Reset** / **Cancel** flows and the header **Edit welcome** control; no client writes to `welcome_*` keys from this app.
- **WeightSliders:** Keep optional **`careHeadingPx`**; light label text and **Reset** styling as implemented for readability.

## Alternatives considered

- Keep two-slider welcome only: rejected — users need wait adjustable without following a fixed order.
- Remove `welcome_*` hydration entirely: rejected — server-driven copy for deployments is still useful without an in-app editor.
- Soft warning only while allowing continue: rejected — strict gate prevents accidental non-normalized weight sets before first use.

## Consequences

- **Primary files:** `src/App.jsx`, `src/translations.js`, `src/components/WeightSliders.jsx`.
