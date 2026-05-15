/**
 * Browser-side Google Places (New) integration for the BITE PlacePicker.
 *
 * Calls Google Places Text Search directly with `VITE_GOOGLE_PLACES_API_KEY`.
 * Text Search returns rich details (id, displayName, formattedAddress,
 * addressComponents, location, primaryType, types) in a single call, so we
 * skip the autocomplete + details two-step and don't need session tokens.
 *
 * `resolveGooglePlace` reuses the cached prediction details to insert (or
 * dedup) a row in `restaurant_places` / `cafe_places` via the regular
 * Supabase client — RLS already allows any authenticated user to insert.
 *
 * Trade-off vs. an Edge Function: the API key ships in the browser bundle,
 * and there's no server-side budget guardrail. Restrict the key by HTTP
 * referrer in the Google Cloud Console to mitigate the first; monitor
 * spend via Google's billing dashboard for the second.
 */

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

/** Field mask: explicit list keeps the call on the Essentials/Pro SKU and
 *  matches what we cache into `*_places.verified_*`. Add fields cautiously —
 *  contact / atmosphere SKUs are pricier. */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
].join(",");

/** Coarse mapping from Google primaryType -> our cuisine string. Mirrors the
 *  table in the (currently unused) Edge Function. Extend as needed. */
const CUISINE_MAP = {
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

function googleApiKey() {
  return import.meta.env.VITE_GOOGLE_PLACES_API_KEY || "";
}

/** Session-token helper kept exported so PlacePicker keeps working without
 *  changes. Text Search doesn't actually use session tokens; we pass it
 *  through but ignore it. The picker still rotates after each resolve, which
 *  is harmless. */
export function newSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const hex = (n) => Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, "0");
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
}

function normalizeKind(kind) {
  return kind === "cafe" ? "cafe" : "restaurant";
}

function cuisineFromTypes(primaryType, types) {
  if (primaryType && CUISINE_MAP[primaryType]) return CUISINE_MAP[primaryType];
  if (Array.isArray(types)) {
    for (const t of types) {
      if (CUISINE_MAP[t]) return CUISINE_MAP[t];
    }
  }
  return "";
}

function cityFromAddressComponents(components) {
  if (!Array.isArray(components)) return "";
  const pickByType = (key) => {
    const c = components.find((c) => Array.isArray(c.types) && c.types.includes(key));
    return c?.longText || "";
  };
  return (
    pickByType("locality") ||
    pickByType("postal_town") ||
    pickByType("sublocality") ||
    pickByType("administrative_area_level_3") ||
    pickByType("administrative_area_level_2") ||
    ""
  );
}

function countryCodeFromAddressComponents(components) {
  if (!Array.isArray(components)) return "";
  const c = components.find((c) => Array.isArray(c.types) && c.types.includes("country"));
  return c?.shortText || "";
}

/** Race a promise against a timer so a hung network call doesn't leave the
 *  picker stuck loading forever. */
function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ __timedOut: true, fallback }), ms);
  });
  return Promise.race([
    promise.then((v) => {
      clearTimeout(timer);
      return v;
    }),
    timeout,
  ]);
}

const SEARCH_TIMEOUT_MS = 4000;

/** Returns `{ predictions, capped, aborted }`. `predictions` is `[]` on any
 *  failure or when the typed query is too short. `capped` is always `false`
 *  here since we have no client-side budget tracking. `aborted` is true when
 *  the caller's `signal` fired — callers should ignore the result rather than
 *  setting empty state.
 *
 *  Pass an `AbortSignal` so PlacePicker can drop in-flight fetches when the
 *  user keeps typing (otherwise we burn Google quota and risk per-IP 429s
 *  from rapid bursts of stale requests). */
