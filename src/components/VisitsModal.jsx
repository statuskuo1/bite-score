import { useLang } from "../contexts/LangContext.jsx";
import { canMutateVisit } from "../utils/rowAccess.js";
import { EntryCard } from "./EntryCard.jsx";

export function VisitsModal({
  open,
  onClose,
  name,
  visits,
  user,
  icon,
  scoreFn,
  scoreColorFn,
  getRows,
  getDiners,
  viewerProfile,
  suffix,
  kind = "rest",
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
            const title = lang === "zh"
              ? `${t.visitLabel}${visitNum}${t.visitsLabel}`
              : `Visit ${visitNum}`;
            const suffixStr = suffix ? suffix(v) : "";
            return (
              <div key={v.id} style={{ marginBottom: 10 }}>
                <EntryCard
                  icon={icon}
                  title={title}
                  subtitle={suffixStr || null}
                  score={{ val: sc != null ? sc.toFixed(2) : "—", label: null, color: scoreColorFn(sc) }}
                  expandedRows={getRows(v)}
                  notes={v.notes}
                  diners={getDiners ? getDiners(v.id) : []}
                  post={{ placeId: v.placeId || null, kind }}
                  viewerId={user?.id}
                  viewerProfile={viewerProfile}
                  mutable={canMutateVisit(v, user)}
                  onEdit={() => { onClose(); onEdit(v); }}
                  onDelete={() => { onDelete(v.id); if (total === 1) onClose(); }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
