import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  fetchAggregatedRestaurantPlaces,
  fetchAggregatedCafePlaces,
} from "../../utils/visitPlacesApi.js";
import { calcBiteOutOf10, calcCafeOutOf10 } from "../../utils/scoring.js";
import { PlaceLeaderboardRow } from "./PlaceLeaderboardRow.jsx";
import { usePaginatedList } from "../usePaginatedList.js";
import { ShowMoreButton } from "../ShowMoreButton.jsx";

const CATS = [
  { key: "restaurants", labelKey: "restaurants", icon: "🍽" },
  { key: "drinks", labelKey: "drinks", icon: "☕" },
  { key: "sweets", labelKey: "sweets", icon: "🥐" },
];

/**
 * Aggregated place leaderboard, one row per place. Score is BITE computed
 * "mean-then-BITE": each raw input (taste/cost/portions/wait/repeat) is
 * averaged across all visits, then BITE is applied once with the viewer's
 * own weights. That makes the leaderboard personalized — bumping the My Taste
 * sliders re-ranks Global without a refetch.
 *
 * Café tabs (drinks / sweets) use their own café weights, so the same place
 * can land at different BITE under restaurants vs. drinks.
 *
 * Min-visits filter (default 1) keeps single-visit places off the top until
 * they get a second confirmation.
 */
export function GlobalTab({ user, restaurantWeights, drinkWeights, sweetWeights }) {
  const { t } = useLang();
  const [cat, setCat] = useState("restaurants");
  const [minVisits, setMinVisits] = useState(1);
  const [restaurants, setRestaurants] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sweets, setSweets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

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

  /** Sort + filter is memo'd so weight changes re-rank without a refetch. */
  const rows = useMemo(() => {
    const base = cat === "restaurants" ? restaurants : cat === "drinks" ? drinks : sweets;
    return base
      .map((p) => ({ ...p, bite: biteForPlace(p) }))
      .filter((p) => p.bite != null && p.visitCount >= minVisits)
      .sort((a, b) => {
        if (b.bite !== a.bite) return b.bite - a.bite;
        return b.visitCount - a.visitCount;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, minVisits, restaurants, drinks, sweets, restaurantWeights, drinkWeights, sweetWeights]);

  /** Pagination tail. Resets when the user switches category or min-visits;
   *  weight changes re-rank in place but the slice from the top still shows
   *  the (newly) best, so weights aren't part of the reset key. */
  const rowsPage = usePaginatedList(rows, `${cat}|${minVisits}`);

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

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: "#888780" }}>{t.minVisitsFilter}:</span>
        {[1, 2, 3, 5].map((n) => {
          const on = minVisits === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setMinVisits(n)}
              style={{
                padding: "3px 10px", borderRadius: 14, fontSize: 11, cursor: "pointer",
                background: on ? "#3C1F13" : "transparent",
                color: on ? "#F0997B" : "#888780",
                border: "1px solid " + (on ? "#F0997B" : "rgba(255,255,255,0.1)"),
              }}
            >
              {n}+
            </button>
          );
        })}
      </div>

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
