# Welcome modal: remove cloud/sign-in aside from body

## Context

The welcome card splits `welcome2` on `\n\n`: the first block goes next to the title (`InfoBubble`); further blocks render as paragraphs under the weight sliders. Traditional Chinese showed an extra block (“登入後…雲端…”) while English often did not, because `welcome_en_body` in Supabase was already a single paragraph while `zh` still fell back to the bundled two-paragraph string—or overrides were updated for one language only.

## Decision

- **Bundled copy:** Keep a **single** paragraph in `en.welcome2` and `zh.welcome2` (BITE definition only); drop the sign-in / cloud-sync sentence from the welcome body (users still have Account / sign-in elsewhere).
- **Hydrated copy:** Extend `omitPlayWelcomeAside` to filter out paragraphs that match the old EN or ZH sync disclaimer substrings so legacy `welcome_*_body` rows stay aligned without manual DB edits.

## Alternatives considered

- Rely on Supabase-only fixes for `welcome_zh_body`: rejected — easy to drift again; defaults should match.
- Keep disclaimer in welcome for one locale only: rejected — breaks parity.

## Consequences

- **Primary files:** `src/App.jsx`, `src/translations.js`.
- FAQ or auth flows remain the right place if we want that messaging back in longer form.