export async function searchGooglePlaces(client, { kind, query, cityHint, sessionToken: _sessionToken, locationBias, signal }) {
  const q = (query || "").trim();
  if (q.length < 2) return { predictions: [], capped: false, aborted: false };
  const key = googleApiKey();
  if (!key) {
    console.warn("[BITE] VITE_GOOGLE_PLACES_API_KEY not set; Google Places search disabled.");
    return { predictions: [], capped: false, aborted: false };
  }
  try {
    /** Append the form's typed City (if any) directly to the textQuery so
     *  Google biases predictions to that city instead of the caller's IP.
     *  Free-text city tokens (e.g. "Chicago", "Tokyo") are resolved natively
     *  by Text Search, so we don't need a geocoding round-trip. The
     *  coordinate-based `locationBias` branch below is left intact for a
     *  future upgrade that caches city → lat/lng. */
    const cityToken = (cityHint || "").trim();
    const textQuery = cityToken ? `${q} ${cityToken}` : q;
    const body = {
      textQuery,
      /** No includedType — froyo/dessert/ice cream shops aren't typed "cafe" or
       *  "restaurant" in Google's taxonomy, so filtering by type drops them.
       *  The form context (CafeForm vs RestForm) is already enough scoping. */
      strictTypeFiltering: false,
      maxResultCount: 6,
    };
    if (locationBias?.lat != null && locationBias?.lng != null && locationBias?.radiusMeters != null) {
      body.locationBias = {
        circle: {
          center: { latitude: locationBias.lat, longitude: locationBias.lng },
          radius: locationBias.radiusMeters,
        },
      };
    }
    const fetchPromise = fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal,
    });
    const r = await withTimeout(fetchPromise, SEARCH_TIMEOUT_MS, { __timedOut: true });
    if (r?.__timedOut) {
      console.warn("[BITE] places:searchText timed out");
      return { predictions: [], capped: false, aborted: false };
    }
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.warn("[BITE] places:searchText error:", r.status, text.slice(0, 300));
      return { predictions: [], capped: false, aborted: false };
    }
    const json = await r.json();
    const places = Array.isArray(json?.places) ? json.places : [];
    const predictions = places
      .filter((p) => p?.id && p?.displayName?.text)
      .map((p) => ({
        placeId: p.id,
        primaryText: p.displayName.text,
        secondaryText: p.formattedAddress || "",
        details: {
          verifiedName: p.displayName.text,
          verifiedAddress: p.formattedAddress || "",
          verifiedCity: cityFromAddressComponents(p.addressComponents || []),
          countryCode: countryCodeFromAddressComponents(p.addressComponents || []),
          verifiedCuisine: cuisineFromTypes(p.primaryType, p.types),
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
        },
      }));
    return { predictions, capped: false, aborted: false };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { predictions: [], capped: false, aborted: true };
    }
    console.warn("[BITE] places:searchText threw:", err);
    return { predictions: [], capped: false, aborted: false };
  }
}

/** Upserts the prediction into `*_places` keyed by `google_place_id`. The
 *  prediction object should be one returned by `searchGooglePlaces` (carries
 *  `details`) — the picker passes it through verbatim. Returns a row in the
 *  catalog shape consumed by RestForm/CafeForm autopopulate, or `null` on
 *  any failure. */
export async function resolveGooglePlace(client, { kind, googlePlaceId, prediction, fallback }) {
  if (!googlePlaceId) return null;
  const table = kind === "cafe" ? "cafe_places" : "restaurant_places";
  const isRestaurant = kind !== "cafe";

  // 1. Cache hit by google_place_id — never insert duplicates.
  try {
    const { data: existing, error: selErr } = await client
      .from(table)
      .select("*")
      .eq("google_place_id", googlePlaceId)
      .maybeSingle();
    if (selErr) {
      console.warn("[BITE] places cache select failed:", selErr.message);
    }
    if (existing?.id) return rowToCatalogShape(existing, isRestaurant);
  } catch (err) {
    console.warn("[BITE] places cache select threw:", err);
  }

  // 2. Insert new row with verified_* fields populated from the prediction.
  const d = prediction?.details || {};
  const fbName = fallback?.name || prediction?.primaryText || "";
  const fbCity = fallback?.city || "";
  const verifiedName = d.verifiedName || fbName;
  const verifiedCity = d.verifiedCity || fbCity;
  const verifiedCuisine = isRestaurant ? (d.verifiedCuisine || "") : "";

  const baseRow = {
    name: verifiedName || fbName || "",
    city: verifiedCity || fbCity || "",
    google_place_id: googlePlaceId,
    verified_name: verifiedName || null,
    verified_city: verifiedCity || null,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    verified_at: new Date().toISOString(),
  };
  if (isRestaurant) {
    baseRow.cuisine = verifiedCuisine || "";
    baseRow.verified_cuisine = verifiedCuisine || null;
  }

  try {
    const { data: inserted, error: insErr } = await client
      .from(table)
      .insert(baseRow)
      .select("*")
      .single();
    if (insErr) {
      // Race: another tab/user just inserted with the same google_place_id.
      // Re-select and use that row.
      const { data: recheck } = await client
        .from(table)
        .select("*")
        .eq("google_place_id", googlePlaceId)
        .maybeSingle();
      if (recheck?.id) return rowToCatalogShape(recheck, isRestaurant);
      console.warn("[BITE] places insert failed:", insErr.message);
      return null;
    }
    return rowToCatalogShape(inserted, isRestaurant);
  } catch (err) {
    console.warn("[BITE] places insert threw:", err);
    return null;
  }
}

function rowToCatalogShape(row, isRestaurant) {
  return {
    id: row.id,
    name: row.name || "",
    city: row.city || "",
    cuisine: isRestaurant ? (row.cuisine || "") : "",
    cuisine2: isRestaurant ? (row.cuisine2 || "") : "",
    isFusion: isRestaurant ? !!row.is_fusion : false,
    googlePlaceId: row.google_place_id || "",
    verifiedName: row.verified_name || "",
    verifiedCuisine: isRestaurant ? (row.verified_cuisine || "") : "",
    verifiedCity: row.verified_city || "",
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    verifiedAt: row.verified_at || null,
  };
}

// Re-exported for normalizeKind compatibility (unused by callers but kept so
// any future test harness can import the helper).
export { normalizeKind as _normalizeKind };
