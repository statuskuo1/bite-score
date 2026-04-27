# Supabase Auth — dashboard checklist

Apply these in the [Supabase Dashboard](https://supabase.com/dashboard) for your BITE Score project **before** relying on login in production.

## Authentication → URL configuration

1. **Site URL** — set to your primary app origin (e.g. `http://localhost:5173` for Vite dev, or your production URL).
2. **Redirect URLs** — add every origin users may return to after OAuth or magic links, one per line:
   - `http://localhost:5173`
   - `http://localhost:5173/**` (if the dashboard supports wildcards)
   - Your production URL(s), e.g. `https://your-domain.com`

The client uses `window.location.origin` as `redirectTo` / `emailRedirectTo`; those URLs must be allowed here or auth will fail after redirect.

## Authentication → Providers

1. **Email** — enable **Magic link** (and optionally **Confirm email** per your product needs).
2. **Google** (optional) — enable **Google**, add OAuth client ID/secret from Google Cloud Console, and add the Supabase callback URL Google shows you to your Google client’s **Authorized redirect URIs**.

## Database

Run the SQL in these migrations in **SQL Editor** (or use the Supabase CLI if you adopt it later), in order:

1. [`supabase/migrations/20260426_auth_rls.sql`](../supabase/migrations/20260426_auth_rls.sql) — profiles, `user_id`, base RLS  
2. [`supabase/migrations/20260427_restaurants_cafes_select_own.sql`](../supabase/migrations/20260427_restaurants_cafes_select_own.sql) — replaces open `SELECT` (superseded on next step for policy names)  
3. [`supabase/migrations/20260428_flat_user_rls_no_admin.sql`](../supabase/migrations/20260428_flat_user_rls_no_admin.sql) — **own-row only** for `restaurants` / `cafes` (no admin read/write bypass); removes client writes to `settings`  
4. [`supabase/migrations/20260430_restaurant_cafe_places_visits.sql`](../supabase/migrations/20260430_restaurant_cafe_places_visits.sql) — **current app**: `restaurant_places` / `restaurant_visits`, `cafe_places` / `cafe_visits` (normalized venues + visits). Legacy `restaurants` / `cafes` are optional historical tables.  
5. [`supabase/migrations/20260431_profiles_display_leaderboard.sql`](../supabase/migrations/20260431_profiles_display_leaderboard.sql) — **`profiles`** `username` / `display_name` / `avatar_url`; sign-up trigger fills from OAuth metadata; visits FK → `profiles`; authenticated **SELECT** all visits + all profiles for community feed.

The `profiles.is_admin` column may still exist from step 1; the **app no longer uses it**. Global `settings` rows (FAQ/welcome defaults, etc.) are edited with the **service role** or SQL Editor, not the browser client.

### Optional: assign all legacy visit rows to one owner

If you imported or created rows before ownership was consistent, run [**`20260429_assign_existing_visits_to_bitescore1.sql`**](../supabase/migrations/20260429_assign_existing_visits_to_bitescore1.sql) once in the SQL Editor (edit the email matching logic inside if your primary account is not `bitescore1`). This sets **`user_id`** on every row in `restaurants` and `cafes` to that user.

## Verify

1. Sign up / sign in from the app.
2. Confirm `profiles` has a row for the user.
3. Confirm inserts to `restaurant_visits` / `cafe_visits` include `user_id` and succeed under RLS (and place rows insert under `restaurant_places` / `cafe_places` policies).
4. Confirm user A cannot `SELECT` user B’s rows (use Table Editor as each user or inspect API responses).
