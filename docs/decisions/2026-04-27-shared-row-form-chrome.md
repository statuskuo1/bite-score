# Decision: Shared row / modal / form chrome between restaurants and cafes

## Context

Restaurant and cafe (drinks + sweets) views shared a lot of visual chrome - dark expandable card row, swipe-to-edit/delete, per-entry visits-history modal, top-of-form score preview header - but each domain had its own near-duplicate copy in [`src/components/RestRow.jsx`](../src/components/RestRow.jsx) / [`src/components/CafeGroupRow.jsx`](../src/components/CafeGroupRow.jsx) and [`src/components/RestForm.jsx`](../src/components/RestForm.jsx) / [`src/components/CafeForm.jsx`](../src/components/CafeForm.jsx). Drift between the copies had quietly accumulated:
- [`CafeForm`](../src/components/CafeForm.jsx) didn't accept `weights` so its score preview always used defaults while [`RestForm`](../src/components/RestForm.jsx) respected the user's sliders.
- [`RestRow`](../src/components/RestRow.jsx) hardcoded English strings ("Visit", "Edit", "Delete") while [`CafeGroupRow`](../src/components/CafeGroupRow.jsx) was i18n-aware.
- [`CafeGroupRow`](../src/components/CafeGroupRow.jsx) misused `t.editWeights` ("Edit weights") for the per-visit Edit button.
- [`RestRow`](../src/components/RestRow.jsx) showed an `#N` index column that cafes never had.
- Expanded-panel field grids showed different sets (rest: Taste/Cost/Portions/Wait/Repeat; cafe: Taste/Cost/Wait/Repeat/Score/Visits).

User asked for a consistency pass plus extraction of shared chrome so future styling changes apply uniformly.

## Decision

### Phase 1 - drift fixes (no extraction)

- **[`CafeForm`](../src/components/CafeForm.jsx) accepts `weights`** and threads it into the score preview. App passes `sweetWeights` when editing a Sweet, otherwise `drinkWeights`. New-cafe form always passes `drinkWeights` (cafe defaults to Coffee category); the user can switch to Sweets after but the preview will keep showing drinks-weighted score. Acceptable - the preview only adjusts the rough magnitude; full per-section scoring kicks in once saved and viewed in My Log.
- **i18n parity**: added `t.edit` ("Edit" / "編輯"), changed zh `t.editWeights` from "編輯" to "編輯權重" for clarity, replaced literal "Visit"/"Edit"/"Delete" strings in [`RestRow`](../src/components/RestRow.jsx), and fixed [`CafeGroupRow`](../src/components/CafeGroupRow.jsx)'s `t.editWeights` misuse to use `t.edit` instead.
- **Numbering**: dropped the `#N` index from [`RestRow`](../src/components/RestRow.jsx) (and removed the now-unused `i` arg from both row callsites in [`src/App.jsx`](../src/App.jsx)). The visit-count badge already conveys density; consistent removal is simpler than adding the index to cafes.
- **Expanded panel grid**: both rows now show the same 6 cells - **Taste / Cost / Portions / Wait / Repeat / Score**. Cafes already had a `portions` field but were not surfacing it; cafes' "Visits" cell is moved to the header badge (where it already lived).

### Phase 2 - extract shared chrome

Four new components in `src/components/`:

- **[`ScoreDisplay.jsx`](../src/components/ScoreDisplay.jsx)** - right-aligned big-number + tier-label, with `size: "lg" | "md" | "sm"` variants. Accepts `value` as either a number (auto-formatted to 2 decimals) or a pre-formatted string (rendered verbatim) so it works for both raw scores and the per-sort display strings ("$45", "30 min", etc.).
- **[`VisitsModal.jsx`](../src/components/VisitsModal.jsx)** - dark overlay + scrollable visit-card list, with a `scoreFn(v) => number` callback so the cafe-vs-restaurant scoring split is preserved without a domain enum. Caller also supplies `scoreColorFn`, `getRows(v) => [[label,value]]` for the per-visit metric grid, and an optional `suffix(v) => string` for the cafe-side " · {order}" appendage.
- **[`EntryCard.jsx`](../src/components/EntryCard.jsx)** - the SwipeRow + dark expandable card itself. Takes `icon` / `title` / `badges` / `subtitle` / `authorLine` / `score` / `expandedRows` / `notes` / swipe handlers. Subtitle accepts JSX so [`RestRow`](../src/components/RestRow.jsx) can still render its blue city pill.
- **[`FormScoreHeader.jsx`](../src/components/FormScoreHeader.jsx)** - the `Restaurant / Cafe` toggle pill on the left + live `<ScoreDisplay size="lg">` on the right.

Migration shrank [`RestRow.jsx`](../src/components/RestRow.jsx) from ~93 LOC to ~75, [`CafeGroupRow.jsx`](../src/components/CafeGroupRow.jsx) from ~112 LOC to ~80, and the two form headers each lost a ~12-line block. Total bundle actually went *down* by ~4 KB (from 507.21 KB to 503.30 KB) because deduplication outpaced the cost of the new files.

## Alternatives considered

- **Single unified `<Entry>` component covering both rows AND the visits modal AND the form**. Rejected as over-coupling; today's domain separation between row and modal is real (visits modal lifecycle is independent of the row card), and form headers are a different layout entirely.
- **A unified data model where restaurants are also multi-item visits** (entree + dessert as separate items, like cafes). Out of scope - would lose the simple one-rating-per-restaurant model and require a schema migration. User explicitly preferred to keep the data models separate.
- **Pass a domain enum (`"restaurant" | "cafe"`) into shared components and branch internally**. Rejected in favor of callback props (`scoreFn`, `scoreColorFn`, `getRows`) - keeps shared components free of domain knowledge and lets each domain evolve its own scoring/labels without touching shared code.
- **Abstract the toolbar (sort pills + search/filter/sort-direction icons) too**. Considered but punted - it's already structurally identical and abstracting would require a generic dropdown plumbing API that's a separate effort. Tracked as a possible follow-up.

## Consequences

- Future restyles of any row chrome (card padding, expand chevron, score color) now happen in one place.
- Shared `<VisitsModal>` enforces consistent labeling - both domains get the same "Visit N" header pattern, the same i18n behavior, and the same Edit/Delete button affordances. The cafe-side suffix (" · {order}") is preserved via the optional `suffix` prop.
- The `display.val` prop chain from [`src/App.jsx`](../src/App.jsx) into `RestRow` still works because `<ScoreDisplay>` accepts pre-formatted strings.
- **Files added:** [`src/components/ScoreDisplay.jsx`](../src/components/ScoreDisplay.jsx), [`src/components/VisitsModal.jsx`](../src/components/VisitsModal.jsx), [`src/components/EntryCard.jsx`](../src/components/EntryCard.jsx), [`src/components/FormScoreHeader.jsx`](../src/components/FormScoreHeader.jsx).
- **Files modified:** [`src/translations.js`](../src/translations.js), [`src/App.jsx`](../src/App.jsx), [`src/components/CafeForm.jsx`](../src/components/CafeForm.jsx), [`src/components/RestForm.jsx`](../src/components/RestForm.jsx), [`src/components/RestRow.jsx`](../src/components/RestRow.jsx), [`src/components/CafeGroupRow.jsx`](../src/components/CafeGroupRow.jsx).
- **Out of scope:** persistence of weights (still flagged as separate follow-up), unifying restaurant data model into multi-item, refactoring the My Log toolbar.
