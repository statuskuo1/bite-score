import { useState } from "react";
import { S } from "../styles/sharedStyles.js";
import { SwipeRow } from "./SwipeRow.jsx";
import { ScoreDisplay } from "./ScoreDisplay.jsx";

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
  mutable,
  onEdit,
  onDelete,
}) {
  const [exp, setExp] = useState(false);
  return (
    <SwipeRow mutable={mutable} onEdit={onEdit} onDelete={onDelete}>
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
            </div>
            {notes && (
              <div style={{ marginTop: 10, fontSize: 11, color: "#888780" }}>
                <span style={{ fontWeight: 500 }}>Note: </span>{notes}
              </div>
            )}
          </div>
        )}
      </div>
    </SwipeRow>
  );
}
