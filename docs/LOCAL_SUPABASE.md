# Local Supabase (Docker)

Run the full stack on your machine so you can develop without pushing to Git or using cloud Supabase.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- Node.js and npm (see repo root)

## One-time / occasional

1. From the repo root: **`npm install`**
2. **`npm run db:start`** — first run downloads images (can take several minutes).
3. **`npm run db:reset`** — applies [`supabase/migrations/`](../supabase/migrations/) and [`supabase/seed.sql`](../supabase/seed.sql) (sample restaurant/café **places** only).
4. **`npm run db:status`** — copy **API URL** and **anon key**.
5. Create **`.env.local`** (gitignored) with:

   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<paste publishable/anon key from db:status>
   ```

   See [`.env.example`](../.env.example). After **`npm run db:reset`**, run **`npm run db:status`** again and refresh the anon key if sign-in or API calls fail.

6. **`npm run dev`** — open the printed localhost URL (Vite default is port **5173**).

## Sign-in locally

- The auth modal uses **email + password** in every environment. On a fresh local DB, click **Create account** once, then **Sign in** with the same credentials.
- **Google** stays disabled in local dev because OAuth requires extra Google Cloud Console + Supabase redirect setup. It is enabled in production builds.
- **Forgot password?** triggers a Supabase reset email; in local dev it lands in **Mailpit** (open the Inbox URL from `npm run db:status`).

## Useful commands

| Command | Purpose |
|--------|---------|
| `npm run db:start` | Start local Supabase (Docker) |
| `npm run db:stop` | Stop containers |
| `npm run db:reset` | Re-run migrations + seed (wipes local data) |
| `npm run db:status` | URLs and keys |

**Studio:** `http://127.0.0.1:54323` (from `db:status` if the port differs, use that).

## Vercel / production

- Vite **production** builds set `import.meta.env.DEV` to `false`, so the app behaves as before for hosted users.
- Hosted sites keep using **Vercel environment variables** for `VITE_SUPABASE_*`; `.env.local` is not deployed.

## Troubleshooting: “Invalid login credentials”

1. **Use the right backend** — In dev, `VITE_SUPABASE_URL` should be **`http://127.0.0.1:54321`** (from `npm run db:status`). If it still points at **cloud** Supabase, local passwords do not exist there: fix **`.env.local`** and restart Vite.
2. **Create before sign-in** — On a fresh DB, use **Create account** once, then **Sign in**. `npm run db:reset` wipes users; register again.
3. **Forgot the password** — Click **Forgot password?** to receive a reset link in Mailpit, then set a new password.
