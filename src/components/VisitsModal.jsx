import { useLang } from "../contexts/LangContext.jsx";
import { canMutateVisit } from "../utils/rowAccess.js";
import { S } from "../styles/sharedStyles.js";

/**
 * Per-entry visit-history modal shared by RestRow / CafeGroupRow.
 *
 * Props:
 *   open: bool
 *   onClose: () => void
 *   name: string                          shown as modal title
 *   visits: Visit[]                       rendered newest first
 *   user: { id } | null                   for canMutateVisit() check
 *   scoreFn: (visit) => number|null       domain scorer (BITE vs cafe BITE)
 *   scoreColorFn: (score) => string       tier color for the per-visit score
 *   getRows: (visit) => [[label,value]]   2-3 row metric grid per visit
 *   suffix: (visit) => string             optional " · Foo" appended to "Visit N" header
 *   onEdit: (visit) => void               called after the modal closes
 *   onDelete: (id) => void
 */
export function VisitsModal({
  open,
  onClose,
  name,
  visits,
  user,
  scoreFn,
  scoreColorFn,
  getRows,
  suffix,
  onEdit,
  onDelete,
}) {
  const { t, lang } = useLang();
  if (!open) return null;
  const total = visits.length;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        zIndex: 200, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "1.25rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1E1E1C", borderRadius: 16, width: "100%",
          maxWidth: 560, maxHeight: "60vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1rem 1.25rem", borderBottom: "0.5px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#F1EFE8" }}>{name}</div>
            <div style={{ fontSize: 12, color: "#888780" }}>{total} {t.visitCount}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: 22, color: "#888780", background: "none",
              border: "none", cursor: "pointer", lineHeight: 1,
            }}
          >×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "1rem 1.25rem", flex: 1 }}>
          {[...visits].reverse().map((v, i) => {
            const sc = scoreFn(v);
            const visitNum = total - i;
            const heading = lang === "zh"
              ? `${t.visitLabel}${visitNum}${t.visitsLabel}`
              : `Visit ${visitNum}`;
            const suffixStr = suffix ? suffix(v) : "";
            return (
              <div
                key={v.id}
                style={{
                  background: "#141413", borderRadius: 10,
                  padding: "12px 14px", marginBottom: 10,
                }}
              >
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#F1EFE8" }}>
                    {heading}{suffixStr}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: scoreColorFn(sc) }}>
                      {sc != null ? sc.toFixed(2) : "—"}
                    </div>
                    {canMutateVisit(v, user) && (
                      <button
                        onClick={() => { onClose(); onEdit(v); }}
                        style={{
                          fontSize: 11, color: "#5B9BD5", background: "none",
                          border: "0.5px solid #5B9BD5", borderRadius: 4,
                          padding: "3px 10px", cursor: "pointer",
                        }}
                      >{t.edit}</button>
                    )}
                    {canMutateVisit(v, user) && (
                      <button
                        onClick={() => onDelete(v.id)}
                        style={{
                          fontSize: 11, color: "#A32D2D", background: "none",
                          border: "0.5px solid #A32D2D", borderRadius: 4,
                          padding: "3px 10px", cursor: "pointer",
                        }}
                      >{t.deleteLabel}</button>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {getRows(v).map(([k, val]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, color: "#888780" }}>{k}</div>
                      <div style={S.val}>{val}</div>
                    </div>
                  ))}
                </div>
                {v.notes && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#888780", fontStyle: "italic" }}>
                    {v.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
