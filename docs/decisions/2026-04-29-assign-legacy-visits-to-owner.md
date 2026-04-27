# Decision: Backfill `user_id` for legacy visits (bitescore1)

## Context

Historical `restaurants` / `cafes` rows may have `user_id` null or mixed ownership. Product owner wants **all existing** rows attributed to the primary account **bitescore1** (matched via `auth.users` email).

## Decision

- Ship a **one-off migration** [`supabase/migrations/20260429_assign_existing_visits_to_bitescore1.sql`](../../supabase/migrations/20260429_assign_existing_visits_to_bitescore1.sql) run manually in the SQL Editor: sets **`user_id`** on **every** row in both tables to the UUID for `bitescore1` (email local-part or `bitescore1@%`).
- **New inserts** already set `user_id` from the session in [`src/App.jsx`](../../src/App.jsx) (`user_id: user.id`); no change required for future rows.

## Alternatives considered

- Update only `user_id IS NULL`: rejected — owner asked for **all** current rows tied to bitescore1.

## Consequences

- Any row previously owned by another test user will be **reassigned** if the script updates the full table; run only if that is intended.
- If multiple users match the email pattern, the script picks the **oldest** account (`ORDER BY created_at ASC LIMIT 1`).
