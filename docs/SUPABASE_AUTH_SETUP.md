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

The `profiles.is_admin` column may still exist from step 1; the **app no longer uses it**. Global `settings` rows (FAQ/welcome defaults, etc.) are edited with the **service role** or SQL Editor, not the browser client.

## Verify

1. Sign up / sign in from the app.
2. Confirm `profiles` has a row for the user.
3. Confirm inserts to `restaurants` / `cafes` include `user_id` and succeed under RLS.
4. Confirm user A cannot `SELECT` user B’s rows (use Table Editor as each user or inspect API responses).
