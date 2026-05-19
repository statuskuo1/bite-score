import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { S } from "../styles/sharedStyles.js";
import { SwipeRow } from "./SwipeRow.jsx";
import { ScoreDisplay } from "./ScoreDisplay.jsx";
import { Avatar } from "./community/Avatar.jsx";
import { OthersListSheet } from "./community/OthersListSheet.jsx";

/**
 * Shared row chrome used by RestRow / CafeGroupRow.
 *
 * Wraps the SwipeRow + dark expandable card pattern. Domain rows pass:
 *   icon         small JSX/text rendered in the 36x36 brown badge
 *   title        bold name
 *   badges       optional [{ label, color, onClick }] (visits count, fusion tag, etc.)
 *   subtitle     small grey line below the title (cuisine+city or order+category)
 *   authorLine   optional green "Logged by X" line for community feeds
 *   score        { val, label, color } — right-aligned big-number display
 *   expandedRows [[label, value], ...] for the expanded panel grid
 *   notes        free-text shown under the expanded grid
 *   diners       co-diner profile array — drives the "With" cell + sheet.
 *                Excludes the entry owner (data layer filters them); the
 *                "With" preview reads as "Friend1 +N" intentionally — the
 *                row chrome is already the owner's, so they're implicit.
 *   post         optional { placeId, kind } so the diners sheet can show
 *                each co-diner's BITE for this place. Without it the sheet
 *                still lists names; the BITE column reads "—".
 *   viewerId     optional — currently unused but reserved for future
 *                viewer-aware behavior (e.g. "you" labels)
 *   viewerProfile optional { id, username, display_name, avatar_url } —
 *                the entry owner. Prepended (deduped) to the diners list
 *                when the comparison sheet opens so the full dining party
 *                is visible (party of N renders N rows).
 *   mutable      bool — controls swipe affordance
 *   onEdit       () => void — invoked by swipe "Edit"
 *   onDelete     () => void — invoked by swipe "Delete"
 */
export function EntryCard({
  icon,
  title,
  badges,
  subtitle,
  authorLine,
  score,
  expandedRows,
  notes,
  diners,
  post,
  // eslint-disable-next-line no-unused-vars
  viewerId,
  viewerProfile,
  mutable,
  onEdit,
  onMove,
  onDelete,
  rank,
}) {
  const [exp, setExp] = useState(false);
  const [showDiners, setShowDiners] = useState(false);

  /** Collapsing the card must drop the sheet too — otherwise re-expanding
   *  immediately remounts the diners sheet over the new content. */
  useEffect(() => {
    if (!exp) setShowDiners(false);
  }, [exp]);
  return (
    <SwipeRow mutable={mutable} onEdit={onEdit} onMove={onMove} onDelete={onDelete}>
      <div style={{
        background: "#1E1E1C",
        border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
      }}>
        <div
          onClick={() => setExp((x) => !x)}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px", cursor: "pointer",
          }}
        >
          {rank != null && (
            <div style={{ width: 22, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#666663", flexShrink: 0, lineHeight: 1 }}>
              #{rank}
            </div>
          )}
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: "#3C1F13",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, flexShrink: 0,
          }}>{icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                fontWeight: 500, fontSize: 14, color: "#F1EFE8",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{title}</div>
              {(badges || []).map((b, i) => (
                <span
                  key={i}
                  onClick={b.onClick ? (e) => { e.stopPropagation(); b.onClick(); } : undefined}
                  style={{
                    fontSize: 11, fontWeight: 500, padding: "2px 6px", borderRadius: 10,
                    background: b.background || "#2A1E05",
                    color: b.color || "#EF9F27",
                    border: "0.5px solid " + (b.color || "#EF9F27"),
                    flexShrink: 0,
                    cursor: b.onClick ? "pointer" : "default",
                  }}
                >{b.label}</span>
              ))}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap",
              fontSize: 12, color: "#888780",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{subtitle}</div>
            {authorLine && (
              <div style={{ fontSize: 11, color: "#97C459", marginTop: 2 }}>{authorLine}</div>
            )}
          </div>
          <ScoreDisplay value={score.val} label={score.label} color={score.color} size="md" />
          <div style={{ fontSize: 10, color: "#888780", marginLeft: 2 }}>{exp ? "▲" : "▼"}</div>
        </div>
        {exp && (
          <div style={{
            padding: "0 14px 12px 70px",
            borderTop: "0.5px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3,1fr)",
              gap: 8, marginTop: 10,
            }}>
              {expandedRows.map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: "#888780" }}>{k}</div>
                  <div style={S.val}>{v}</div>
                </div>
              ))}
              <div
                onClick={diners?.length > 0 ? (e) => { e.stopPropagation(); setShowDiners(true); } : undefined}
                style={{ cursor: diners?.length > 0 ? "pointer" : "default" }}
              >
                <div style={{ fontSize: 11, color: "#888780" }}>With</div>
                {diners?.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                    <Avatar profile={diners[0]} size={16} />
                    {diners.length === 1 && (
                      <span style={{ fontSize: 12, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {diners[0].display_name || diners[0].username}
                      </span>
                    )}
                    {diners.length === 2 && <Avatar profile={diners[1]} size={16} />}
                    {diners.length > 2 && (
                      <span style={{ fontSize: 12, color: "#888780" }}>+{diners.length - 1}</span>
                    )}
                  </div>
                ) : (
                  <div style={S.val}>—</div>
                )}
              </div>
            </div>
            {notes && (
              <div style={{ marginTop: 10, fontSize: 11, color: "#888780" }}>
                <span style={{ fontWeight: 500 }}>Note: </span>{notes}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Portal the diners sheet to <body> so SwipeRow's transform/overflow
          doesn't trap a position:fixed overlay inside this row's box.
          Prepend the entry owner so the sheet shows the full dining party
          (a party of N renders N rows). Dedupe defensively in case the
          data layer ever stops filtering the owner from `diners`. */}
      {showDiners && diners?.length > 0 && typeof document !== "undefined" && createPortal(
        <OthersListSheet
          post={post || { placeId: null, kind: "rest" }}
          profiles={viewerProfile?.id
            ? [viewerProfile, ...diners.filter((d) => d.id !== viewerProfile.id)]
            : diners}
          title="Dining Party"
          onClose={() => setShowDiners(false)}
        />,
        document.body,
      )}
    </SwipeRow>
  );
}
