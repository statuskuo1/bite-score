import { createPortal } from "react-dom";

/**
 * Retrospective attach prompt — fires at Save time when the user logs a
 * visit at a place where they were tagged into an expired group_visit
 * within ±30 days. The day-7 sweep already marked the parent 'expired' and
 * all pending members 'skipped', so this is a "backfill your visit onto
 * the old group" UX rather than a live coordination one. Yes attaches the
 * new visit_id onto the user's member row; No dismisses and the group
 * stays expired.
 *
 * Shaped like SameDinnerSheet.jsx to keep the two prompts visually
 * consistent — same dinner confirmation vs retro attach only differ in
 * copy and expiry semantics.
 */
export function RetroAttachSheet({ creatorUsername, creatorDisplayName, restaurantName, visitedAt, onYes, onNo }) {
  const dateLabel = visitedAt
    ? new Date(visitedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  const who = creatorUsername
    ? `@${creatorUsername}`
    : (creatorDisplayName || "someone");
  return createPortal(
    <div
      onClick={onNo}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 320, background: "#1E1E1C", borderRadius: 16, padding: "24px 20px 20px", boxSizing: "border-box", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8", marginBottom: 6 }}>
          One from the archive?
        </div>
        <div style={{ fontSize: 13, color: "#888780", marginBottom: 24, lineHeight: 1.5 }}>
          Was this with <span style={{ color: "#F1EFE8" }}>{who}</span>
          {restaurantName ? <> at <span style={{ color: "#F1EFE8" }}>{restaurantName}</span></> : ""}
          {dateLabel ? <> on <span style={{ color: "#F1EFE8" }}>{dateLabel}</span></> : ""}
          ?
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onNo}
            style={{ flex: 1, padding: "11px", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#888780", fontSize: 14, cursor: "pointer" }}
          >
            No
          </button>
          <button
            type="button"
            onClick={onYes}
            style={{ flex: 1, padding: "11px", borderRadius: 8, background: "#F0997B", border: "none", color: "#141413", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Yes, tag it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
