# Page + feature source-of-truth docs

## Context

`docs/decisions/` had ~60 ADRs — great for history, painful for "what does My Log do today?". `.cursor/ARCHITECTURE.md` covers the system but isn't page-organized. The user wanted a glanceable spec per bottom-nav page (My Log, My Taste, Add, Community, FAQ) plus per-feature rollups (scoring, auth/RLS, etc.) that stays in sync as we ship changes.

## Decision

Two new doc tiers under `docs/`, layered on top of the existing ADR folder:

- **`docs/pages/`** — one file per bottom-nav page.
- **`docs/features/`** — one file per cross-cutting topic (scoring, auth/RLS, i18n, quests, taste personality, places/visits data model).

Each file has YAML frontmatter with `title`, `scope` (list of source-file globs), and `last_reviewed`. Body sections: Purpose / User flows / UI structure / Data sources / Key logic & current values / Decisions (links back to ADRs).

Autoupdate is enforced by **two layers**:

1. **Cursor rule** (`.cursor/rules/code-decisions.mdc`) — every substantive change must update any `docs/pages/*` or `docs/features/*` whose `scope` matches changed files, bump `last_reviewed`, and append the new ADR link.
2. **Cursor stop hook** (`.cursor/hooks.json` → `scripts/docs-stale-check.mjs`) — at end-of-turn, runs `git diff --name-only HEAD` + untracked files, parses each doc's frontmatter, and emits a `followup_message` reminder if scope-matching files changed without the doc being touched. `loop_limit: 1` prevents infinite loops. Always exits 0 — advisory, not blocking.

Also: `npm run docs:check` runs the same script in human-readable mode for manual / CI use.

## Alternatives considered

- **Just keep using `docs/decisions/`** — append-only ADRs are great history but force a future reader to grep dozens of files to reconstruct current state. Page docs are the rollup.
- **Auto-generate page docs from code/JSDoc** — brittle, makes the docs feel like "comments dumped to disk" instead of curated product spec. Hand-authored beats generated for product narrative; structured numbers (weights, thresholds) can be auto-injected later if needed.
- **Single `STATE_OF_THE_APP.md`** — too coarse; loses page-level navigation and the scope→glob mapping that powers stale-detection.
- **Rule-only enforcement** — relies entirely on agent compliance. The stop hook adds a mechanical second layer that doesn't depend on the agent remembering.
- **Hook fails closed (blocks turn end)** — too aggressive; doc updates aren't always urgent. Soft `followup_message` is the right pressure.

## Consequences

- New files: `docs/README.md`; `docs/pages/{my-log,my-taste,add,community,faq}.md`; `docs/features/{scoring,auth-rls,i18n,quests,taste-personality,places-visits-data-model}.md`; `.cursor/hooks.json`; `scripts/docs-stale-check.mjs`.
- Modified: `.cursor/rules/code-decisions.mdc` (page/feature update obligation), `package.json` (`docs:check` script), `.cursor/ARCHITECTURE.md` (pointer to new structure).
- Future ADRs should still be created — they remain the audit trail. The new obligation is to ALSO touch the relevant page/feature doc.
- Adding a new page or feature: drop a new `.md` under `docs/pages/` or `docs/features/` with the standard frontmatter + section template; the hook picks it up automatically on the next turn.
- Renaming source files: update `scope` in any doc that referenced the old path.
