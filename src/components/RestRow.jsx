import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { FLAGS } from "../constants/cuisineConstants.js";
import { calcBiteOutOf10, scoreColor } from "../utils/scoring.js";
import { canSwipeGroup } from "../utils/rowAccess.js";
import { EntryCard } from "./EntryCard.jsx";
import { VisitsModal } from "./VisitsModal.jsx";
import { formatCost } from "../utils/currency.js";

export function RestRow({ e, display, onEdit, onDelete, user, visits = 1, group, weights, showAuthor = false, homeCurrency = "USD", dinedWithForEntry }) {
  const { t } = useLang();
  const [showVisits, setShowVisits] = useState(false);
  const flag = FLAGS[e.cuisine] || (e.letter || e.cuisine?.[0])?.toUpperCase() || "?";
  const grp = group || [e];
  const swipeOk = canSwipeGroup(grp, user);

  const getDiners = dinedWithForEntry || (() => []);
  const unionDiners = (() => {
    const seen = new Set(); const result = [];
    for (const v of grp) for (const p of getDiners(v.id)) if (!seen.has(p.id)) { seen.add(p.id); result.push(p); }
    return result;
  })();

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
        fontSize: 11, padding: "1px 6px", borderRadius: 8,
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
        icon={flag}
        scoreFn={(v) => calcBiteOutOf10(v.taste, v.cost, v.portions, v.wait, v.useR, v.repeatability, weights, v.currency_code || "USD")}
        scoreColorFn={scoreColor}
        getRows={(v) => [
          [t.taste, v.taste.toFixed(1)],
          ["Cost", formatCost(v.cost, v.currency_code, homeCurrency)],
          [t.portions, v.portions + "x"],
          [t.wait, v.wait + " min"],
          ["Repeat", v.useR ? ("⭐".repeat(v.repeatability) || "✕") : t.off],
        ]}
        getDiners={getDiners}
        onEdit={(v) => { onEdit(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        onDelete={onDelete}
      />
      <EntryCard
        icon={flag}
        title={e.name}
        badges={badges}
        subtitle={subtitle}
        authorLine={(() => {
          const who = e.authorUsername || e.authorDisplayName;
          return showAuthor && who ? `${t.loggedBy} ${who}` : null;
        })()}
        score={display}
        expandedRows={[
          [t.taste, String(e.taste)],
          ["Cost", formatCost(e.cost, e.currency_code, homeCurrency)],
          [t.portions, e.portions + "x"],
          [t.wait, e.wait + " min"],
          ["Repeat", e.useR ? ("⭐".repeat(e.repeatability) || "✕") : t.off],
        ]}
        notes={e.notes}
        diners={visits === 1 ? unionDiners : []}
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
