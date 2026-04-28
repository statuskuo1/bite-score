import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { FLAGS } from "../constants/cuisineConstants.js";
import { calcBiteOutOf10, scoreColor } from "../utils/scoring.js";
import { canSwipeGroup } from "../utils/rowAccess.js";
import { EntryCard } from "./EntryCard.jsx";
import { VisitsModal } from "./VisitsModal.jsx";

export function RestRow({ e, display, onEdit, onDelete, user, visits = 1, group, weights, showAuthor = false }) {
  const { t } = useLang();
  const [showVisits, setShowVisits] = useState(false);
  const flag = FLAGS[e.cuisine] || (e.letter || e.cuisine?.[0])?.toUpperCase() || "?";
  const grp = group || [e];
  const swipeOk = canSwipeGroup(grp, user);

  const badges = [];
  if (visits > 1) {
    badges.push({ label: visits + "×", onClick: () => setShowVisits(true) });
  }
  if (e.isFusion) {
    badges.push({ label: t.fusionLabel });
  }

  const subtitle = (
    <>
      <span>{e.cuisine}</span>
      <span style={{
        fontSize: 10, padding: "1px 6px", borderRadius: 8,
        background: "rgba(91,155,213,0.12)", color: "#5B9BD5",
        border: "0.5px solid rgba(91,155,213,0.25)",
      }}>📍 {e.city || "NYC"}</span>
    </>
  );

  return (
    <div>
      <VisitsModal
        open={showVisits}
        onClose={() => setShowVisits(false)}
        name={e.name}
        visits={grp}
        user={user}
        scoreFn={(v) => calcBiteOutOf10(v.taste, v.cost, v.portions, v.wait, v.useR, v.repeatability, weights)}
        scoreColorFn={scoreColor}
        getRows={(v) => [
          [t.taste, v.taste.toFixed(1)],
          ["Cost", "$" + v.cost],
          [t.wait, v.wait + " min"],
          ["Repeat", "⭐".repeat(v.repeatability) || "✕"],
        ]}
        onEdit={(v) => { onEdit(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        onDelete={onDelete}
      />
      <EntryCard
        icon={flag}
        title={e.name}
        badges={badges}
        subtitle={subtitle}
        authorLine={showAuthor && e.authorDisplayName ? `${t.loggedBy} ${e.authorDisplayName}` : null}
        score={display}
        expandedRows={[
          [t.taste, String(e.taste)],
          ["Cost", "$" + e.cost],
          [t.portions, e.portions + "x"],
          [t.wait, e.wait + " min"],
          ["Repeat", e.useR ? ("⭐".repeat(e.repeatability) || "✕") : t.off],
        ]}
        notes={e.notes}
        mutable={swipeOk}
        onEdit={() => {
          if (visits > 1) {
            setShowVisits(true);
          } else {
            onEdit(e);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        onDelete={() => onDelete(e.id)}
      />
    </div>
  );
}
