# Stash Mandarin localization (UI English-only for now)

## Context

The app shipped with EN + ZH (Traditional Chinese) translations from day one,
but English copy is still being polished and mismatches keep appearing between
languages (welcome modal, FAQ overrides, ad-hoc inline strings). Goal: ship a
solid EN experience first, then re-roll localization on a stable base.

## Decision

Hide the Mandarin path from the UI **without deleting any zh content**.

Concretely, in `src/App.jsx` only:

- Hardcode `const lang = "en"; const t = T.en;` (was a `useState` reading
  `localStorage.bite_lang`).
- Remove the `toggleLang` function and drop it from the `LangContext.Provider`
  value (no other component consumes it).
- Remove the header `繁中 / EN` toggle button.
- Remove the welcome-modal language-picker pill row.
- Replace the two inline `lang === "zh" ? ... : ...` strings in `App.jsx`
  (`"BITE Score 吃貨榜"`, `"連線中…"`) with their English versions.

Everything else is intentionally untouched:

- `src/translations.js` keeps the full `T.zh` dictionary.
- `src/contexts/LangContext.jsx` is unchanged; consumers still get
  `{ t, lang }` and `lang` is just always `"en"`.
- Components with direct `lang === "zh"` ternaries (`FaqView.jsx`,
  `SuggestView.jsx`, `VisitsModal.jsx`) are unchanged — the ZH branch is dead
  code today but ready to revive.
- Existing `localStorage.bite_lang` values are not cleared; users who had
  selected `zh` will get their preference back on revival.

## Alternatives considered

- **Delete `T.zh` and all `lang === "zh"` branches.** Rejected — throws away
  real translation work and makes revival a translation project, not a UI
  toggle.
- **Keep the toggle but force English at render time.** Rejected — UI clutter
  for a feature we're not actually offering, and confusing if users tap it.
- **Add a `?lang=zh` URL escape hatch.** Rejected — needless surface area; a
  one-file revert revives the full toggle when we're ready.

## Consequences

- Reviving Mandarin = revert this commit's `App.jsx` changes; no other files
  to touch.
- `omitPlayWelcomeAside` in `App.jsx` still filters a Mandarin paragraph
  defensively (covers any Supabase `welcome_*` overrides). Harmless.
- Future English copy changes don't have to be mirrored in `T.zh` until we
  re-enable; expect parity drift, plan a translation pass before re-enable.
- Primary file changed: `src/App.jsx`.
