/**
 * places-search
 *
 * Wraps Google Places Autocomplete (New) for the BITE PlacePicker. Called
 * from the browser via `supabase.functions.invoke('places-search', { body })`
 * once the catalog typeahead has nothing matching the typed string.
 *
 * Guardrail (per docs/decisions/2026-04-28-google-places-verified-fields.md):
 *   - increments a monthly counter (`places_api_usage_increment` RPC) on every
 *     call that's about to hit Google,
 *   - emits an alert + optional webhook when soft cap is crossed (still serves),
 *   - returns `{ predictions: [], capped: true }` once hard cap is exceeded so
 *     the picker silently falls back to the manual "+ Add new" branch.
 */

import { preflight, jsonResponse, corsHeaders } from "../_shared/cors.ts";
import {
  adminClient,
  googleApiKey,
  HttpError,
  incrementAndCheckBudget,
  isKind,
  Kind,
  recordAlert,
  requireUser,
} from "../_shared/places.ts";

interface SearchBody {
  kind?: Kind;
  query?: string;
  sessionToken?: string;
  /** Optional center+radius. Picker can skip entirely; Autocomplete handles
   *  global queries fine without bias. */
  locationBias?: {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
  };
}

interface AutocompletePrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

/** Constrain the type filter so we don't get gas stations / hotels in
 *  restaurant search. Cafes accept bakery so soft-serve / pastry shops show. */
function includedPrimaryTypes(kind: Kind): string[] {
  return kind === "restaurant"
    ? ["restaurant", "food"]
    : ["cafe", "coffee_shop", "bakery"];
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    let body: SearchBody;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "invalid_json");
    }
    if (!isKind(body.kind)) throw new HttpError(400, "invalid_kind");
    const query = (body.query || "").trim();
    if (query.length < 2) return jsonResponse({ predictions: [], capped: false });
    const sessionToken = (body.sessionToken || "").trim();
    if (!sessionToken) throw new HttpError(400, "missing_session_token");

    const admin = adminClient();
    const guard = await incrementAndCheckBudget(admin);

    if (guard.capped) {
      // Don't await — fire-and-forget so the picker isn't blocked on Slack
      // taking 600ms. Alert row insert is awaited so we don't lose the record.
      await recordAlert(admin, {
        kind: body.kind,
        query,
        userId: user.id,
        reason: "hard_cap",
        details: { count: guard.count, hard_cap: guard.hardCap },
      });
      return jsonResponse({ predictions: [], capped: true });
    }
    if (guard.crossedSoft) {
      // Cross of soft cap is informational. Don't block the response — the
      // alert + webhook are observability for the operator.
      recordAlert(admin, {
        kind: body.kind,
        query,
        userId: user.id,
        reason: "soft_cap",
        details: { count: guard.count, soft_cap: guard.softCap },
      });
    }

    const reqBody: Record<string, unknown> = {
      input: query,
      sessionToken,
      includedPrimaryTypes: includedPrimaryTypes(body.kind),
    };
    if (
      body.locationBias?.lat != null &&
      body.locationBias?.lng != null &&
      body.locationBias?.radiusMeters != null
    ) {
      reqBody.locationBias = {
        circle: {
          center: {
            latitude: body.locationBias.lat,
            longitude: body.locationBias.lng,
          },
          radius: body.locationBias.radiusMeters,
        },
      };
    }

    let predictions: AutocompletePrediction[] = [];
    try {
      const r = await fetch(AUTOCOMPLETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey(),
        },
        body: JSON.stringify(reqBody),
      });
      if (!r.ok) {
        const text = await r.text();
        await recordAlert(admin, {
          kind: body.kind,
          query,
          userId: user.id,
          reason: "google_error",
          details: { status: r.status, body: text.slice(0, 500) },
        });
        // Soft-fail: picker falls back to manual add.
        return jsonResponse({ predictions: [], capped: false });
      }
      const json = await r.json() as {
        suggestions?: Array<{
          placePrediction?: {
            placeId: string;
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
            text?: { text?: string };
          };
        }>;
      };
      predictions = (json.suggestions || [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => !!p && !!p.placeId)
        .map((p) => ({
          placeId: p.placeId,
          primaryText: p.structuredFormat?.mainText?.text || p.text?.text || "",
          secondaryText: p.structuredFormat?.secondaryText?.text || "",
        }))
        .filter((p) => p.primaryText);
    } catch (err) {
      await recordAlert(admin, {
        kind: body.kind,
        query,
        userId: user.id,
        reason: "google_error",
        details: { thrown: String(err).slice(0, 500) },
      });
      return jsonResponse({ predictions: [], capped: false });
    }

    return jsonResponse({ predictions, capped: false });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error("[places-search] unhandled:", err);
    return new Response(
      JSON.stringify({ error: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
