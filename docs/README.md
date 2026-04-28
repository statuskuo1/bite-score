# BITE Score docs

Three layers, in increasing order of "what is true right now":

1. **`pages/`** — one file per bottom-nav page (My Log, My Taste, Add, Community, FAQ). The always-current product spec for that page: purpose, user flows, UI structure, data sources, key logic & current values, and links back to the ADRs that produced today's behavior.
2. **`features/`** — cross-cutting topics that don't belong to any single page (scoring, auth/RLS, i18n, quests, taste personality, places/visits data model). Same structure as page docs.
3. **`decisions/`** — append-only ADRs. One file per substantive decision (`YYYY-MM-DD-kebab-case-topic.md`). Never edited after the day they're written.

## How to read this

- Want to know **what a page does today**? Read `pages/<page>.md`.
- Want to know **how scoring works today**? Read `features/scoring.md`.
- Want to know **why we got here / the history**? Skim `decisions/` — newer files override older ones.

## How autoupdate works

Every page/feature doc has YAML frontmatter with a `scope:` list of source-file globs, e.g.:

```yaml
---
title: My Log
scope:
  - src/App.jsx
  - src/state/logReducer.js
  - src/components/RestRow.jsx
last_reviewed: 2026-04-28
---
```

Two layers keep this file in sync with the code:

1. **Cursor rule** ([`.cursor/rules/code-decisions.mdc`](../.cursor/rules/code-decisions.mdc)) — every substantive change must update any `pages/` or `features/` doc whose `scope` matches the changed files. The agent bumps `last_reviewed`, edits the relevant section, and adds a link under "Decisions" pointing at the new ADR in `decisions/`.
2. **Cursor stop hook** ([`.cursor/hooks.json`](../.cursor/hooks.json) + [`scripts/docs-stale-check.mjs`](../scripts/docs-stale-check.mjs)) — at the end of each agent turn, runs `git diff --name-only HEAD` and parses the frontmatter of every doc. If any changed file matches a doc's `scope` and that doc itself wasn't touched, prints a reminder so the agent can update it before ending the turn.

You can also run the check manually:

```bash
npm run docs:check
```

## Adding a new page or feature doc

1. Drop a new `.md` file under `pages/` or `features/`.
2. Frontmatter must include `title`, `scope` (list of globs), and `last_reviewed`.
3. Use the section template from any existing doc (Purpose / User flows / UI structure / Data sources / Key logic & current values / Decisions).

## Adding a new ADR

Same as before — drop a file in `decisions/` named `YYYY-MM-DD-topic.md` with Context / Decision / Alternatives / Consequences. After writing the ADR, link it from the matching page or feature doc's "Decisions" section.

## Index

### Pages (bottom-nav)

- [My Log](pages/my-log.md) — log table, grouping, edit/delete
- [My Taste](pages/my-taste.md) — palette tabs, donuts, weight sliders, quests entry
- [Add](pages/add.md) — restaurant + café entry forms
- [Community](pages/community.md) — Global / Friends / Compare / Groups
- [FAQ](pages/faq.md) — read-only FAQ with optional DB overrides

### Features (cross-cutting)

- [Scoring](features/scoring.md) — BITE math, weights, tier bands
- [Auth & RLS](features/auth-rls.md) — sign-in, RLS policies, what the anon client can do
- [i18n](features/i18n.md) — `LangContext`, translations, lang persistence
- [Quests](features/quests.md) — A–Z + regional cuisine quest model
- [Taste personality](features/taste-personality.md) — palette personality engine
- [Places & visits data model](features/places-visits-data-model.md) — `*_places` / `*_visits` schema, joins, mappers

### Reference

- [`.cursor/ARCHITECTURE.md`](../.cursor/ARCHITECTURE.md) — system-wide architecture
- [`SUPABASE_AUTH_SETUP.md`](SUPABASE_AUTH_SETUP.md) — Supabase setup notes
- [`LOCAL_SUPABASE.md`](LOCAL_SUPABASE.md) — local Supabase workflow
