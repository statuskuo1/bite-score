# Auth redirect: use current origin only

## Context

OAuth and magic-link flows passed `redirectTo` / `emailRedirectTo` from `VITE_AUTH_REDIRECT_URL` when set, otherwise `window.location.origin`. Production/Vercel env often sets `VITE_AUTH_REDIRECT_URL` to the main site. That value is inlined at build time, so **local `npm run dev`** (or any tab whose origin is not that URL) still sent users to production after sign-in.

## Decision

- Compute redirect base **only** from `window.location.origin` (trimmed trailing slash).
- Drop client use of **`VITE_AUTH_REDIRECT_URL`** for these redirects.

## Alternatives considered

- **Prefer origin only on localhost** — Still breaks **Vercel preview** builds when the env points at production.
- **Keep env with higher-priority override flag** — Extra configuration for a rare “canonical URL ≠ browser origin” case; not needed for this app today.

## Consequences

- **Supabase Dashboard**: every origin you use (localhost ports, production, `*.vercel.app` previews if applicable) must stay in **Redirect URLs**; Site URL can remain the primary production origin.
- **Primary file**: `src/components/AuthModal.jsx`.
