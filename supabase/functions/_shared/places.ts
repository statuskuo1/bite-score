/**
 * Shared helpers for the Google Places Edge Functions:
 * - admin/user Supabase clients
 * - JWT auth gate
 * - budget guardrail (soft/hard cap + optional webhook)
 * - cuisine mapping from Google primaryType -> our taxonomy
 * - Google address-component -> city extraction
 *
 * Pricing context (Google Places API New, as of 2026):
 *   Autocomplete (New) — ~$0.0285 / call (no session) or $0.0017 / session
 *     when bundled with a Place Details (Essentials) call inside the same
 *     session token. We always pass a session token from the client.
 *   Place Details (New) — ~$0.020 / call (Essentials SKU).
 * $200/mo free credit -> ~6,000 unique places worth of full sessions.
 * Defaults below leave headroom (~80% / 95%) for the soft + hard caps.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SOFT_CAP_DEFAULT = 5000;
const HARD_CAP_DEFAULT = 6000;

export type Kind = "restaurant" | "cafe";

export function isKind(v: unknown): v is Kind {
  return v === "restaurant" || v === "cafe";
}

export function placesTable(kind: Kind): string {
  return kind === "restaurant" ? "restaurant_places" : "cafe_places";
}

/** Service-role client used for usage counter, alerts, and *_places upserts. */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export interface AuthedUser {
  id: string;
  email?: string;
}

/** Verify the caller's JWT. Anonymous callers are rejected — these functions
 *  are meant to be invoked from the signed-in PlacePicker only. */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) throw new HttpError(401, "missing_authorization");
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, "invalid_jwt");
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

/** Current YYYY-MM in UTC (the budget resets monthly with Google's billing). */
export function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export interface UsageGuardResult {
  count: number;
  softCap: number;
  hardCap: number;
  capped: boolean; // true once we're at/over hardCap — caller must abort
  crossedSoft: boolean; // true on the call that pushes count past softCap
}

/** Atomically increment the monthly counter and decide whether to proceed. If
 *  hard cap is exceeded the increment still happened — we accept the small
 *  over-count rather than gate behind a transaction, since the guardrail is
 *  best-effort budget protection, not exact accounting. */
export async function incrementAndCheckBudget(
  admin: SupabaseClient,
): Promise<UsageGuardResult> {
  const softCap = parseInt(Deno.env.get("PLACES_API_SOFT_CAP") || "", 10) ||
    SOFT_CAP_DEFAULT;
  const hardCap = parseInt(Deno.env.get("PLACES_API_HARD_CAP") || "", 10) ||
    HARD_CAP_DEFAULT;
  const ym = currentYearMonth();
  const { data, error } = await admin.rpc("places_api_usage_increment", {
    p_year_month: ym,
  });
  if (error) throw new HttpError(500, `usage_increment_failed: ${error.message}`);
  const count = typeof data === "number" ? data : Number(data) || 0;
  return {
    count,
    softCap,
    hardCap,
    capped: count > hardCap,
    crossedSoft: count > softCap && count <= softCap + 1,
  };
}

/** Insert an alert row. Optionally fires the Slack/Discord-style webhook so
 *  ykuo gets a real-time ping. Webhook failures are swallowed (alert row is
 *  the durable record). */
export async function recordAlert(
  admin: SupabaseClient,
  payload: {
    kind: Kind;
    query?: string;
    userId?: string;
    reason: "soft_cap" | "hard_cap" | "google_error";
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const row = {
    kind: payload.kind,
    query: payload.query || "",
    user_id: payload.userId ?? null,
    reason: payload.reason,
    details: payload.details ?? {},
  };
  const { error } = await admin.from("places_api_alerts").insert(row);
  if (error) console.error("[places] alert insert failed:", error.message);

  const webhook = Deno.env.get("PLACES_API_ALERT_WEBHOOK_URL");
  if (!webhook) return;
  const text = formatWebhookText(payload);
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text, ...row }),
    });
  } catch (err) {
    console.error("[places] alert webhook failed:", err);
  }
}

function formatWebhookText(p: {
  kind: Kind;
  query?: string;
  reason: "soft_cap" | "hard_cap" | "google_error";
  details?: Record<string, unknown>;
}): string {
  const tag = p.reason === "hard_cap"
    ? "BLOCKED (hard cap)"
    : p.reason === "soft_cap"
    ? "WARNING (soft cap)"
    : "Google error";
  const q = p.query ? ` query="${p.query}"` : "";
  const extra = p.details && Object.keys(p.details).length
    ? ` ${JSON.stringify(p.details)}`
    : "";
  return `[BITE places] ${tag} kind=${p.kind}${q}${extra}`;
}

/** Coarse mapping from Google primaryType -> our cuisine string. Returns "" for
 *  generic types (`restaurant`, `food`, `point_of_interest`) so the form
 *  doesn't overwrite a more specific user-typed cuisine with a useless one.
 *  Extend as needed; keys that aren't present fall through to "". */
const CUISINE_MAP: Record<string, string> = {
  italian_restaurant: "Italian",
  chinese_restaurant: "Chinese",
  japanese_restaurant: "Japanese",
  sushi_restaurant: "Japanese",
  ramen_restaurant: "Japanese",
  korean_restaurant: "Korean",
  mexican_restaurant: "Mexican",
  thai_restaurant: "Thai",
  french_restaurant: "French",
  indian_restaurant: "Indian",
  vietnamese_restaurant: "Vietnamese",
  greek_restaurant: "Greek",
  spanish_restaurant: "Spanish",
  turkish_restaurant: "Turkish",
  middle_eastern_restaurant: "Middle Eastern",
  lebanese_restaurant: "Lebanese",
  mediterranean_restaurant: "Mediterranean",
  american_restaurant: "American",
  brazilian_restaurant: "Brazilian",
  argentinian_restaurant: "Argentinian",
  seafood_restaurant: "Seafood",
  steak_house: "Steakhouse",
  pizza_restaurant: "Pizza",
  hamburger_restaurant: "American",
  sandwich_shop: "Sandwich",
  barbecue_restaurant: "BBQ",
  bakery: "Bakery",
  fine_dining_restaurant: "Fine Dining",
  fast_food_restaurant: "Fast Food",
  vegan_restaurant: "Vegan",
  vegetarian_restaurant: "Vegetarian",
};

export function cuisineFromGoogleTypes(
  primaryType?: string,
  types?: string[],
): string {
  if (primaryType && CUISINE_MAP[primaryType]) return CUISINE_MAP[primaryType];
  if (Array.isArray(types)) {
    for (const t of types) {
      if (CUISINE_MAP[t]) return CUISINE_MAP[t];
    }
  }
  return "";
}

/** Pull a human "city" out of Google's addressComponents. Falls back through
 *  locality -> postal_town -> sublocality -> admin_area_level_3, since cities
 *  surface under different keys depending on country (NYC: locality, Tokyo:
 *  locality with sublocalities, London suburbs: postal_town, etc.). */
export function cityFromAddressComponents(
  components: Array<{ types?: string[]; longText?: string; shortText?: string }>,
): string {
  if (!Array.isArray(components)) return "";
  const pickByType = (key: string) =>
    components.find((c) => Array.isArray(c.types) && c.types.includes(key))
      ?.longText || "";
  return (
    pickByType("locality") ||
    pickByType("postal_town") ||
    pickByType("sublocality") ||
    pickByType("administrative_area_level_3") ||
    pickByType("administrative_area_level_2") ||
    ""
  );
}

export function googleApiKey(): string {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) throw new HttpError(500, "missing_google_maps_api_key");
  return key;
}
