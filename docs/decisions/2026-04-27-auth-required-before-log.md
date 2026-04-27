# Decision: Require sign-in before showing the visit log

## Context

Visitors could browse demo seed restaurants and cafés without an account. The product should funnel anonymous users through **sign-in / account creation** (same Supabase OTP + Google flow) before any log UI.

## Decision

- Anonymous load keeps **empty** restaurant/café state (no bundled seed).
- **`needsAuth`** (`authReady && !user`): show a gate (copy + primary button) and **auto-open `AuthModal`** once when logged out.
- **`user && …`**: bottom navigation and all views (log, add, palette, quests, FAQ, suggest); weights welcome modal only after **`user`**.
- Signing in closes the modal; signing out restores the gate and re-opens the auth modal.

## Consequences

- First-time signed-in users see **empty** lists until they add visits (existing scoped fetch).

Primary files: [`src/App.jsx`](../../src/App.jsx), [`src/translations.js`](../../src/translations.js).
