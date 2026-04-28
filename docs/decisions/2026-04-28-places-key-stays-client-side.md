# Decision: Google Places key stays client-side, edge functions deferred

## Context

Earlier today we committed
[`places-search` / `places-resolve` Edge Functions](2026-04-28-google-places-verified-fields.md)
intending to keep `GOOGLE_MAPS_API_KEY` server-side. In practice the active
hot path is still
[`src/utils/googlePlacesApi.js`](../../src/utils/googlePlacesApi.js), which
calls `places:searchText` directly from the browser using
`VITE_GOOGLE_PLACES_API_KEY`. The user explicitly chose to keep this
working setup rather than wire up the edge function path right now.

## Decision

- **Keep the browser-direct path.** PlacePicker imports `searchGooglePlaces`
  / `resolveGooglePlace` from `googlePlacesApi.js`; the `places-search` and
  `places-resolve` edge functions remain in the repo as a future option but
  are **not** invoked from the client.
- **`VITE_GOOGLE_PLACES_API_KEY` is the canonical name** for the Places key
  in this project. Vite inlines it into the client bundle — that is
  intentional given this decision.
- **Storage**: key lives **only in `.env.local`** (already gitignored).
  `.env` is now also gitignored (`.gitignore` updated) to make accidental
  commits impossible. `.env` itself stays around for the public Supabase
  URL + anon key (those are safe to ship; RLS is the security boundary),
  with the Google key removed.
- **Mitigations the user owns** (not enforced in code):
  1. Restrict the key to **HTTP referrers** matching the deployed origin
     (and `localhost` for dev) in the Google Cloud Console.
  2. Set a **billing budget alert** in Google Cloud — there is no
     server-side cap on this path.
  3. Rotate the key if `dist/` was ever served from an untrusted host.

## Alternatives considered

- **Use the committed edge functions.** Rejected by the user: works fine
  client-side today, edge function path adds ops complexity (secrets,
  cold-starts, JWT verify) for a benefit (key not in bundle) that referrer
  restrictions largely cover.
- **Commit `.env` to the repo.** Rejected — even private repos leak via
  forks/clones/CI. Once a secret is in history, rotation is the only
  recourse.

## Consequences

- The "Browser never sees `GOOGLE_MAPS_API_KEY`" claim in
  [the original maps ADR](2026-04-28-google-places-verified-fields.md#decision)
  is **not currently true**; that ADR now carries a Status note pointing
  here.
- If quota/abuse becomes a problem, the migration target is already
  written — flip `PlacePicker` from `googlePlacesApi.js` to
  `supabase.functions.invoke('places-search'|'places-resolve')` and remove
  the `VITE_*` key.
- `.env` and `.env.local` both live on disk with overlapping vars; the
  active source of truth for secrets is `.env.local`. `.env` is for
  public-safe defaults only going forward.

Primary files: `.gitignore`, `.env`,
`docs/decisions/2026-04-28-google-places-verified-fields.md`.
