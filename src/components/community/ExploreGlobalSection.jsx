import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  fetchAggregatedRestaurantPlaces,
  fetchAggregatedCafePlaces,
} from "../../utils/visitPlacesApi.js";
import { globalCache, GLOBAL_TTL_MS } from "../../utils/sessionCache.js";
import {
  calcBiteOutOf10,
  calcCafeOutOf10,
  scoreColor,
  scoreLabel,
  tasteColor,
  tasteLabel,
} from "../../utils/scoring.js";
import { rating010FilterRows } from "../../constants/ratingTiers0to10.js";
import { S } from "../../styles/sharedStyles.js";
import { PlaceLeaderboardRow } from "./PlaceLeaderboardRow.jsx";
import { usePaginatedList } from "../usePaginatedList.js";
import { ShowMoreButton } from "../ShowMoreButton.jsx";
import { SortFilterToolbar } from "../SortFilterToolbar.jsx";

const CATS = [
  { key: "restaurants", labelKey: "restaurants", icon: "🍽" },
  { key: "drinks", labelKey: "drinks", icon: "☕" },
  { key: "sweets", labelKey: "sweets", icon: "🥐" },
];

/**
 * Explore > Global sub-section (was the standalone GlobalTab).
 *
 * Aggregated place leaderboard, one row per place. Score is BITE computed
 * "mean-then-BITE": each raw input (taste/cost/portions/wait/repeat) is
 * averaged across all visits, then BITE is applied once with the viewer's
 * own weights. That makes the leaderboard personalized — bumping the My Taste
 * sliders re-ranks Global without a refetch.
 *
 * Café tabs (drinks / sweets) use their own café weights, so the same place
 * can land at different BITE under restaurants vs. drinks.
 *
 * Toolbar mirrors My Log: View pill (BITE / Taste / Bang-Buck / Wait /
 * Repeatability), multi-select City pill, search, tier filter, sort direction.
 * The selected View also drives the right-side metric on each leaderboard
 * row (via `display` prop on `PlaceLeaderboardRow`).
 */
