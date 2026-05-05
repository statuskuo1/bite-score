import { useEffect, useState } from "react";
import { Avatar } from "./community/Avatar.jsx";
import {
  dismissDineTag,
  joinExistingGroupVisit,
  resolveGroupVisitTaggedNotif,
} from "../utils/groupVisitsApi.js";
import { supabase } from "../config/supabaseClient.js";

/**
 * Banner shown on /add when the signed-in user has a pending
 * group_visit_members row (someone tagged them in a group visit they
 * haven't logged yet). Sourced via fetch_pending_tags_for_user RPC.
 *
 * Shows one card at a time. Badge in the top-right shows total pending count.
 * Both actions advance to the next card automatically.
 * Tapping the count badge opens a scrollable modal of all pending tags.
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
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!tags?.length) setShowAll(false);
  }, [tags?.length]);

  if (!tags?.length) return null;

  const tag = tags[0];
  const who = tag.taggerProfile;
  const name = who?.display_name || who?.username || "Someone";
  const handle = who?.username ? `@${who.username}` : "";
  const count = tags.length;

  // Kind-aware lookup: only search the same-kind list as the tag. The
  // group_visit_members row carries `restaurant_visit_id` XOR
  // `cafe_visit_id` based on the parent gv.kind, so handing
  // joinExistingGroupVisit a cross-kind id (e.g. cafe_visits.id when the
  // gv is a restaurant) trips an FK violation that fails silently and
  // leaves the row pending — which then "snaps back" into the banner via
  // the next refreshDineTags. Restricting the search keeps the
  // "Tag to entry" button only available when there's a usable entry,
  // and falls through to "Log visit" otherwise.
  function findExisting(t) {
    const list = t.entry_type === "cafe" ? cafes : entries;
    const tName = (t.restaurant_name || "").trim().toLowerCase();
    const tCity = (t.city || "").trim().toLowerCase();
    if (!tName) return null;
    return (list || []).find((e) => {
      const eName = (e.name || "").trim().toLowerCase();
      const eCity = (e.city || "").trim().toLowerCase();
      return eName === tName && (!tCity || !eCity || eCity === tCity);
    });
  }

  const existingEntry = findExisting(tag);

  async function handleDismiss() {
    onDismiss(tag.id); // optimistic remove — instant UI
    await Promise.all([
      dismissDineTag(supabase, tag.id),
      tag.group_visit_id && resolveGroupVisitTaggedNotif(supabase, {
        userId,
        groupVisitId: tag.group_visit_id,
      }),
    ].filter(Boolean));
  }

  function handleLogMyVisit() {
    onDismiss(tag.id);
    // Don't pre-skip the member row here — the user is going to /add to
    // log their visit. The save flow auto-attaches via
    // auto_attach_visit_to_group_visits which will flip the same row to
    // 'logged' and clean up the bell notif inline. Pre-skipping would
    // leave the user looking 'skipped' even though they did log.
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
  async function handleTagToMyEntry() {
    if (!existingEntry) return;
    const dateStr = (() => {
      const d = new Date(existingEntry.visited_at || existingEntry.created_at);
      return isNaN(d) ? "" : " · " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    })();
    const msg = `@${who?.username || name} tagged to your ${tag.restaurant_name}${dateStr}`;
    setTaggedConfirm(msg);

    if (tag.group_visit_id && userId) {
      await Promise.all([
        joinExistingGroupVisit(supabase, {
          groupVisitId: tag.group_visit_id,
          userId,
          visitId: existingEntry.id,
        }),
        // Resolve the matching bell notif at the same time so the badge
        // decrements and the row vanishes on next panel open. RLS DELETE
        // policy from 20260528 allows recipient self-clear.
        resolveGroupVisitTaggedNotif(supabase, {
          userId,
          groupVisitId: tag.group_visit_id,
        }),
      ]);
    }

    setTimeout(() => { setTaggedConfirm(null); onDismiss(tag.id); }, 4000);
  }

  return (
    <>
      <div style={{ position: "relative", marginBottom: 16 }}>
        {/* Badge — tappable to open full queue modal */}
        {count > 1 && (
          <button
            onClick={() => setShowAll(true)}
            style={{
              position: "absolute", top: -6, right: -6, zIndex: 1,
              minWidth: 18, height: 18, padding: "0 4px",
              borderRadius: 9, background: "#E85A5A",
              color: "#FFF", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, boxSizing: "border-box",
              border: "1.5px solid #141413",
              cursor: "pointer",
            }}
          >
            {count > 99 ? "99+" : count}
          </button>
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

      {showAll && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
          }}
          onClick={() => setShowAll(false)}
        >
          <div
            style={{
              background: "#1E1E1C", borderRadius: 14,
              width: "min(420px, calc(100vw - 32px))",
              maxHeight: "70vh", display: "flex", flexDirection: "column",
              overflow: "hidden",
              border: "0.5px solid rgba(240,153,123,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", flexShrink: 0,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#F1EFE8" }}>
                Tagged in ({count})
              </span>
              <button
                onClick={() => setShowAll(false)}
                style={{ background: "none", border: "none", color: "#888780", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}
              >×</button>
            </div>

            <div style={{ overflowY: "auto", padding: "0 16px", flex: 1 }}>
              {tags.map((t) => {
                const tWho = t.taggerProfile;
                const tName = tWho?.display_name || tWho?.username || "Someone";
                const existing = findExisting(t);
                return (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                  }}>
                    <Avatar profile={tWho} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#F1EFE8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tName}{tWho?.username ? ` @${tWho.username}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#F0997B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.restaurant_name}{t.city ? ` · ${t.city}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {existing ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (t.group_visit_id && userId) {
                              await Promise.all([
                                joinExistingGroupVisit(supabase, {
                                  groupVisitId: t.group_visit_id,
                                  userId,
                                  visitId: existing.id,
                                }),
                                // Clear the matching bell notif at the same time
                                // so the badge decrements and the row vanishes on
                                // next panel open (single-card handleTagToMyEntry
                                // already does this; the modal was missed).
                                resolveGroupVisitTaggedNotif(supabase, {
                                  userId,
                                  groupVisitId: t.group_visit_id,
                                }),
                              ]);
                            }
                            onDismiss(t.id);
                            if (tags.length <= 1) setShowAll(false);
                          }}
                          style={{
                            padding: "5px 10px", borderRadius: 7, border: "none",
                            background: "#F0997B", color: "#141413", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Tag to entry
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            // Don't pre-skip — the user is heading to /add to log
                            // their visit. Auto-attach (server-side) will flip the
                            // member row to 'logged' and clean up the bell notif
                            // once the save fires. Pre-skipping would set
                            // status='skipped', which auto_attach filters out
                            // (m.status = 'pending'), leaving the user incorrectly
                            // marked as skipped after a successful log.
                            setShowAll(false);
                            onDismiss(t.id);
                            onAddType(t.entry_type, t);
                          }}
                          style={{
                            padding: "5px 10px", borderRadius: 7, border: "none",
                            background: "#F0997B", color: "#141413", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Log visit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          onDismiss(t.id); // optimistic remove — instant UI
                          if (tags.length <= 1) setShowAll(false);
                          await Promise.all([
                            dismissDineTag(supabase, t.id),
                            t.group_visit_id && resolveGroupVisitTaggedNotif(supabase, {
                              userId,
                              groupVisitId: t.group_visit_id,
                            }),
                          ].filter(Boolean));
                        }}
                        style={{
                          padding: "5px 10px", borderRadius: 7,
                          background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)",
                          color: "#888780", fontSize: 12, cursor: "pointer",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
