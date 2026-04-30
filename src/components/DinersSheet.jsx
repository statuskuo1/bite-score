import { Avatar } from "./community/Avatar.jsx";

export function DinersSheet({ diners, onClose }) {
  if (!diners?.length) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        zIndex: 300, display: "flex", alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", background: "#1E1E1C",
          borderRadius: "16px 16px 0 0",
          padding: "1rem 1.25rem 2rem",
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#F1EFE8" }}>Dined with</div>
          <button
            onClick={onClose}
            style={{
              fontSize: 22, color: "#888780", background: "none",
              border: "none", cursor: "pointer", lineHeight: 1, padding: 0,
            }}
          >×</button>
        </div>
        {diners.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12 }}>
            <Avatar profile={p} size={32} />
            <div>
              <div style={{ fontSize: 14, color: "#F1EFE8" }}>{p.display_name || p.username}</div>
              {p.username && (
                <div style={{ fontSize: 12, color: "#888780" }}>@{p.username}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