export function ExploreGlobalSection({ user, restaurantWeights, drinkWeights, sweetWeights }) {
  const { t } = useLang();
  const [cat, setCat] = useState("restaurants");
  const [restaurants, setRestaurants] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sweets, setSweets] = useState([]);
  const [loading, setLoading] = useState(false);

  const [viewBy, setViewBy] = useState("bite");
  const [sortAsc, setSortAsc] = useState(false);
  const [cityFilter, setCityFilter] = useState(new Set());
  const [search, setSearch] = useState("");
  const [tiers, setTiers] = useState(new Set());

  useEffect(() => {
    // Use cached data if it belongs to the same user and is within TTL.
    if (
      globalCache.userId === user?.id &&
      Date.now() - globalCache.fetchedAt < GLOBAL_TTL_MS
    ) {
      setRestaurants(globalCache.restaurants);
      setDrinks(globalCache.drinks);
      setSweets(globalCache.sweets);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [r, d, s] = await Promise.all([
          fetchAggregatedRestaurantPlaces(supabase, { minVisits: 1 }),
          fetchAggregatedCafePlaces(supabase, { minVisits: 1, categoryFilter: "drinks" }),
          fetchAggregatedCafePlaces(supabase, { minVisits: 1, categoryFilter: "sweets" }),
        ]);
        if (cancelled) return;
        setRestaurants(r);
        setDrinks(d);
        setSweets(s);
        globalCache.restaurants = r;
        globalCache.drinks = d;
        globalCache.sweets = s;
        globalCache.fetchedAt = Date.now();
        globalCache.userId = user?.id;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** `repeatability` is integer 0–3 with a non-linear `rMult` lookup; round the
   *  averaged value to the nearest int and clamp so it lands on a real bucket. */
  function roundedRepeat(avgRepeat) {
    if (avgRepeat == null || !Number.isFinite(avgRepeat)) return 0;
    return Math.max(0, Math.min(3, Math.round(avgRepeat)));
  }

  function biteForPlace(place) {
    if (!place || place.validCount < 1) return null;
    const args = [
      place.avgTaste,
      place.avgCost,
      place.avgPortions,
      place.avgWait,
      place.useRMajority,
      roundedRepeat(place.avgRepeat),
    ];
    if (cat === "restaurants") return calcBiteOutOf10(...args, restaurantWeights);
    if (cat === "drinks") return calcCafeOutOf10(...args, drinkWeights);
    return calcCafeOutOf10(...args, sweetWeights);
  }

  function sortValue(p) {
    if (viewBy === "taste") return p.avgTaste ?? 0;
    if (viewBy === "bpb") return -((p.avgCost ?? 0) / (p.avgPortions || 1));
    if (viewBy === "wait") return -(p.avgWait ?? 0);
    if (viewBy === "repeat") return p.avgRepeat ?? 0;
    return p.bite ?? 0;
  }

  /** Right-side metric on the leaderboard row mirrors the My Log getDisplay shape. */
  function getDisplay(p) {
    if (viewBy === "taste") {
      const v = p.avgTaste;
      return { val: v != null ? v.toFixed(1) : "—", label: tasteLabel(v, t), color: tasteColor(v) };
    }
    if (viewBy === "bpb") {
      const v = (p.avgCost ?? 0) / (p.avgPortions || 1);
      return { val: "$" + v.toFixed(2), label: t.perPortion, color: "#5B9BD5" };
    }
    if (viewBy === "wait") {
      const v = p.avgWait ?? 0;
      return { val: v.toFixed(0) + " min", label: t.waitLabel, color: "#888780" };
    }
    if (viewBy === "repeat") {
      const r = roundedRepeat(p.avgRepeat);
      const stars = "⭐".repeat(r) || "✕";
      const lbl = r === 3 ? t.mustReturnLabel : r === 2 ? t.wouldSeekOutLabel : r === 1 ? t.ifOccasionCallsLabel : t.wouldntReturnLabel;
      return { val: stars, label: lbl, color: "#EF9F27" };
    }
    return { val: p.bite != null ? p.bite.toFixed(2) : "—", label: scoreLabel(p.bite, t), color: scoreColor(p.bite) };
  }

  const baseRows = useMemo(() => {
    const base = cat === "restaurants" ? restaurants : cat === "drinks" ? drinks : sweets;
    return base.map((p) => ({ ...p, bite: biteForPlace(p) })).filter((p) => p.bite != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, restaurants, drinks, sweets, restaurantWeights, drinkWeights, sweetWeights]);

  const cityCounts = useMemo(() => {
    const m = new Map();
    baseRows.forEach((p) => {
      const c = p.city || "NYC";
      m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [baseRows]);

  const tierFilterRows = rating010FilterRows(t);

  const rows = useMemo(() => {
    return baseRows
      .filter((p) => cityFilter.size === 0 || cityFilter.has(p.city || "NYC"))
      .filter((p) => tiers.size === 0 || tiers.has(scoreLabel(p.bite, t)))
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const cuisineOrCat = p.cuisine || p.category || "";
        return p.name.toLowerCase().includes(q)
          || cuisineOrCat.toLowerCase().includes(q)
          || (p.city || "").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const va = sortValue(a);
        const vb = sortValue(b);
        if (va !== vb) return sortAsc ? va - vb : vb - va;
        return b.visitCount - a.visitCount;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRows, cityFilter, tiers, search, viewBy, sortAsc, t]);

  /** Pagination tail. Reset on cat / view / sort / filter / search changes so
   *  the user lands at the top of the new results. */
  const rowsPage = usePaginatedList(
    rows,
    `${cat}|${viewBy}|${sortAsc}|${[...cityFilter].sort().join(",")}|${[...tiers].join(",")}|${search}`,
  );

  return (
    <div>
      <div style={{
        display: "flex", background: "#252523", borderRadius: 10, padding: 3,
        gap: 2, marginBottom: 12,
      }}>
        {CATS.map((c) => {
          const on = cat === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              style={{
                flex: 1, padding: "6px 0", textAlign: "center", borderRadius: 8,
                border: "none",
                background: on ? "#3C1F13" : "transparent",
                color: on ? "#F0997B" : "#888780",
                fontSize: 11, fontWeight: on ? 700 : 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {c.icon} {t[c.labelKey]}
            </button>
          );
        })}
      </div>

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
              const cnt = baseRows.filter((p) => scoreLabel(p.bite, t) === tier).length;
              return (
                <div
                  key={tier}
                  onClick={() => setTiers((p) => { const n = new Set(p); on ? n.delete(tier) : n.add(tier); return n; })}
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

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: "#1E1E1C", borderRadius: 10, height: 62, opacity: 0.4 + i * 0.1 }} />
          ))}
        </div>
      )}

      {!loading && !rows.length && (
        <p style={{ color: "#888780", fontSize: 14 }}>{t.noEntriesYet}</p>
      )}

      {!loading && rowsPage.visible.map((p) => (
        <PlaceLeaderboardRow
          key={`${p.placeId}-${p.category || "rest"}`}
          place={p}
          bite={p.bite}
          display={getDisplay(p)}
        />
      ))}
      {!loading && (
        <ShowMoreButton
          remaining={rowsPage.remaining}
          pageSize={rowsPage.pageSize}
          onClick={rowsPage.showMore}
        />
      )}
    </div>
  );
}
