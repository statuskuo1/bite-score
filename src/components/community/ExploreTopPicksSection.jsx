import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import {
  fetchAggregatedRestaurantPlaces,
  fetchAggregatedCafePlaces,
} from "../../utils/visitPlacesApi.js";
import { listTasteBuds } from "../../utils/followsApi.js";
import { tasteBudsPicksCache, GLOBAL_TTL_MS } from "../../utils/sessionCache.js";
import {
  calcBiteOutOf10,
  calcCafeOutOf10,
  scoreLabel,
  tasteColor,
} from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { PlaceStatsSheet } from "./PlaceStatsSheet.jsx";

const CATS = [
  { key: "restaurants", labelKey: "restaurants", icon: "🍽" },
  { key: "drinks", labelKey: "drinks", icon: "☕" },
  { key: "sweets", labelKey: "sweets", icon: "🥐" },
];

const DRINK_CATS = ["Coffee", "Tea", "Other"];

const ROW_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  marginBottom: 6,
  background: "#1E1E1C",
  border: "0.5px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
};

const FLAG_BOX_STYLE = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: "#252523",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  flexShrink: 0,
};

const PILL_STYLE = {
  padding: "5px 10px",
  borderRadius: 8,
  background: "#1E1E1C",
  border: "0.5px solid rgba(255,255,255,0.15)",
  color: "#C4C2BA",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const DROPDOWN_STYLE = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  zIndex: 200,
  background: "#1E1E1C",
  border: "0.5px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
  minWidth: 160,
  maxHeight: 240,
  overflowY: "auto",
};

function flagFor(cuisineOrCat, name) {
  return FLAGS[cuisineOrCat] || (cuisineOrCat?.[0] || name?.[0] || "?").toUpperCase();
}

function roundedRepeat(avgRepeat) {
  if (avgRepeat == null || !Number.isFinite(avgRepeat)) return 0;
  return Math.max(0, Math.min(3, Math.round(avgRepeat)));
}

