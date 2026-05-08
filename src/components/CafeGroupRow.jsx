import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { getCafeIcon } from "../constants/cafeCatalog.js";
import { calcCafeOutOf10, tasteLabel, tasteColor, cafeScoreColor, cafeScoreLabel } from "../utils/scoring.js";
import { canSwipeGroup } from "../utils/rowAccess.js";
import { EntryCard } from "./EntryCard.jsx";
import { VisitsModal } from "./VisitsModal.jsx";

export function CafeGroupRow({ group, cafeSortBy, onEdit, onDelete, user, weights, showAuthor = false, dinedWithForEntry, viewerProfile, rank }) {
  const { t } = useLang();
  const [showVisits, setShowVisits] = useState(false);
  const icon = getCafeIcon(group[0].category, group[0].order);
  const visits = group.length;

  const scores = group
    .map((e) => calcCafeOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, weights))
    .filter((s) => s != null);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const avgTaste = group.reduce((a, e) => a + e.taste, 0) / visits;
  const avgCost = group.reduce((a, e) => a + e.cost, 0) / visits;
  const avgBpb = group.reduce((a, e) => a + (e.cost / (e.portions || 1)), 0) / visits;
  const avgWait = group.reduce((a, e) => a + e.wait, 0) / visits;
  const avgRepeat = Math.round(group.reduce((a, e) => a + e.repeatability, 0) / visits);
  const avgPortions = group.reduce((a, e) => a + (+e.portions || 1), 0) / visits;

  const getDiners = dinedWithForEntry || (() => []);
  const unionDiners = (() => {
    const seen = new Set(); const result = [];
    for (const v of group) for (const p of getDiners(v.id)) if (!seen.has(p.id)) { seen.add(p.id); result.push(p); }
    return result;
  })();

  function getDisplay() {
    if (cafeSortBy === "taste") {
      const tv = avgTaste;
      return { val: tv.toFixed(1), label: tasteLabel(tv, t), color: tasteColor(tv) };
    }
    if (cafeSortBy === "bpb") return { val: "$" + avgBpb.toFixed(2), label: "avg/item", color: "#5B9BD5" };
    if (cafeSortBy === "wait") return { val: avgWait.toFixed(0) + " min", label: "avg wait", color: "#888780" };
    if (cafeSortBy === "repeat") return { val: "⭐".repeat(avgRepeat) || "✕", label: "avg repeat", color: "#EF9F27" };
    return {
      val: avgScore != null ? avgScore.toFixed(2) : "—",
      label: cafeScoreLabel(avgScore, t),
      color: cafeScoreColor(avgScore),
    };
  }
  const display = getDisplay();
  const swipeOk = canSwipeGroup(group, user);

  const badges = visits > 1 ? [{ label: visits + "×", onClick: () => setShowVisits(true) }] : [];

  return (
    <>
      <VisitsModal
        open={showVisits}
        onClose={() => setShowVisits(false)}
        name={group[0].name}
        visits={group}
        user={user}
        icon={icon}
        kind="cafe"
        scoreFn={(v) => calcCafeOutOf10(v.taste, v.cost, v.portions, v.wait, v.useR, v.repeatability, weights)}
        scoreColorFn={cafeScoreColor}
        getRows={(v) => [
          [t.taste, v.taste.toFixed(1)],
          ["Cost", "$" + v.cost],
          [t.portions, (+v.portions || 1).toFixed(1) + "x"],
          [t.wait, v.wait + " min"],
          ["Repeat", "⭐".repeat(v.repeatability) || "✕"],
        ]}
        suffix={(v) => (v.order ? " · " + v.order : "")}
        getDiners={getDiners}
        viewerProfile={viewerProfile}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <EntryCard
        rank={rank}
        icon={icon}
        title={group[0].name}
        badges={badges}
        subtitle={group[0].category}
        authorLine={(() => {
          const who = group[0].authorUsername || group[0].authorDisplayName;
          return showAuthor && who ? `${t.loggedBy} ${who}` : null;
        })()}
        score={display}
        expandedRows={[
          [t.taste, avgTaste.toFixed(1)],
          ["Cost", "$" + avgCost.toFixed(2)],
          [t.portions, avgPortions.toFixed(1) + "x"],
          [t.wait, avgWait.toFixed(0) + " min"],
          ["Repeat", "⭐".repeat(avgRepeat) || "✕"],
        ]}
        notes={group[group.length - 1].notes}
        diners={unionDiners}
        post={{ placeId: group[0]?.placeId || null, kind: "cafe" }}
        viewerId={user?.id}
        viewerProfile={viewerProfile}
        mutable={swipeOk}
        onEdit={() => onEdit(group[group.length - 1])}
        onDelete={() => onDelete(group[group.length - 1].id)}
      />
    </>
  );
}
