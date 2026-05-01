/**
 * public.profiles helpers — sync from Supabase Auth user metadata (OAuth / magic link).
 */

/** Build profile fields from auth.user (user_metadata + email). Username is forced lowercase to match the lowercase-only allowed alphabet. */
export function profilePayloadFromUser(user) {
  if (!user?.id) return null;
  const meta = user.user_metadata || {};
  const email = user.email || "";
  const prefix = email.includes("@") ? email.split("@")[0] : (email || "user");
  const displayName =
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    prefix;
  const username =
    meta.preferred_username ||
    meta.user_name ||
    meta.username ||
    prefix;
  const avatarUrl = meta.avatar_url || meta.picture || null;
  return {
    username: String(username).toLowerCase().slice(0, 80),
    display_name: String(displayName).slice(0, 120),
    avatar_url: avatarUrl ? String(avatarUrl).slice(0, 2048) : null,
  };
}

export async function fetchProfileById(client, userId) {
  if (!userId) return null;
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.warn("[BITE] fetchProfileById:", error.message);
    return null;
  }
  return data;
}

/**
 * Resolve a profile by username. `ilike` matches the lowercase-unique index
 * from `20260504_profiles_username_lowercase.sql` while tolerating any
 * historical mixed-case rows.
 */
export async function fetchProfileByUsername(client, username) {
  if (!username) return null;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .ilike("username", username)
    .maybeSingle();
  if (error) {
    console.warn("[BITE] fetchProfileByUsername:", error.message);
    return null;
  }
  return data;
}

/**
 * After sign-in: ensure a profile row exists and backfill display fields from OAuth when empty.
 */
export async function ensureProfile(client, user) {
  if (!user?.id) return null;
  const payload = profilePayloadFromUser(user);
  if (!payload) return null;

  const existing = await fetchProfileById(client, user.id);
  if (existing) {
    const needsFill =
      (!existing.display_name || String(existing.display_name).trim() === "") ||
      (!existing.username || String(existing.username).trim() === "") ||
      (!existing.avatar_url && payload.avatar_url);

    if (needsFill) {
      const { error } = await client
        .from("profiles")
        .update({
          username: existing.username?.trim() ? existing.username : payload.username,
          display_name: existing.display_name?.trim() ? existing.display_name : payload.display_name,
          avatar_url: existing.avatar_url?.trim() ? existing.avatar_url : payload.avatar_url,
        })
        .eq("id", user.id);
      if (error) console.warn("[BITE] profile update:", error.message);
      return fetchProfileById(client, user.id);
    }
    return existing;
  }

  const { error } = await client.from("profiles").insert({
    id: user.id,
    ...payload,
  });
  if (error) {
    if (error.code === "23505") {
      return fetchProfileById(client, user.id);
    }
    console.warn("[BITE] profile insert:", error.message);
    return fetchProfileById(client, user.id);
  }
  return fetchProfileById(client, user.id);
}

/** Username format guard. Lowercase-only alphabet so the column matches the case-insensitive unique index without surprises. DB is the final source of truth. */
export const USERNAME_PATTERN = /^[a-z0-9_.-]{2,30}$/;

export function validateUsername(value) {
  const v = String(value ?? "").trim();
  if (!USERNAME_PATTERN.test(v)) return "invalid_format";
  return null;
}

/**
 * Resolve a username to the auth.users.email behind it via the
 * `email_for_username` RPC (security definer; see
 * `supabase/migrations/20260505_auth_email_for_username_rpc.sql`).
 * Returns the email string on hit, or `null` on miss / invalid input / RPC
 * error. The caller can feed the result straight into
 * `supabase.auth.signInWithPassword({ email, password })`.
 */
export async function fetchEmailForUsername(client, username) {
  const u = String(username ?? "").trim().toLowerCase();
  if (validateUsername(u)) return null;
  const { data, error } = await client.rpc("email_for_username", { p_username: u });
  if (error) {
    console.warn("[BITE] email_for_username RPC failed:", error.message);
    return null;
  }
  return typeof data === "string" && data.includes("@") ? data : null;
}

/**
 * Returns true when the identifier (email or username) matches an account whose
 * only auth identity is OAuth (no `email` provider). Wraps the
 * `account_uses_oauth_only` RPC from
 * `supabase/migrations/20260506_auth_account_uses_oauth_only.sql`.
 *
 * Designed to be called only AFTER a failed signInWithPassword attempt — a
 * `true` return uniquely means "stop trying passwords, this user must sign in
 * with Google." Non-existent accounts return false to avoid enumeration.
 *
 * Resolves to false on RPC error so the caller falls back to the generic
 * invalid-login message rather than masking a network problem.
 */
export async function accountUsesOauthOnly(client, identifier) {
  const id = String(identifier ?? "").trim();
  if (!id) return false;
  const { data, error } = await client.rpc("account_uses_oauth_only", { p_identifier: id });
  if (error) {
    console.warn("[BITE] account_uses_oauth_only RPC failed:", error.message);
    return false;
  }
  return data === true;
}

