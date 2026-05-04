import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * "You've been to {restaurant} a few times recently — which visit was with
 * @{creator}?" picker that fires when a `group_visit_tagged` notification
 * arrives with `meta.variant === 'pick_visit'`. Pick a date → caller links
 * that restaurant_visit to the group as the user's logged entry.
 */
export function PickVisitSheet({ creatorUsername, restaurantName, visits, onPick, onCancel }) {
  const [picked, setPicked] = useState(visits?.[0]?.id || null);
  return createPortal(
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 360, background: "#1E1E1C", borderRadius: 16, padding: "24px 20px 20px", boxSizing: "border-box", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8", marginBottom: 6 }}>
          Which visit was it?
        </div>
        <div style={{ fontSize: 13, color: "#888780", marginBottom: 16, lineHeight: 1.5 }}>
          You've been to
          {restaurantName ? <> <span style={{ color: "#F1EFE8" }}>{restaurantName}</span></> : " this place"}
          {" "}a few times recently — which visit was with
          {creatorUsername ? <> <span style={{ color: "#F1EFE8" }}>@{creatorUsername}</span></> : " them"}?
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {(visits || []).map((v) => {
            const label = v.visited_at
              ? new Date(v.visited_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
              : "Unknown date";
            const isPicked = picked === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setPicked(v.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: 10,
                  background: isPicked ? "#3C1F13" : "transparent",
                  border: `0.5px solid ${isPicked ? "#F0997B" : "rgba(255,255,255,0.1)"}`,
                  color: isPicked ? "#F1EFE8" : "#C4C2BA",
                  fontSize: 14, cursor: "pointer", textAlign: "left",
                }}
              >
                <span>{label}</span>
                <span style={{
                  width: 16, height: 16, borderRadius: "50%",
                  border: `1.5px solid ${isPicked ? "#F0997B" : "#666663"}`,
                  background: isPicked ? "#F0997B" : "transparent",
                  flexShrink: 0,
                }} />
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ flex: 1, padding: "11px", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#888780", fontSize: 14, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => picked && onPick(picked)}
            disabled={!picked}
            style={{ flex: 1, padding: "11px", borderRadius: 8, background: picked ? "#F0997B" : "rgba(240,153,123,0.4)", border: "none", color: "#141413", fontSize: 14, fontWeight: 600, cursor: picked ? "pointer" : "not-allowed" }}
          >
            Connect
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