function TopPickRow({ pick, cat, weights, rank }) {
  const { t } = useLang();
  const [showStats, setShowStats] = useState(false);
  const isRest = cat === "restaurants";
  const scorer = isRest ? calcBiteOutOf10 : calcCafeOutOf10;
  const bite = scorer(
    pick.avgTaste, pick.avgCost, pick.avgPortions, pick.avgWait,
    pick.useRMajority, roundedRepeat(pick.avgRepeat),
    weights, "USD",
  );
  const col = tasteColor(pick.avgTaste);
  const subtitleParts = isRest
    ? [pick.cuisine || null, pick.city || null]
    : [pick.category || null, pick.city || null];
  return (
    <>
    <div style={ROW_STYLE}>
      {rank != null && (
        <div style={{ width: 22, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#666663", flexShrink: 0, lineHeight: 1 }}>
          #{rank}
        </div>
      )}
      <div style={FLAG_BOX_STYLE}>{flagFor(isRest ? pick.cuisine : pick.category, pick.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={() => { if (pick.placeId) setShowStats(true); }}
          style={{
            fontSize: 14, fontWeight: 500, color: "#F1EFE8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            cursor: pick.placeId ? "pointer" : undefined,
            textDecoration: pick.placeId ? "underline" : undefined,
            textDecorationColor: "rgba(255,255,255,0.2)",
          }}
        >{pick.name}</div>
        <div style={{ fontSize: 11, color: "#888780", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[...subtitleParts, `${pick.visitCount} log${pick.visitCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: col, lineHeight: 1.1 }}>
          {bite != null ? bite.toFixed(1) : "—"}
        </div>
        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>
          {bite != null ? (scoreLabel(bite, t) || "BITE") : ""}
        </div>
      </div>
    </div>
    {showStats && (
      <PlaceStatsSheet
        post={{
          placeId: pick.placeId,
          kind: isRest ? "rest" : "cafe",
          name: pick.name,
          cuisine: pick.cuisine,
          category: pick.category,
          city: pick.city,
        }}
        restaurantWeights={isRest ? weights : undefined}
        drinkWeights={cat === "drinks" ? weights : undefined}
        sweetWeights={cat === "sweets" ? weights : undefined}
        onClose={() => setShowStats(false)}
      />
    )}
    </>
  );
}

/**
 * Explore > Top Picks sub-section.
 *
 * Pulls Taste-Buds-only aggregates for restaurants, drinks, and sweets — the
 * viewer themselves is intentionally excluded from the aggregate (otherwise
 * the picks would be biased toward places the viewer's already weighted in).
 * For the active category, we filter to places the viewer hasn't personally
 * logged, apply a taste floor of max(ownAvgInCat, 7), re-score using the
 * viewer's own weights for that category, and show the top 10 by BITE.
 *
 * Caches into tasteBudsPicksCache (separate from globalCache so Explore ›
 * Global can't accidentally reuse the bud-filtered rows). The cache is keyed
 * by userId + budsKey so following / unfollowing a bud invalidates ahead of
 * the TTL.
 *
 * Empty bud set → render the noBuds copy and skip the fetches entirely.
 */
export function ExploreTopPicksSection({
  user,
  myEntries = [],
  cafes = [],
  restaurantWeights,
  drinkWeights,
  sweetWeights,
}) {
  const { t } = useLang();
  const [cat, setCat] = useState("restaurants");
  const [budIds, setBudIds] = useState(null); // null = loading, [] = no buds
  const [restaurants, setRestaurants] = useState(() => tasteBudsPicksCache.restaurants || []);
  const [drinks, setDrinks] = useState(() => tasteBudsPicksCache.drinks || []);
  const [sweets, setSweets] = useState(() => tasteBudsPicksCache.sweets || []);
  const [cityFilter, setCityFilter] = useState(new Set());
  const [openCity, setOpenCity] = useState(false);
  const cityRef = useRef(null);

  useEffect(() => {
    function h(e) {
      if (cityRef.current && !cityRef.current.contains(e.target)) setOpenCity(false);
    }
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, []);

  /** Reset the city filter when switching tabs so a city that exists in one
   *  category but not another doesn't leave the list mysteriously empty. */
  useEffect(() => { setCityFilter(new Set()); }, [cat]);

  /** Resolve the viewer's Taste Buds first; the aggregate fetches below
   *  short-circuit on empty bud sets so we never quietly fall back to a
   *  global query. */
  useEffect(() => {
    if (!user?.id) { setBudIds(null); return; }
    let cancelled = false;
    (async () => {
      const buds = await listTasteBuds(supabase, user.id);
      if (cancelled) return;
      const ids = (buds || []).map((b) => b.otherUserId).filter(Boolean);
      setBudIds(ids);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !budIds) return;
    if (budIds.length === 0) {
      setRestaurants([]); setDrinks([]); setSweets([]);
      return;
    }
    const budsKey = budIds.slice().sort().join(",");
    if (
      tasteBudsPicksCache.userId === user.id &&
      tasteBudsPicksCache.budsKey === budsKey &&
      Date.now() - tasteBudsPicksCache.fetchedAt < GLOBAL_TTL_MS &&
      tasteBudsPicksCache.restaurants?.length
    ) {
      setRestaurants(tasteBudsPicksCache.restaurants);
      setDrinks(tasteBudsPicksCache.drinks || []);
      setSweets(tasteBudsPicksCache.sweets || []);
      return;
    }
    let cancelled = false;
    (async () => {
      const [r, d, s] = await Promise.all([
        fetchAggregatedRestaurantPlaces(supabase, { minVisits: 1, userIds: budIds }),
        fetchAggregatedCafePlaces(supabase, { minVisits: 1, categoryFilter: "drinks", userIds: budIds }),
        fetchAggregatedCafePlaces(supabase, { minVisits: 1, categoryFilter: "sweets", userIds: budIds }),
      ]);
      if (cancelled) return;
      setRestaurants(r);
      setDrinks(d);
      setSweets(s);
      tasteBudsPicksCache.restaurants = r;
      tasteBudsPicksCache.drinks = d;
      tasteBudsPicksCache.sweets = s;
      tasteBudsPicksCache.fetchedAt = Date.now();
      tasteBudsPicksCache.userId = user.id;
      tasteBudsPicksCache.budsKey = budsKey;
    })();
    return () => { cancelled = true; };
  }, [user?.id, budIds]);

  /** Per-category source, weights, scorer, and the viewer's own entries used
   *  for taste-floor and "already logged" dedup. */
  const ctx = useMemo(() => {
    if (cat === "drinks") {
      return {
        source: drinks,
        weights: drinkWeights,
        scorer: calcCafeOutOf10,
        myCatEntries: cafes.filter((e) => DRINK_CATS.includes(e.category)),
      };
    }
    if (cat === "sweets") {
      return {
        source: sweets,
        weights: sweetWeights,
        scorer: calcCafeOutOf10,
        myCatEntries: cafes.filter((e) => e.category === "Sweets"),
      };
    }
    return {
      source: restaurants,
      weights: restaurantWeights,
      scorer: calcBiteOutOf10,
      myCatEntries: myEntries,
    };
  }, [cat, restaurants, drinks, sweets, restaurantWeights, drinkWeights, sweetWeights, cafes, myEntries]);

  /** Candidates: places in this category the user hasn't visited that clear
   *  the taste floor. */
  const candidates = useMemo(() => {
    const { source, weights, scorer, myCatEntries } = ctx;
    if (!source.length) return [];
    const visitedPlaceIds = new Set(myCatEntries.map((e) => e.placeId).filter(Boolean));
    const myTasteAvg = myCatEntries.length > 0
      ? myCatEntries.reduce((sum, e) => sum + (e.taste || 0), 0) / myCatEntries.length
      : 0;
    const tasteFloor = Math.max(myTasteAvg, 7);
    return source
      .filter((p) => !visitedPlaceIds.has(p.placeId))
      .filter((p) => (p.avgTaste ?? 0) >= tasteFloor)
      .map((p) => ({
        ...p,
        bite: scorer(
          p.avgTaste, p.avgCost, p.avgPortions, p.avgWait,
          p.useRMajority, roundedRepeat(p.avgRepeat),
          weights, "USD",
        ),
      }))
      .filter((p) => p.bite != null);
  }, [ctx]);

  /** City counts from all candidates (before city filter), sorted by frequency. */
  const cityCounts = useMemo(() => {
    const m = new Map();
    candidates.forEach((p) => {
      const c = p.city || "";
      if (c) m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [candidates]);

  /** Final top 10 after applying city filter and sorting by BITE. */
  const topPicks = useMemo(() => {
    return candidates
      .filter((p) => cityFilter.size === 0 || cityFilter.has(p.city || ""))
      .sort((a, b) => b.bite - a.bite)
      .slice(0, 10);
  }, [candidates, cityFilter]);

  const cityLabelText = (() => {
    if (cityFilter.size === 0) return `City: All`;
    const list = [...cityFilter];
    if (list.length === 1) return `City: ${list[0]}`;
    return `City: ${list[0]} +${list.length - 1}`;
  })();

  if (!user) {
    return (
      <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
        {t.signInToSeeTopPicks || "Sign in to see personalized top picks."}
      </p>
    );
  }

  if (budIds && budIds.length === 0) {
    return (
      <div>
        <CategoryStrip cat={cat} setCat={setCat} t={t} />
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
          {t.topPicksEmptyNoBuds || "Follow some Taste Buds to see what they all love."}
        </p>
      </div>
    );
  }

  const sourceForCat = cat === "drinks" ? drinks : cat === "sweets" ? sweets : restaurants;
  if (!sourceForCat.length) {
    return (
      <div>
        <CategoryStrip cat={cat} setCat={setCat} t={t} />
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
          {t.topPicksEmptyLoading || "Loading…"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <CategoryStrip cat={cat} setCat={setCat} t={t} />

      {cityCounts.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
          <div ref={cityRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setOpenCity((x) => !x)}
              style={{
                ...PILL_STYLE,
                borderColor: (openCity || cityFilter.size > 0) ? "#F0997B" : "rgba(255,255,255,0.15)",
                color: (openCity || cityFilter.size > 0) ? "#F0997B" : "#C4C2BA",
              }}
            >
              {cityLabelText} <span style={{ fontSize: 9, opacity: 0.8 }}>▼</span>
            </button>
            {openCity && (
              <div style={DROPDOWN_STYLE}>
                <div
                  onClick={() => { setCityFilter(new Set()); setOpenCity(false); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer", fontSize: 12,
                    color: cityFilter.size === 0 ? "#F0997B" : "#F1EFE8",
                    background: cityFilter.size === 0 ? "rgba(240,153,123,0.08)" : "transparent",
                    borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                  }}
                >
                  All cities
                </div>
                {cityCounts.map(([city, cnt]) => {
                  const on = cityFilter.has(city);
                  return (
                    <div
                      key={city}
                      onClick={() => {
                        const next = new Set(cityFilter);
                        if (on) next.delete(city); else next.add(city);
                        setCityFilter(next);
                      }}
                      style={{
                        padding: "8px 12px", cursor: "pointer", fontSize: 12,
                        color: on ? "#F0997B" : "#F1EFE8",
                        background: on ? "rgba(240,153,123,0.08)" : "transparent",
                        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                        display: "flex", justifyContent: "space-between",
                      }}
                    >
                      <span>{city}</span>
                      <span style={{ color: "#888780", marginLeft: 8 }}>{cnt}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: "#888780", margin: "0 0 12px" }}>
        Scored with your weights from your Taste Buds' ratings
      </p>

      {topPicks.length === 0 ? (
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
          {cityFilter.size > 0
            ? "No picks in the selected city yet."
            : (t.topPicksEmptyAll || "You've already logged everything your Taste Buds recommend — nice!")}
        </p>
      ) : (
        topPicks.map((p, i) => (
          <TopPickRow
            key={`${p.placeId}::${cat}`}
            rank={i+1}
            pick={p}
            cat={cat}
            weights={ctx.weights}
          />
        ))
      )}
    </div>
  );
}

function CategoryStrip({ cat, setCat, t }) {
  return (
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
            {c.icon} {t[c.labelKey] || c.key}
          </button>
        );
      })}
    </div>
  );
}
