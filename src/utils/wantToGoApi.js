export async function addWantToGo(client, userId, { placeId, kind, name, cuisine, city }) {
  if (!userId || !placeId) return { ok: false };
  const { error } = await client.from("want_to_go").upsert(
    { user_id: userId, place_id: placeId, kind, name, cuisine: cuisine || null, city: city || null },
    { onConflict: "user_id,place_id,kind", ignoreDuplicates: true },
  );
  if (error) console.warn("[BITE] addWantToGo:", error.message);
  return { ok: !error };
}
