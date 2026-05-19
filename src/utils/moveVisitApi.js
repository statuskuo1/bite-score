import { canMutateVisit } from "./rowAccess.js";
import { mapRestaurantVisitRow, mapCafeVisitRow } from "./visitPlacesApi.js";

const REST_SELECT = "*, restaurant_places(name, cuisine, cuisine2, is_fusion, city)";
const CAFE_SELECT = "*, cafe_places(name, city)";

/**
 * Move a visit from one category to the other (restaurant ↔ café).
 *
 * Preserves all shared fields (taste, cost, portions, wait, repeatability,
 * use_r, notes, visited_at). Café-specific fields default to blank on move-in.
 *
 * The source place is looked up to copy google_place_id / verified fields
 * into the destination place table if a new row needs to be created.
 *
 * Returns the mapped destination entry (same shape as mapRestaurantVisitRow /
 * mapCafeVisitRow), or throws on any DB error.
 *
 * @param {object}  client   Supabase client
 * @param {object}  visit    Mapped visit entry (from st.entries or cafes)
 * @param {"restaurant"|"cafe"} fromKind
 * @param {object}  user     Authenticated user ({ id })
 */
export async function moveVisit(client, { visit, fromKind, user }) {
  if (!canMutateVisit(visit, user)) throw new Error("Not authorized");

  const toKind = fromKind === "restaurant" ? "cafe" : "restaurant";
  const srcPlacesTable = fromKind === "restaurant" ? "restaurant_places" : "cafe_places";
  const dstPlacesTable = toKind === "restaurant" ? "restaurant_places" : "cafe_places";
  const srcTable = fromKind === "restaurant" ? "restaurant_visits" : "cafe_visits";
  const dstTable = toKind === "restaurant" ? "restaurant_visits" : "cafe_visits";
  const dstSelect = toKind === "restaurant" ? REST_SELECT : CAFE_SELECT;

  // 1. Fetch source place so we can mirror it into the destination catalog.
  const { data: srcPlace } = await client
    .from(srcPlacesTable)
    .select("id, name, city, google_place_id, verified_name, verified_city, verified_address, lat, lng, country_code, cuisine, cuisine2, is_fusion")
    .eq("id", visit.placeId)
    .maybeSingle();

  const placeName = srcPlace?.verified_name || srcPlace?.name || visit.name || "";
  const placeCity = srcPlace?.verified_city || srcPlace?.city || visit.city || "";
  const googlePlaceId = srcPlace?.google_place_id || null;

  // 2. Find or create the matching place in the destination table.
  let dstPlaceId = null;

  if (googlePlaceId) {
    const { data: byGoogle } = await client
      .from(dstPlacesTable)
      .select("id")
      .eq("google_place_id", googlePlaceId)
      .maybeSingle();
    if (byGoogle?.id) dstPlaceId = byGoogle.id;
  }

  if (!dstPlaceId && placeName) {
    const { data: byName } = await client
      .from(dstPlacesTable)
      .select("id")
      .ilike("name", placeName)
      .limit(1)
      .maybeSingle();
    if (byName?.id) dstPlaceId = byName.id;
  }

  if (!dstPlaceId) {
    const payload = {
      name: placeName,
      city: placeCity,
      ...(googlePlaceId ? { google_place_id: googlePlaceId } : {}),
      ...(srcPlace?.verified_name ? { verified_name: srcPlace.verified_name } : {}),
      ...(srcPlace?.verified_city ? { verified_city: srcPlace.verified_city } : {}),
      ...(srcPlace?.verified_address ? { verified_address: srcPlace.verified_address } : {}),
      ...(srcPlace?.lat != null ? { lat: srcPlace.lat } : {}),
      ...(srcPlace?.lng != null ? { lng: srcPlace.lng } : {}),
      ...(srcPlace?.country_code ? { country_code: srcPlace.country_code } : {}),
    };
    if (toKind === "restaurant") {
      payload.cuisine = srcPlace?.cuisine || "";
      payload.cuisine2 = srcPlace?.cuisine2 || "";
      payload.is_fusion = !!srcPlace?.is_fusion;
    }
    const { data: newPlace, error: placeErr } = await client
      .from(dstPlacesTable)
      .insert(payload)
      .select("id")
      .single();
    if (placeErr) throw placeErr;
    dstPlaceId = newPlace.id;
  }

  // 3. Insert destination visit with shared fields.
  const shared = {
    place_id: dstPlaceId,
    user_id: user.id,
    taste: visit.taste,
    cost: visit.cost,
    currency_code: visit.currency_code || "USD",
    portions: visit.portions,
    wait: visit.wait || 0,
    repeatability: visit.repeatability,
    use_r: visit.useR !== false,
    notes: visit.notes || "",
    ...(visit.visitedAt ? { visited_at: visit.visitedAt } : {}),
  };
  const cafeDefaults = toKind === "cafe" ? {
    category: "Coffee",
    order_item: "",
    milk_level: "",
    bean_region: "",
    roast: "",
    acidity: null,
    body: null,
    sweetness: null,
    flavor_notes: [],
  } : {};

  const { data: newRow, error: insertErr } = await client
    .from(dstTable)
    .insert({ ...shared, ...cafeDefaults })
    .select(dstSelect)
    .single();
  if (insertErr) throw insertErr;

  // 3b. Re-link any group_visit_members rows that referenced the old visit so
  //     the mover stays connected to the shared dining event after the move.
  //     We null the old FK and set the new one in a single UPDATE — satisfying
  //     the at-most-one constraint without a transient violation.
  const oldCol = `${fromKind}_visit_id`;
  const newCol = `${toKind}_visit_id`;
  const { data: members } = await client
    .from("group_visit_members")
    .select("id")
    .eq(oldCol, visit.id);
  if (members?.length) {
    await client
      .from("group_visit_members")
      .update({ [newCol]: newRow.id, [oldCol]: null })
      .in("id", members.map((m) => m.id));
  }

  // 4. Delete source visit. The FK cascade is now a no-op since we already
  //    nulled the old column in group_visit_members above.
  const { error: deleteErr } = await client
    .from(srcTable)
    .delete()
    .eq("id", visit.id);
  if (deleteErr) {
    console.error("[BITE] moveVisit: source delete failed after insert:", deleteErr.message);
    throw deleteErr;
  }

  return toKind === "restaurant"
    ? mapRestaurantVisitRow(newRow)
    : mapCafeVisitRow(newRow);
}
