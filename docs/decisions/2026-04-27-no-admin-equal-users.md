# Decision: No admin role in the app; equal users

## Context

The product previously used `profiles.is_admin` for UI (header color, FAQ editing, quest toggles, logo badge), broader RLS read/update paths for admins, and `settings` writes for admins. The goal is one class of user: everyone only sees and edits their own `restaurants` / `cafes` rows.

## Decision

- **Remove** `isAdmin` / profile fetch from `AuthContext`; session + `authReady` only.
- **RLS** ([`supabase/migrations/20260428_flat_user_rls_no_admin.sql`](../supabase/migrations/20260428_flat_user_rls_no_admin.sql)): `SELECT` / `UPDATE` / `DELETE` on `restaurants` and `cafes` require **`user_id = auth.uid()`** only (no admin bypass). Drop **`settings_write_admin`** so the anon client cannot mutate global `settings` (curators change FAQ/welcome/quest defaults via SQL Editor or service role).
- **UX**: `canMutateVisit` / `canSwipeGroup` are ownership-only. FAQ is **read-only** in the app. A–Z quest toggles persist in **`localStorage`** per user (`bite_questLetters_<uuid>`), not `settings`.
- **`profiles.is_admin`** may remain in the DB for backwards compatibility but is **unused** by the client.

## Alternatives considered

- Keep admin for dashboard-only operations: rejected — user asked to remove the distinction.

## Consequences

- Legacy rows with `user_id` null are **not** editable via the app for anyone (only SQL/service role).
- Updating bundled FAQ copy in production requires DB access outside the app.

Primary files: `supabase/migrations/20260428_flat_user_rls_no_admin.sql`, `src/contexts/AuthContext.jsx`, `src/utils/rowAccess.js`, `src/App.jsx`, `src/components/FaqView.jsx`, `src/components/RestRow.jsx`, `src/components/CafeGroupRow.jsx`, `src/components/LogoWithTripleTap.jsx`.
