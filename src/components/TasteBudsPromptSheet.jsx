import { MouthLogo } from "./MouthLogo.jsx";

const OVERLAY = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.82)",
  zIndex: 450,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "1.5rem",
};

const CARD = {
  background: "#1E1E1C",
  borderRadius: 20,
  padding: "36px 28px 28px",
  maxWidth: 360,
  width: "100%",
  border: "0.5px solid rgba(255,255,255,0.12)",
  boxSizing: "border-box",
};

export function TasteBudsPromptSheet({ onFindFriends, onDismiss }) {
  return (
    <div style={OVERLAY} onClick={onDismiss}>
      <div style={CARD} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <MouthLogo />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 500, color: "#F1EFE8", margin: "0 0 8px", textAlign: "center", lineHeight: 1.3 }}>
          Find your Taste Buds! 🎉
        </h2>
        <p style={{ fontSize: 13, fontWeight: 400, color: "#888780", margin: "0 0 24px", lineHeight: 1.8, textAlign: "center" }}>
          Follow friends to compare scores<br />and see their BITEs.
        </p>
        <button
          type="button"
          onClick={onFindFriends}
          style={{
            width: "100%", padding: "12px",
            background: "#F0997B", color: "#141413",
            border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Follow someone →
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            display: "block", width: "100%", textAlign: "center",
            fontSize: 12, color: "#555553",
            background: "none", border: "none",
            cursor: "pointer", padding: "10px 0 0",
            textDecoration: "none",
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
