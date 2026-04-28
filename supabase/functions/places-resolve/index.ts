/**
 * places-resolve
 *
 * Called when the user picks a Google Autocomplete prediction. Looks up the
 * canonical Place Details (New), upserts a row into `restaurant_places` /
 * `cafe_places` keyed by `google_place_id`, and returns the row in the same
 * camelCase shape as `fetchAll*Places` so the picker can drop it straight into
 * its local catalog.
 *
 * Dedup contract: if a row with this `google_place_id` already exists we
 * **don't** call Google again — return the cached row. The unique partial
 * index on `google_place_id` enforces this server-side too in case of a race.
 */

import { preflight, jsonResponse, corsHeaders } from "../_shared/cors.ts";
import {
  adminClient,
  cityFromAddressComponents,
  cuisineFromGoogleTypes,
  googleApiKey,
  HttpError,
  incrementAndCheckBudget,
  isKind,
  Kind,
  placesTable,
  recordAlert,
  requireUser,
} from "../_shared/places.ts";

interface ResolveBody {
  kind?: Kind;
  googlePlaceId?: string;
  sessionToken?: string;
  fallback?: { name?: string; city?: string };
}

const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";
/** Field mask: explicit list keeps Place Details on the Essentials SKU
 *  (~$0.020/call). Adding atmosphere/contact fields would jump the price. */
const FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
].join(",");

interface ResolvedPlace {
  id: string;
  name: string;
  city: string;
  cuisine: string;
  cuisine2: string;
  isFusion: boolean;
  googlePlaceId: string;
  verifiedName: string;
  verifiedCuisine: string;
  verifiedCity: string;
  lat: number | null;
  lng: number | null;
  verifiedAt: string | null;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    let body: ResolveBody;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "invalid_json");
    }
    if (!isKind(body.kind)) throw new HttpError(400, "invalid_kind");
    const googlePlaceId = (body.googlePlaceId || "").trim();
    if (!googlePlaceId) throw new HttpError(400, "missing_google_place_id");
    const sessionToken = (body.sessionToken || "").trim();
    if (!sessionToken) throw new HttpError(400, "missing_session_token");

    const admin = adminClient();
    const table = placesTable(body.kind);

    // 1. Cache hit — never call Google for a place we already verified.
    const cached = await selectByGooglePlaceId(admin, table, googlePlaceId, body.kind);
    if (cached) return jsonResponse({ place: cached, cached: true });

    // 2. Budget check before paying Google for Place Details.
    const guard = await incrementAndCheckBudget(admin);
    if (guard.capped) {
      await recordAlert(admin, {
        kind: body.kind,
        query: body.fallback?.name || "",
        userId: user.id,
        reason: "hard_cap",
        details: { count: guard.count, hard_cap: guard.hardCap, stage: "resolve" },
      });
      throw new HttpError(429, "budget_capped");
    }
    if (guard.crossedSoft) {
      recordAlert(admin, {
        kind: body.kind,
        query: body.fallback?.name || "",
        userId: user.id,
        reason: "soft_cap",
        details: { count: guard.count, soft_cap: guard.softCap, stage: "resolve" },
      });
    }

    // 3. Fetch Place Details (New) with the Essentials field mask + session
    //    token (must match the autocomplete session for billing bundling).
    const url = `${PLACE_DETAILS_URL}/${encodeURIComponent(googlePlaceId)}?sessionToken=${
      encodeURIComponent(sessionToken)
    }`;
    let details: GoogleDetails;
    try {
      const r = await fetch(url, {
        headers: {
          "X-Goog-Api-Key": googleApiKey(),
          "X-Goog-FieldMask": FIELD_MASK,
        },
      });
      if (!r.ok) {
        const text = await r.text();
        await recordAlert(admin, {
          kind: body.kind,
          query: body.fallback?.name || "",
          userId: user.id,
          reason: "google_error",
          details: { stage: "resolve", status: r.status, body: text.slice(0, 500) },
        });
        throw new HttpError(502, "google_details_failed");
      }
      details = await r.json();
    } catch (err) {
      if (err instanceof HttpError) throw err;
      await recordAlert(admin, {
        kind: body.kind,
        query: body.fallback?.name || "",
        userId: user.id,
        reason: "google_error",
        details: { stage: "resolve", thrown: String(err).slice(0, 500) },
      });
      throw new HttpError(502, "google_details_threw");
    }

    const verifiedName = details.displayName?.text || body.fallback?.name || "";
    const verifiedCity = cityFromAddressComponents(details.addressComponents || []) ||
      body.fallback?.city || "";
    const verifiedCuisine = body.kind === "restaurant"
      ? cuisineFromGoogleTypes(details.primaryType, details.types)
      : "";
    const lat = details.location?.latitude ?? null;
    const lng = details.location?.longitude ?? null;

    // 4. Upsert by google_place_id — concurrent inserts will fail the unique
    //    index, so re-select on conflict.
    const baseRow: Record<string, unknown> = {
      name: verifiedName || body.fallback?.name || "",
      city: verifiedCity || body.fallback?.city || "",
      google_place_id: googlePlaceId,
      verified_name: verifiedName || null,
      verified_city: verifiedCity || null,
      lat,
      lng,
      verified_at: new Date().toISOString(),
    };
    if (body.kind === "restaurant") {
      baseRow.cuisine = verifiedCuisine || "";
      baseRow.verified_cuisine = verifiedCuisine || null;
    }

    const { data: inserted, error: insErr } = await admin
      .from(table)
      .insert(baseRow)
      .select("*")
      .single();

    if (insErr) {
      // Race: someone else just inserted with the same google_place_id.
      const recheck = await selectByGooglePlaceId(admin, table, googlePlaceId, body.kind);
      if (recheck) return jsonResponse({ place: recheck, cached: true });
      console.error("[places-resolve] insert failed:", insErr.message);
      throw new HttpError(500, "place_insert_failed");
    }

    return jsonResponse({ place: rowToResolved(inserted, body.kind), cached: false });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error("[places-resolve] unhandled:", err);
    return new Response(
      JSON.stringify({ error: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

interface GoogleDetails {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ types?: string[]; longText?: string; shortText?: string }>;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
}

async function selectByGooglePlaceId(
  admin: ReturnType<typeof adminClient>,
  table: string,
  googlePlaceId: string,
  kind: Kind,
): Promise<ResolvedPlace | null> {
  const { data, error } = await admin
    .from(table)
    .select("*")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  if (error) {
    console.error("[places-resolve] cache lookup failed:", error.message);
    return null;
  }
  return data ? rowToResolved(data, kind) : null;
}

function rowToResolved(row: Record<string, unknown>, kind: Kind): ResolvedPlace {
  const s = (k: string) => (typeof row[k] === "string" ? (row[k] as string) : "");
  const n = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : null);
  return {
    id: s("id"),
    name: s("name"),
    city: s("city"),
    cuisine: kind === "restaurant" ? s("cuisine") : "",
    cuisine2: kind === "restaurant" ? s("cuisine2") : "",
    isFusion: kind === "restaurant" ? !!row["is_fusion"] : false,
    googlePlaceId: s("google_place_id"),
    verifiedName: s("verified_name"),
    verifiedCuisine: kind === "restaurant" ? s("verified_cuisine") : "",
    verifiedCity: s("verified_city"),
    lat: n("lat"),
    lng: n("lng"),
    verifiedAt: typeof row["verified_at"] === "string"
      ? (row["verified_at"] as string)
      : null,
  };
}
