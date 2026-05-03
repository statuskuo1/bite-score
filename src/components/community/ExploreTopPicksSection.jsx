import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { fetchAggregatedRestaurantPlaces } from "../../utils/visitPlacesApi.js";
import { globalCache, GLOBAL_TTL_MS } from "../../utils/sessionCache.js";
import { calcBiteOutOf10, scoreLabel, tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { PlaceStatsSheet } from "./PlaceStatsSheet.jsx";

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

function flagFor(cuisine, name) {
  return FLAGS[cuisine] || (cuisine?.[0] || name?.[0] || "?").toUpperCase();
}

function roundedRepeat(avgRepeat) {
  if (avgRepeat == null || !Number.isFinite(avgRepeat)) return 0;
  return Math.max(0, Math.min(3, Math.round(avgRepeat)));
}

function TopPickRow({ pick, restaurantWeights, rank }) {
  const { t } = useLang();
  const [showStats, setShowStats] = useState(false);
  const bite = calcBiteOutOf10(
    pick.avgTaste, pick.avgCost, pick.avgPortions, pick.avgWait,
    pick.useRMajority, roundedRepeat(pick.avgRepeat),
    restaurantWeights, "USD",
  );
  const col = tasteColor(pick.avgTaste);
  return (
    <>
    <div style={ROW_STYLE}>
      {rank != null && (
        <div style={{ width: 22, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#666663", flexShrink: 0, lineHeight: 1 }}>
          #{rank}
        </div>
      )}
      <div style={FLAG_BOX_STYLE}>{flagFor(pick.cuisine, pick.name)}</div>
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
          {[pick.cuisine || null, pick.city || null, `${pick.visitCount} log${pick.visitCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
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
          kind: "rest",
          name: pick.name,
          cuisine: pick.cuisine,
          city: pick.city,
        }}
        restaurantWeights={restaurantWeights}
        onClose={() => setShowStats(false)}
      />
    )}
    </>
  );
}

/**
 * Explore > Top Picks sub-section.
 *
 * Pulls the full global restaurant aggregate, filters to places the viewer
 * hasn't personally logged, applies a taste floor of max(ownAvg, 7),
 * re-scores using the viewer's My Taste weights, and shows the top 10 by BITE.
 * A city pill lets the viewer narrow to a specific city.
 *
 * Shares globalCache with ExploreGlobalSection so either section warms the
 * cache for the other.
 */
export function ExploreTopPicksSection({ user, myEntries = [], restaurantWeights }) {
  const { t } = useLang();
  const [restaurants, setRestaurants] = useState(() => globalCache.restaurants || []);
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

  useEffect(() => {
    if (!user?.id) return;
    if (
      globalCache.userId === user?.id &&
      Date.now() - globalCache.fetchedAt < GLOBAL_TTL_MS &&
      globalCache.restaurants?.length
    ) {
      setRestaurants(globalCache.restaurants);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await fetchAggregatedRestaurantPlaces(supabase, { minVisits: 1 });
      if (cancelled) return;
      setRestaurants(r);
      globalCache.restaurants = r;
      if (!globalCache.fetchedAt) {
        globalCache.fetchedAt = Date.now();
        globalCache.userId = user?.id;
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /** Candidates: global places the user hasn't visited that clear the taste floor. */
  const candidates = useMemo(() => {
    if (!restaurants.length) return [];
    const visitedPlaceIds = new Set(myEntries.map((e) => e.placeId).filter(Boolean));
    const myTasteAvg = myEntries.length > 0
      ? myEntries.reduce((sum, e) => sum + (e.taste || 0), 0) / myEntries.length
      : 0;
    const tasteFloor = Math.max(myTasteAvg, 7);
    return restaurants
      .filter((p) => !visitedPlaceIds.has(p.placeId))
      .filter((p) => (p.avgTaste ?? 0) >= tasteFloor)
      .map((p) => ({
        ...p,
        bite: calcBiteOutOf10(
          p.avgTaste, p.avgCost, p.avgPortions, p.avgWait,
          p.useRMajority, roundedRepeat(p.avgRepeat),
          restaurantWeights, "USD",
        ),
      }))
      .filter((p) => p.bite != null);
  }, [restaurants, myEntries, restaurantWeights]);

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

  if (!restaurants.length) {
    return (
      <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
        {t.topPicksEmptyLoading || "Loading…"}
      </p>
    );
  }

  return (
    <div>
      {/* Toolbar: city filter pill */}
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
        Scored with your weights from all BITE user ratings
      </p>

      {topPicks.length === 0 ? (
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
          {cityFilter.size > 0
            ? "No picks in the selected city yet."
            : (t.topPicksEmptyAll || "You've already logged everything the community recommends — nice!")}
        </p>
      ) : (
        topPicks.map((p, i) => (
          <TopPickRow key={p.placeId} rank={i+1} pick={p} restaurantWeights={restaurantWeights} />
        ))
      )}
    </div>
  );
}
