import { useState } from "react";
import { Avatar } from "./community/Avatar.jsx";
import { dismissDineTag, joinExistingGroupVisit } from "../utils/groupVisitsApi.js";
import { supabase } from "../config/supabaseClient.js";

/**
 * Banner shown on /add when the signed-in user has a pending
 * group_visit_members row (someone tagged them in a group visit they
 * haven't logged yet). Sourced via fetch_pending_tags_for_user RPC.
 *
 * Shows one card at a time. Badge in the top-right shows total pending count.
 * Both actions advance to the next card automatically.
 *
 * Props:
 *   tags      - array returned by fetchUnloggedDineTags (v2 shape with
 *               member_id + group_visit_id surfaced)
 *   onDismiss - (memberId) => void — called after optimistic dismiss
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

  // "Tag to my entry" — flips the user's pending group_visit_members row
  // to status='logged' and attaches their existing visit_id, via
  // joinExistingGroupVisit. The auto-resolve trigger then handles the
  // "whole party logged" fan-out via group_visit_all_logged.
  //
  // Pre-Phase-2 of the dine_with_tags deprecation, this also wrote a
  // reciprocal dine_with_tags row to drive feed/log co-diner pills.
  // Post-Phase-2 those pills read directly from group_visit_members via
  // fetch_co_diners_for_entries_v2, so flipping the member row is the
  // sole canonical write that achieves the same downstream effect.
  // existingEntryType is unused here but kept in the surrounding scope
  // for future use (variant detection, etc).
  async function handleTagToMyEntry() {
    if (!existingEntry) return;
    void existingEntryType;
    const dateStr = (() => {
      const d = new Date(existingEntry.visited_at || existingEntry.created_at);
      return isNaN(d) ? "" : " · " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    })();
    const msg = `@${who?.username || name} tagged to your ${tag.restaurant_name}${dateStr}`;
    setTaggedConfirm(msg);

    if (tag.group_visit_id && userId) {
      await joinExistingGroupVisit(supabase, {
        groupVisitId: tag.group_visit_id,
        userId,
        visitId: existingEntry.id,
      });
    }

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
                Looks like you already logged this place. Tag them to your entry?
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={handleTagToMyEntry}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8, border: "none",
                    background: "#F0997B", color: "#141413", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Tag to my entry
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
