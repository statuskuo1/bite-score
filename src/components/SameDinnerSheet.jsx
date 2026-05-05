import { createPortal } from "react-dom";

/**
 * "Is this the same dinner as @{creator}'s visit on {date}?" prompt that
 * fires at restaurant Save time when a candidate group_visit exists at this
 * place + member overlap + within ±7 days. Yes joins the existing group;
 * No falls through to creating a new one.
 *
 * Shaped like ConfirmSheet.jsx but with a non-destructive primary button
 * (group joining isn't a delete, so the red "Delete" tone would be wrong).
 */
export function SameDinnerSheet({ creatorUsername, restaurantName, visitedAt, onYes, onNo }) {
  const dateLabel = visitedAt
    ? new Date(visitedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
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
          Same visit?
        </div>
        <div style={{ fontSize: 13, color: "#888780", marginBottom: 24, lineHeight: 1.5 }}>
          Is this the same visit as
          {creatorUsername ? <> <span style={{ color: "#F1EFE8" }}>@{creatorUsername}</span></> : " someone"}
          's visit
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
            No, different
          </button>
          <button
            type="button"
            onClick={onYes}
            style={{ flex: 1, padding: "11px", borderRadius: 8, background: "#F0997B", border: "none", color: "#141413", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Yes, same
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
