# Decision: Freeze ZH translations until English UI is stable

## Context

The English UI is still churning rapidly (auth-verify flows, social tabs,
Google Places autocomplete copy, etc.). Every English-side change so far
has obligated a parallel ZH update under the
[2026-04-26 ZH/EN parity rule](2026-04-26-zh-en-translation-parity.md),
which (a) burns time on translations that get rewritten the next day and
(b) leaves the ZH bundle perpetually stale-but-shipped.

## Decision

- **Stop adding or editing ZH copy in
  [`src/translations.js`](../../src/translations.js)** for net-new keys or
  re-worded English keys, effective 2026-04-28.
- New translation keys are added to the `T.en` block only. Existing ZH
  values are left untouched even when the matching English changes —
  intentionally stale, not removed.
- Component code continues to use `useLang().t.someKey`. ZH users hitting a
  missing key fall through to English (existing context behavior), which is
  the acceptable trade-off while the surface area is in flux.
- One sweeping ZH translation pass happens later, once the user signals
  English is stable ("translations are unfrozen" / "do the ZH pass").
- Encoded in [`.cursor/rules/i18n-english-only.mdc`](../../.cursor/rules/i18n-english-only.mdc)
  so future agent sessions don't silently re-introduce parity edits.

## Alternatives considered

- **Keep enforcing parity** — current state. Rejected: thrash on every
  English iteration; ZH copy was already drifting in quality from English
  edits made in haste.
- **Delete ZH entirely (Mandarin already stashed)** — rejected. Mandarin is
  intentionally preserved per
  [2026-04-28 stash-mandarin-localization](2026-04-28-stash-mandarin-localization.md);
  ripping it out and re-adding it is more work than letting it sit stale.
- **Auto-translate via tooling** — premature; the English copy isn't
  stable enough for a single-shot pass to be worth automating.

## Consequences

- ZH bundle in `translations.js` will visibly drift from English. Acceptable
  while `lang === "en"` is hardcoded in
  [`App.jsx`](../../src/App.jsx) (no end user is reading ZH today).
- The "Add new keys to both locales" guidance in
  [`docs/features/i18n.md`](../features/i18n.md) is superseded — that doc
  now points at this ADR for the freeze.
- When unfrozen, the ZH pass will need to diff every key added/edited since
  this date. Git history on `translations.js` is the audit trail.

Primary files: `.cursor/rules/i18n-english-only.mdc`, `docs/features/i18n.md`.
