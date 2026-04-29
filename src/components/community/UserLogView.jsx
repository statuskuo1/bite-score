import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import {
  calcBiteOutOf10,
  scoreColor,
  scoreLabel,
  tasteColor,
  tasteLabel,
} from "../../utils/scoring.js";
import { rating010FilterRows } from "../../constants/ratingTiers0to10.js";
import { S } from "../../styles/sharedStyles.js";
import { RestRow } from "../RestRow.jsx";
import { Avatar } from "./Avatar.jsx";
import { usePaginatedList } from "../usePaginatedList.js";
import { ShowMoreButton } from "../ShowMoreButton.jsx";
import { SortFilterToolbar } from "../SortFilterToolbar.jsx";

/**
 * Read-only restaurant log for another user. Reached from the View Log button
 * on the MiniProfileSheet.
 *
 * The list is grouped + sorted exactly like My Log (same BITE-descending
 * ordering, same per-name grouping) so viewers see the other person's library
 * through their own weights — i.e. "what would these places score for me?".
 *
 * Edit/delete is naturally disabled: `RestRow` consults `canSwipeGroup(grp,
 * user)` which only returns true when every visit in the group is owned by
 * the viewer. We still pass no-op handlers as belt-and-braces in case those
 * code paths ever fire.
 */
export function UserLogView({ user, targetProfile, restaurantWeights, onBack }) {
  const { t } = useLang();
  const [visits, setVisits] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [viewBy, setViewBy] = useState("bite");
  const [sortAsc, setSortAsc] = useState(false);
  const [cityFilter, setCityFilter] = useState(new Set());
  const [search, setSearch] = useState("");
  const [tiers, setTiers] = useState(new Set());

  useEffect(() => {
    if (!targetProfile?.id) { setVisits([]); setLoaded(true); return; }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, targetProfile.id);
      if (cancelled) return;
      setVisits(v);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [targetProfile?.id]);

  const weights = restaurantWeights;

  const tierFilterRows = rating010FilterRows(t);

  /** All groups with computed aggregate values — basis for city counts and
   *  tier filter counts before any active filtering is applied. */
  const baseGroups = useMemo(() => {
    const byName = {};
    for (const e of visits) {
      const k = e.name;
      if (!byName[k]) byName[k] = [];
      byName[k].push(e);
    }
    return Object.values(byName).map((grp) => {
      const head = grp[grp.length - 1];
      const biteVals = grp
        .map((e) => calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, weights))
        .filter((v) => v != null);
      const avgBite = biteVals.length ? biteVals.reduce((a, b) => a + b, 0) / biteVals.length : 0;
      const avgTaste = grp.reduce((s, e) => s + (e.taste ?? 0), 0) / grp.length;
      const avgBpb = grp.reduce((s, e) => s + ((e.cost ?? 0) / (e.portions || 1)), 0) / grp.length;
      const avgWait = grp.reduce((s, e) => s + (e.wait ?? 0), 0) / grp.length;
      const avgRepeat = grp.reduce((s, e) => s + (e.repeatability ?? 0), 0) / grp.length;
      return { grp, head, avgBite, avgTaste, avgBpb, avgWait, avgRepeat };
    });
  }, [visits, weights]);

  const cityCounts = useMemo(() => {
    const m = new Map();
    baseGroups.forEach(({ head }) => {
      const c = head.city || "";
      if (c) m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [baseGroups]);

  function sortVal(g) {
    if (viewBy === "taste") return g.avgTaste;
    if (viewBy === "bpb") return -g.avgBpb;
    if (viewBy === "wait") return -g.avgWait;
    if (viewBy === "repeat") return g.avgRepeat;
    return g.avgBite;
  }

  const groups = useMemo(() => {
    return baseGroups
      .filter((g) => cityFilter.size === 0 || cityFilter.has(g.head.city || ""))
      .filter((g) => tiers.size === 0 || tiers.has(scoreLabel(g.avgBite, t)))
      .filter((g) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          g.head.name.toLowerCase().includes(q) ||
          (g.head.cuisine || "").toLowerCase().includes(q) ||
          (g.head.city || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const va = sortVal(a);
        const vb = sortVal(b);
        return sortAsc ? va - vb : vb - va;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseGroups, cityFilter, tiers, search, viewBy, sortAsc, t]);

  function getDisplay(head) {
    if (viewBy === "taste") {
      return { val: head.taste.toFixed(1), label: tasteLabel(head.taste, t), color: tasteColor(head.taste) };
    }
    if (viewBy === "bpb") {
      return { val: "$" + (head.cost / head.portions).toFixed(2), label: t.perPortion, color: "#5B9BD5" };
    }
    if (viewBy === "wait") {
      return { val: head.wait + " min", label: t.waitLabel, color: "#888780" };
    }
    if (viewBy === "repeat") {
      return {
        val: head.useR ? ("⭐".repeat(head.repeatability) || "✕") : t.off,
        label: head.useR
          ? (head.repeatability === 3 ? t.mustReturnLabel : head.repeatability === 2 ? t.wouldSeekOutLabel : head.repeatability === 1 ? t.ifOccasionCallsLabel : t.wouldntReturnLabel)
          : "off",
        color: "#EF9F27",
      };
    }
    const sc = calcBiteOutOf10(head.taste, head.cost, head.portions, head.wait, head.useR, head.repeatability, weights);
    return { val: sc != null ? sc.toFixed(2) : "—", label: scoreLabel(sc, t), color: scoreColor(sc) };
  }

  const groupsPage = usePaginatedList(
    groups,
    `${targetProfile?.id}|${viewBy}|${sortAsc}|${[...cityFilter].sort().join(",")}|${[...tiers].join(",")}|${search}`,
  );

  const name = targetProfile?.display_name || targetProfile?.username || "—";

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "none",
          color: "#888780", fontSize: 12, cursor: "pointer",
          padding: 0, marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>‹</span>
        {t.backToFriends || "Back to Friends"}
      </button>

      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 14,
      }}>
        <Avatar profile={targetProfile} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 600, color: "#F1EFE8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {name}
          </div>
          <div style={{
            fontSize: 11, color: "#888780", marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            @{targetProfile?.username || "—"} · {t.readOnlyLog || "Read-only log"}
          </div>
        </div>
      </div>

      <div style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 12 }} />

      {loaded && (
        <SortFilterToolbar
          viewBy={viewBy}
          onViewBy={setViewBy}
          viewOptions={[["bite", "BITE"], ["taste", t.taste], ["bpb", t.bangBuck], ["wait", t.wait], ["repeat", t.repeatability]]}
          cityCounts={cityCounts}
          selectedCities={cityFilter}
          onCitiesChange={setCityFilter}
          search={search}
          onSearch={setSearch}
          filterContent={
            <>
              <div style={{ padding: "6px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={S.sm}>{t.filterByTier}</span>
                {tiers.size > 0 && (
                  <button type="button" onClick={() => setTiers(new Set())} style={{ fontSize: 11, color: "#F0997B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {t.clear}
                  </button>
                )}
              </div>
              {tierFilterRows.map(([tier, col]) => {
                const on = tiers.has(tier);
                const cnt = baseGroups.filter((g) => scoreLabel(g.avgBite, t) === tier).length;
                return (
                  <div
                    key={tier}
                    onClick={() => setTiers((prev) => { const n = new Set(prev); on ? n.delete(tier) : n.add(tier); return n; })}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.1)", cursor: "pointer", background: on ? "rgba(255,255,255,0.03)" : "transparent" }}
                  >
                    <div style={{ width: 13, height: 13, borderRadius: 3, border: "1.5px solid " + (on ? col : "rgba(255,255,255,0.1)"), background: on ? col : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {on && <span style={{ color: "#141413", fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ flex: 1, fontSize: 12, color: on ? col : "#F1EFE8", fontWeight: on ? 500 : 400 }}>{tier}</span>
                    <span style={S.sm}>{cnt}</span>
                  </div>
                );
              })}
            </>
          }
          filterActive={tiers.size > 0}
          sortAsc={sortAsc}
          onToggleSortAsc={() => setSortAsc((a) => !a)}
        />
      )}

      {!loaded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                background: "#1E1E1C",
                borderRadius: 10,
                height: 62,
                opacity: 0.4 + i * 0.08,
                animation: "pulse 1.2s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {loaded && visits.length === 0 && (
        <p style={{ fontSize: 13, color: "#888780" }}>
          {t.noEntriesYet || "No entries yet."}
        </p>
      )}

      {loaded && groupsPage.visible.map(({ grp, head }) => (
        <RestRow
          key={head.id}
          e={head}
          display={getDisplay(head)}
          user={user}
          visits={grp.length}
          group={grp}
          weights={weights}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      ))}

      {loaded && (
        <ShowMoreButton
          remaining={groupsPage.remaining}
          pageSize={groupsPage.pageSize}
          onClick={groupsPage.showMore}
        />
      )}
    </div>
  );
}
