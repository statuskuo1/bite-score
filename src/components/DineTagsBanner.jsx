import { useState } from "react";
import { Avatar } from "./community/Avatar.jsx";
import { dismissDineTag } from "../utils/dineWithApi.js";
import { supabase } from "../config/supabaseClient.js";

/**
 * Banner shown on /add when the signed-in user has been tagged in
 * someone else's dine_with_tags row they haven't dismissed yet.
 *
 * Shows one card at a time. Badge in the top-right shows total pending count.
 * Both actions advance to the next card automatically.
 *
 * Props:
 *   tags      - array returned by fetchUnloggedDineTags
 *   onDismiss - (tagId) => void — called after optimistic dismiss
 *   onAddType - (type, tag) => void — jump to add form
 *   entries   - user's restaurant_visits (to detect already-logged places)
 *   cafes     - user's cafe_visits
 *   userId    - current user's id (needed for tag-back)
 */
export function DineTagsBanner({ tags, onDismiss, onAddType, entries, cafes, userId }) {
  const [taggedConfirm, setTaggedConfirm] = useState(null);
  if (!tags?.length) return null;

  const tag = tags[0];
  const who = tag.taggerProfile;
  const name = who?.display_name || who?.username || "Someone";
  const handle = who?.username ? `@${who.username}` : "";
  const count = tags.length;

  // Check if the user already has a logged entry for this place (name + city match).
  // Search both lists — a place like Kasama might be logged as restaurant by one user, cafe by another.
  const tagName = (tag.restaurant_name || "").trim().toLowerCase();
  const tagCity = (tag.city || "").trim().toLowerCase();
  const findMatch = (list) => tagName
    ? (list || []).find((e) => {
        const eName = (e.name || "").trim().toLowerCase();
        const eCity = (e.city || "").trim().toLowerCase();
        return eName === tagName && (!tagCity || !eCity || eCity === tagCity);
      })
    : null;
  const existingRestEntry = findMatch(entries);
  const existingCafeEntry = existingRestEntry ? null : findMatch(cafes);
  const existingEntry = existingRestEntry || existingCafeEntry;
  const existingEntryType = existingRestEntry ? "restaurant" : "cafe";

  async function handleDismiss() {
    onDismiss(tag.id);
    await dismissDineTag(supabase, tag.id);
  }

  function handleLogMyVisit() {
    onDismiss(tag.id);
    dismissDineTag(supabase, tag.id); // dismiss in DB — was missing before
    onAddType(tag.entry_type, tag);
  }

  async function handleTagBack() {
    if (!existingEntry) return;
    const dateStr = (() => {
      const d = new Date(existingEntry.visited_at || existingEntry.created_at);
      return isNaN(d) ? "" : " · " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    })();
    const msg = `@${who?.username || name} tagged to your ${tag.restaurant_name}${dateStr}`;
    setTaggedConfirm(msg);

    // Check for existing outgoing link — prevents duplicate rows in scenarios where
    // both users already independently tagged each other (scenarios 2 & 4).
    const { data: existingOutgoing } = await supabase
      .from("dine_with_tags")
      .select("id")
      .eq("tagger_id", userId)
      .eq("tagged_id", tag.tagger_id)
      .ilike("restaurant_name", tag.restaurant_name)
      .maybeSingle();

    await Promise.all([
      dismissDineTag(supabase, tag.id),
      // If we already tagged them back, dismiss that row too so their banner clears immediately.
      existingOutgoing && dismissDineTag(supabase, existingOutgoing.id),
      !existingOutgoing && supabase.from("dine_with_tags").insert({
        tagger_id: userId,
        tagged_id: tag.tagger_id,
        entry_id: existingEntry.id,
        entry_type: existingEntryType,
        restaurant_name: tag.restaurant_name,
        city: tag.city || "",
        cuisine: tag.cuisine || "",
        dismissed: true,
      }),
      supabase.from("notifications").insert({
        user_id: tag.tagger_id,
        from_user_id: userId,
        type: "dine_tag_back",
        meta: { restaurant_name: tag.restaurant_name, entry_type: existingEntryType, city: tag.city || "" },
      }),
    ].filter(Boolean));

    setTimeout(() => { setTaggedConfirm(null); onDismiss(tag.id); }, 4000);
  }

  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      {/* Badge — matches the notification bell badge style */}
      {count > 1 && (
        <span style={{
          position: "absolute", top: -6, right: -6, zIndex: 1,
          minWidth: 18, height: 18, padding: "0 4px",
          borderRadius: 9, background: "#E85A5A",
          color: "#FFF", fontSize: 11, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1, boxSizing: "border-box",
          border: "1.5px solid #141413",
        }}>
          {count > 99 ? "99+" : count}
        </span>
      )}

      <div style={{
        background: "#1E1E1C",
        border: "0.5px solid rgba(240,153,123,0.35)",
        borderRadius: 12,
        padding: "12px 14px",
      }}>
        {taggedConfirm && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ fontSize: 13, color: "#F1EFE8", flex: 1 }}>{taggedConfirm}</span>
            <button
              onClick={() => { setTaggedConfirm(null); onDismiss(tag.id); }}
              style={{ background: "none", border: "none", color: "#888780", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 0, flexShrink: 0 }}
            >×</button>
          </div>
        )}
        {!taggedConfirm && (<>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Avatar profile={who} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#F1EFE8", lineHeight: 1.4 }}>
                <span style={{ fontWeight: 600 }}>{name}</span>
                {handle && <span style={{ color: "#888780", marginLeft: 4 }}>{handle}</span>}
                {" "}tagged you at
              </div>
              <div style={{ fontSize: 13, color: "#F0997B", fontWeight: 500, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tag.restaurant_name}
                {tag.city ? ` · ${tag.city}` : ""}
              </div>
            </div>
          </div>

          {existingEntry ? (
            <>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 10 }}>
                Looks like you already logged this place.
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={handleTagBack}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8, border: "none",
                    background: "#F0997B", color: "#141413", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Tag them back
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  style={{
                    padding: "8px 14px", borderRadius: 8,
                    background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)",
                    color: "#888780", fontSize: 13, cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
              <button
                type="button"
                onClick={handleLogMyVisit}
                style={{
                  background: "none", border: "none", padding: 0,
                  fontSize: 12, color: "#888780", cursor: "pointer",
                  textDecoration: "underline", textDecorationColor: "rgba(136,135,128,0.4)",
                }}
              >
                Log a new visit anyway →
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleLogMyVisit}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8, border: "none",
                  background: "#F0997B", color: "#141413", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Log my visit
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)",
                  color: "#888780", fontSize: 13, cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
