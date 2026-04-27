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

Run the SQL in [`supabase/migrations/20260426_auth_rls.sql`](../supabase/migrations/20260426_auth_rls.sql) in **SQL Editor** (or use the Supabase CLI if you adopt it later).

After migration, promote at least one curator account:

```sql
update public.profiles set is_admin = true
where id = '<paste-auth-users-uuid-here>';
```

Run that as a project owner in the SQL editor (bypasses RLS).

## Verify

1. Sign up / sign in from the app.
2. Confirm `profiles` has a row for the user (`is_admin` false until you promote).
3. Confirm inserts to `restaurants` / `cafes` include `user_id` and succeed under RLS.
4. Confirm a non-admin cannot write to `settings`.
