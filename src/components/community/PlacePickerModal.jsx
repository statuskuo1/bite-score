import { useEffect, useMemo, useState } from "react";
import { calcBiteOutOf10 } from "../../utils/scoring.js";
import { globalCache } from "../../utils/sessionCache.js";
import { fetchAggregatedRestaurantPlaces } from "../../utils/visitPlacesApi.js";
import { supabase } from "../../config/supabaseClient.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { CuisineInput } from "../CuisineInput.jsx";
import { resolveCity } from "../CityInput.jsx";

const DEFAULT_WEIGHTS = { taste: 50, bpb: 40, wait: 10 };

function rr(avgRepeat) {
  if (avgRepeat == null || !Number.isFinite(avgRepeat)) return 0;
  return Math.max(0, Math.min(3, Math.round(avgRepeat)));
}

function arrAvg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function firstName(name) {
  return (name || "").split(/\s/)[0] || name || "You";
}

function flagFor(cuisine) {
  return FLAGS[cuisine] || (cuisine?.[0] || "?").toUpperCase();
}

function topFromVisits(visits1, visits2, key, limit = 8) {
  const counts = {};
  for (const v of [...(visits1 || []), ...(visits2 || [])]) {
    const val = v[key];
    if (val) counts[val] = (counts[val] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

const BUDGET_OPTIONS = [
  { label: "Under $30", key: "under30" },
  { label: "$30–60", key: "30to60" },
  { label: "$60–100", key: "60to100" },
  { label: "No limit", key: null },
];

function Pill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 999,
        border: active ? "1px solid #F0997B" : "1px solid rgba(255,255,255,0.1)",
        background: active ? "#F0997B" : "#252523",
        color: active ? "#141413" : "#888780",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function scorePlace(place, myWts, theirWts, myActual = [], theirActual = []) {
  function fromVisits(visits, wts) {
    const scores = visits
      .map(v => calcBiteOutOf10(v.taste, v.cost, v.portions, v.wait, v.useR, v.repeatability, wts, v.currency_code || "USD"))
      .filter(s => s != null);
    return scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null;
  }
  const r = rr(place.avgRepeat);
  const a = myActual.length > 0
    ? fromVisits(myActual, myWts)
    : calcBiteOutOf10(place.avgTaste, place.avgCost, place.avgPortions, place.avgWait, place.useRMajority, r, myWts, "USD");
  const b = theirActual.length > 0
    ? fromVisits(theirActual, theirWts)
    : calcBiteOutOf10(place.avgTaste, place.avgCost, place.avgPortions, place.avgWait, place.useRMajority, r, theirWts, "USD");
  if (a == null || b == null) return null;
  return { scoreA: a, scoreB: b, minScore: Math.min(a, b) };
}

export function PlacePickerModal({
  user, myVisits, theirVisits, myWeights, theirWeights,
  myDisplayName, friendName, onClose,
}) {
  const [step, setStep] = useState("input");
  const [cuisine, setCuisine] = useState("Anything");
  const [city, setCity] = useState("Anywhere");
  const [budget, setBudget] = useState(null);
  const [visitTab, setVisitTab] = useState("neither");
  const [displayItems, setDisplayItems] = useState([]);
  const [cacheReady, setCacheReady] = useState(() => globalCache.restaurants.length > 0);
  const [cacheLoading, setCacheLoading] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (globalCache.restaurants.length > 0) return;
    let cancelled = false;
    setCacheLoading(true);
    (async () => {
      const data = await fetchAggregatedRestaurantPlaces(supabase, { minVisits: 1 });
      if (cancelled) return;
      globalCache.restaurants = data || [];
      globalCache.fetchedAt = Date.now();
      if (user?.id) globalCache.userId = user.id;
      setCacheReady(true);
      setCacheLoading(false);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const myPlaceIds = useMemo(() => new Set(myVisits.map(v => v.placeId).filter(Boolean)), [myVisits]);
  const theirPlaceIds = useMemo(() => new Set(theirVisits.map(v => v.placeId).filter(Boolean)), [theirVisits]);
  const myAvgTaste = useMemo(() => arrAvg(myVisits.map(v => +v.taste)), [myVisits]);
  const theirAvgTaste = useMemo(() => arrAvg(theirVisits.map(v => +v.taste)), [theirVisits]);

  const myVisitsMap = useMemo(() => {
    const m = new Map();
    for (const v of myVisits) {
      if (!v.placeId) continue;
      if (!m.has(v.placeId)) m.set(v.placeId, []);
      m.get(v.placeId).push(v);
    }
    return m;
  }, [myVisits]);

  const theirVisitsMap = useMemo(() => {
    const m = new Map();
    for (const v of theirVisits) {
      if (!v.placeId) continue;
      if (!m.has(v.placeId)) m.set(v.placeId, []);
      m.get(v.placeId).push(v);
    }
    return m;
  }, [theirVisits]);

  // Name-keyed fallback for visits without a placeId (legacy rows)
  const myVisitsByName = useMemo(() => {
    const m = new Map();
    for (const v of myVisits) {
      if (!v.name) continue;
      const key = v.name.toLowerCase().trim();
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(v);
    }
    return m;
  }, [myVisits]);

  const theirVisitsByName = useMemo(() => {
    const m = new Map();
    for (const v of theirVisits) {
      if (!v.name) continue;
      const key = v.name.toLowerCase().trim();
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(v);
    }
    return m;
  }, [theirVisits]);

  // Top cuisines / cities these two users have actually dined at, by combined frequency
  const userCuisines = useMemo(
    () => topFromVisits(myVisits, theirVisits, "cuisine"),
    [myVisits, theirVisits],
  );
  const userCities = useMemo(() => {
    const counts = {};
    for (const v of [...(myVisits || []), ...(theirVisits || [])]) {
      const val = resolveCity(v.city || "");
      if (val) counts[val] = (counts[val] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  }, [myVisits, theirVisits]);
  // Full city list from globalCache — used for text-filtering when user types
  const allCities = useMemo(
    () => [...new Set((globalCache.restaurants || []).map(p => resolveCity(p.city || "")).filter(Boolean))].sort(),
    [cacheReady], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const myWts = myWeights ?? DEFAULT_WEIGHTS;
  const theirWts = theirWeights ?? DEFAULT_WEIGHTS;

  const ranked = useMemo(() => {
    const myThreshold = Math.max(7, myAvgTaste);
    const theirThreshold = Math.max(7, theirAvgTaste);

    return (globalCache.restaurants || [])
      .filter(place => {
        if (place.validCount < 1 || place.avgTaste == null) return false;
        if (place.avgTaste < myThreshold || place.avgTaste < theirThreshold) return false;
        const nameKey = place.name?.toLowerCase().trim();
        const inMine = myPlaceIds.has(place.placeId) || (nameKey && myVisitsByName.has(nameKey));
        const inTheirs = theirPlaceIds.has(place.placeId) || (nameKey && theirVisitsByName.has(nameKey));
        if (visitTab === "neither" && (inMine || inTheirs)) return false;
        if (visitTab === "onlyMine" && (!inMine || inTheirs)) return false;
        if (visitTab === "onlyTheirs" && (inMine || !inTheirs)) return false;
        if (visitTab === "both" && (!inMine || !inTheirs)) return false;
        if (city && city !== "Anywhere" && resolveCity(place.city || "") !== resolveCity(city)) return false;
        if (cuisine && cuisine !== "Anything") {
          if (!place.cuisine) return false;
          if (place.cuisine !== cuisine && place.cuisine2 !== cuisine) return false;
        }
        if (budget !== null) {
          if (place.avgCost == null) return false;
          if (budget === "under30" && place.avgCost >= 30) return false;
          if (budget === "30to60" && (place.avgCost < 30 || place.avgCost > 60)) return false;
          if (budget === "60to100" && (place.avgCost < 60 || place.avgCost > 100)) return false;
        }
        return true;
      })
      .map(place => {
        const nameKey = place.name?.toLowerCase().trim();
        const myActual = myVisitsMap.get(place.placeId) || (nameKey && myVisitsByName.get(nameKey)) || [];
        const theirActual = theirVisitsMap.get(place.placeId) || (nameKey && theirVisitsByName.get(nameKey)) || [];
        const s = scorePlace(place, myWts, theirWts, myActual, theirActual);
        return s ? { place, ...s } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.minScore - a.minScore)
      .slice(0, 9);
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    cuisine, city, budget, visitTab, cacheReady,
    myAvgTaste, theirAvgTaste, myPlaceIds, theirPlaceIds,
    myWeights, theirWeights, myVisitsMap, theirVisitsMap, myVisitsByName, theirVisitsByName,
  ]);

  // Fallback: top globally scored places, no filters
  const fallback = useMemo(() => {
    return (globalCache.restaurants || [])
      .filter(place => place.validCount >= 1 && place.avgTaste != null)
      .map(place => {
        const nameKey = place.name?.toLowerCase().trim();
        const myActual = myVisitsMap.get(place.placeId) || (nameKey && myVisitsByName.get(nameKey)) || [];
        const theirActual = theirVisitsMap.get(place.placeId) || (nameKey && theirVisitsByName.get(nameKey)) || [];
        const s = scorePlace(place, myWts, theirWts, myActual, theirActual);
        return s ? { place, ...s } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.minScore - a.minScore)
      .slice(0, 3);
  }, [cacheReady, myWeights, theirWeights, myVisitsMap, theirVisitsMap, myVisitsByName, theirVisitsByName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset display to top 3 whenever ranked changes
  useEffect(() => {
    setDisplayItems(ranked.slice(0, 3));
  }, [ranked]);

  function doShuffle() {
    if (ranked.length === 0) return;
    const pool = [...ranked];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setDisplayItems(pool.slice(0, 3));
  }

  function buildReason({ place }) {
    const nameKey = place.name?.toLowerCase().trim();
    const myBeenHere = myPlaceIds.has(place.placeId) || (nameKey && myVisitsByName.has(nameKey));
    const theirBeenHere = theirPlaceIds.has(place.placeId) || (nameKey && theirVisitsByName.has(nameKey));
    const myCv = myVisits.filter(v => v.cuisine === place.cuisine);
    const thCv = theirVisits.filter(v => v.cuisine === place.cuisine);
    const myAvgC = myCv.length ? arrAvg(myCv.map(v => +v.taste)) : null;
    const thAvgC = thCv.length ? arrAvg(thCv.map(v => +v.taste)) : null;
    const myFn = firstName(myDisplayName);
    const thFn = firstName(friendName);

    if (myCv.length >= 2 && myAvgC >= 7.5 && thCv.length >= 2 && thAvgC >= 7.5) {
      return `${myFn} rates ${place.cuisine} ${myAvgC.toFixed(1)} on avg. ${thFn} rates it ${thAvgC.toFixed(1)}.`;
    }
    if (myCv.length === 0 && thCv.length === 0) {
      return `${place.cuisine} scores well for both of you — neither of you has tried this one.`;
    }
    if (myCv.length > 0 && thCv.length === 0) {
      if (myBeenHere) {
        return `${myFn} rated it ${myAvgC.toFixed(1)}. First time for ${thFn}.`;
      }
      return `${myFn} loves ${place.cuisine} (avg ${myAvgC.toFixed(1)}). New spot for both of you.`;
    }
    if (thCv.length > 0 && myCv.length === 0) {
      if (theirBeenHere) {
        return `${thFn} rated it ${thAvgC.toFixed(1)}. First time for ${myFn}.`;
      }
      return `${thFn} loves ${place.cuisine} (avg ${thAvgC.toFixed(1)}). New spot for both of you.`;
    }
    return null;
  }

  const myFn = firstName(myDisplayName);
  const thFn = firstName(friendName);
  const noFilteredResults = step === "results" && !cacheLoading && ranked.length === 0;

  const tabOptions = [
    { key: "onlyMine", label: `${myFn}'s Been` },
    { key: "neither", label: "Neither Been" },
    { key: "both", label: "Both Been" },
    { key: "onlyTheirs", label: `${thFn}'s Been` },
  ];

  function ResultCard({ item }) {
    const { place, scoreA, scoreB } = item;
    const reason = buildReason(item);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      place.name + (place.city ? ", " + place.city : "")
    )}`;
    return (
      <div style={{
        background: "#252523",
        border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 12, padding: "12px 14px", marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "#2C2C2A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}>
            {flagFor(place.cuisine)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: "#F1EFE8",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{place.name}</div>
            <div style={{ fontSize: 11, color: "#888780" }}>
              {[place.cuisine, place.city].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 9, color: "#888780",
          textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 4,
        }}>
          BITE Score
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
            background: "rgba(240,153,123,0.14)", color: "#F0997B",
            border: "1px solid rgba(240,153,123,0.3)",
          }}>
            {myFn}: {scoreA.toFixed(1)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
            background: "rgba(91,155,213,0.14)", color: "#5B9BD5",
            border: "1px solid rgba(91,155,213,0.3)",
          }}>
            {thFn}: {scoreB.toFixed(1)}
          </span>
        </div>

        {reason && (
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 6, fontStyle: "italic" }}>
            {reason}
          </div>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: "#5B9BD5", textDecoration: "none" }}
        >
          Open in Maps ↗
        </a>
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 399,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          background: "#1E1E1C",
          borderRadius: 16,
          border: "0.5px solid rgba(255,255,255,0.15)",
          padding: "20px 20px 24px",
          boxSizing: "border-box",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 18,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8" }}>
            Pick a place for us
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#888780", fontSize: 20, lineHeight: 1, padding: 4,
            }}
          >✕</button>
        </div>

        {step === "input" ? (
          <div>
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>City</div>
            <div style={{ marginBottom: 16 }}>
              <CuisineInput
                value={city}
                onChange={v => setCity(v)}
                placeholder="City"
                leadingOption="Anywhere"
                defaultOptions={userCities}
                options={allCities}
              />
            </div>

            <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>Cuisine</div>
            <div style={{ marginBottom: 16 }}>
              <CuisineInput
                value={cuisine}
                onChange={v => setCuisine(v)}
                placeholder="Cuisine"
                leadingOption="Anything"
                defaultOptions={userCuisines}
              />
            </div>

            <div style={{ fontSize: 12, color: "#888780", marginBottom: 8 }}>
              Budget (per person, USD)
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {BUDGET_OPTIONS.map(opt => (
                <Pill
                  key={String(opt.key)}
                  label={opt.label}
                  active={budget === opt.key}
                  onClick={() => setBudget(opt.key)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep("results")}
              disabled={cacheLoading}
              style={{
                width: "100%", padding: 13,
                background: "#F0997B", color: "#141413",
                border: "none", borderRadius: 10,
                fontSize: 15, fontWeight: 600,
                cursor: cacheLoading ? "not-allowed" : "pointer",
                opacity: cacheLoading ? 0.6 : 1,
              }}
            >
              {cacheLoading ? "Loading…" : "Find places →"}
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setStep("input")}
              style={{
                fontSize: 12, color: "#888780", background: "none",
                border: "none", cursor: "pointer", padding: 0, marginBottom: 14,
              }}
            >← Back</button>

            <select
              value={visitTab}
              onChange={e => setVisitTab(e.target.value)}
              style={{ width: "100%", marginBottom: 16, fontSize: 13, cursor: "pointer" }}
            >
              {tabOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>

            {cacheLoading && (
              <p style={{ fontSize: 13, color: "#888780", textAlign: "center" }}>
                Finding places…
              </p>
            )}

            {/* Filtered results */}
            {!cacheLoading && !noFilteredResults && (
              <>
                {displayItems.map(item => (
                  <ResultCard key={item.place.placeId} item={item} />
                ))}
                {ranked.length > 3 && (
                  <button
                    type="button"
                    onClick={doShuffle}
                    style={{
                      width: "100%", padding: 11, background: "transparent",
                      border: "0.5px solid rgba(255,255,255,0.15)",
                      borderRadius: 10, color: "#888780",
                      fontSize: 14, cursor: "pointer", marginTop: 4,
                    }}
                  >
                    Shuffle ↺
                  </button>
                )}
              </>
            )}

            {/* No tailored results — fall back to global top */}
            {noFilteredResults && (
              <>
                <div style={{
                  fontSize: 12, color: "#888780", marginBottom: 14,
                  padding: "10px 12px",
                  background: "#252523", borderRadius: 8,
                }}>
                  Not enough data for a strong suggestion between you two. Here are the top globally logged places:
                </div>
                {fallback.map(item => (
                  <ResultCard key={item.place.placeId} item={item} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
