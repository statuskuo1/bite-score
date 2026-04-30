import { createPortal } from "react-dom";

export function ConfirmSheet({ title, body, confirmLabel = "Delete", onConfirm, onCancel }) {
  return createPortal(
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 320, background: "#1E1E1C", borderRadius: 16, padding: "24px 20px 20px", boxSizing: "border-box", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8", marginBottom: 6 }}>
          {title ?? "Delete entry?"}
        </div>
        <div style={{ fontSize: 13, color: "#888780", marginBottom: 24 }}>
          {body ?? "This can't be undone."}
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
            onClick={onConfirm}
            style={{ flex: 1, padding: "11px", borderRadius: 8, background: "#E85A5A", border: "none", color: "#FFF", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