/**
 * Update own profile. Returns { ok, code, data }.
 *  - code "username_taken"    : another profile already owns this username (case-insensitive),
 *                               surfaced via a pre-check or a Postgres 23505 backstop.
 *  - code "invalid_username"  : client-side pattern check failed
 *  - code "network"           : any other Supabase error
 *  - code null + ok=true      : success, data is the refreshed row
 *
 * Inputs are lowercased before validation so callers don't need to normalize.
 * `displayName === ""` is sent as null so the column can be cleared cleanly.
 *
 * The pre-check (`select … where lower(username) = $u and id <> $userId`) is the
 * primary "taken" detector; the DB unique index is a backstop for the
 * pre-check↔update race window. This means the UX still works even on installs
 * where the partial unique index hasn't been applied yet.
 */
export async function updateOwnProfile(client, userId, { username, displayName, homeCurrency, homeCity }) {
  if (!userId) return { ok: false, code: "network", data: null };

  const u = String(username ?? "").trim().toLowerCase();
  if (validateUsername(u)) return { ok: false, code: "invalid_username", data: null };

  const { data: clash, error: checkErr } = await client
    .from("profiles")
    .select("id")
    .ilike("username", u)
    .neq("id", userId)
    .limit(1)
    .maybeSingle();
  if (checkErr) {
    console.warn("[BITE] updateOwnProfile pre-check:", checkErr.message);
    return { ok: false, code: "network", data: null };
  }
  if (clash) return { ok: false, code: "username_taken", data: null };

  const dn = String(displayName ?? "").trim();

  // Core fields — always present on profiles table.
  const { error } = await client
    .from("profiles")
    .update({
      username: u,
      display_name: dn === "" ? null : dn.slice(0, 120),
    })
    .eq("id", userId);
  if (error) {
    if (error.code === "23505") return { ok: false, code: "username_taken", data: null };
    console.warn("[BITE] updateOwnProfile:", error.message);
    return { ok: false, code: "network", data: null };
  }

  // Optional columns (added via migrations — silently skip if not yet applied).
  const optPatch = {
    ...(homeCurrency ? { home_currency: homeCurrency } : {}),
    ...(homeCity !== undefined ? { home_city: String(homeCity).trim().slice(0, 100) } : {}),
  };
  if (Object.keys(optPatch).length > 0) {
    const { error: optErr } = await client.from("profiles").update(optPatch).eq("id", userId);
    if (optErr) console.warn("[BITE] updateOwnProfile optional fields:", optErr.message);
  }

  const fresh = await fetchProfileById(client, userId);
  return { ok: true, code: null, data: fresh };
}

/** Save home_currency alone without touching username/displayName. */
export async function updateHomeCurrency(client, userId, currencyCode) {
  if (!userId) return;
  const { error } = await client
    .from("profiles")
    .update({ home_currency: currencyCode })
    .eq("id", userId);
  if (error) console.warn("[BITE] updateHomeCurrency:", error.message);
}

/** Lowercase, strip to allowed alphabet, drop trailing separators, cap at 22 chars (room for suffixes within 30). */
function deriveUsernameBase(typed) {
  let b = String(typed ?? "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  b = b.replace(/[_.\-]+$/, "");
  return b.slice(0, 22);
}

function randDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randAlnum(n) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * Suggest up to `max` available alternatives for a taken username. Single DB round-trip.
 *
 * Generates ~8 client-side variants from the typed base (numeric + suffixed mix), drops
 * malformed / over-length ones, then runs one `select` to filter out the ones already in
 * `profiles`. Returns a string[] of up to `max` available candidates (best-effort: may be
 * empty if the base is too short or all variants happen to be taken).
 *
 * Note: the `.in()` filter is case-sensitive but candidates are already lowercase
 * (see deriveUsernameBase / randAlnum), so post-migration this lines up with the
 * lowercased column. `updateOwnProfile`'s case-insensitive pre-check is the
 * authoritative "taken" detector on Save; if a clicked suggestion still races
 * to `username_taken`, fresh suggestions are fetched and shown.
 */
export async function suggestAvailableUsernames(client, typed, max = 3) {
  const base = deriveUsernameBase(typed);
  if (base.length < 2) return [];

  const raw = [
    `${base}2`,
    `${base}3`,
    `${base}4`,
    `${base}_${randDigits(2)}`,
    `${base}.${randDigits(1)}`,
    `${base}-${randAlnum(3)}`,
    `${base}${randDigits(2)}`,
    `${base}_${randAlnum(2)}`,
  ];
  const candidates = [...new Set(raw)].filter(
    (v) => v.length <= 30 && USERNAME_PATTERN.test(v)
  );
  if (!candidates.length) return [];

  const lowered = candidates.map((v) => v.toLowerCase());
  const { data, error } = await client.from("profiles").select("username").in("username", lowered);
  if (error) {
    console.warn("[BITE] suggestAvailableUsernames:", error.message);
    return [];
  }
  const taken = new Set((data || []).map((r) => String(r.username || "").toLowerCase()));
  const available = [];
  for (const c of candidates) {
    if (taken.has(c.toLowerCase())) continue;
    available.push(c);
    if (available.length >= max) break;
  }
  return available;
}
