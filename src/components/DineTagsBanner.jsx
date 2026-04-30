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
 */
export function DineTagsBanner({ tags, onDismiss, onAddType }) {
  if (!tags?.length) return null;

  const tag = tags[0];
  const who = tag.taggerProfile;
  const name = who?.display_name || who?.username || "Someone";
  const handle = who?.username ? `@${who.username}` : "";
  const count = tags.length;

  async function handleDismiss() {
    onDismiss(tag.id);
    await dismissDineTag(supabase, tag.id);
  }

  function handleLogMyVisit() {
    onDismiss(tag.id);           // advance to next card
    onAddType(tag.entry_type, tag);
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
      </div>
    </div>
  );
}
