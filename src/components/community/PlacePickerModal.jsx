import { useEffect, useMemo, useState } from "react";
import { calcBiteOutOf10 } from "../../utils/scoring.js";
import { globalCache } from "../../utils/sessionCache.js";
import { fetchAggregatedRestaurantPlaces } from "../../utils/visitPlacesApi.js";
import { supabase } from "../../config/supabaseClient.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { CuisineInput } from "../CuisineInput.jsx";

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

export function PlacePickerModal({
  user, myVisits, theirVisits, myWeights, theirWeights,
  myDisplayName, friendName, onClose,
}) {
  const [step, setStep] = useState("input");
  const [cuisine, setCuisine] = useState("");
  const [budget, setBudget] = useState(null);
  const [visitTab, setVisitTab] = useState("neither");
  const [shufflePage, setShufflePage] = useState(0);
  const [entered, setEntered] = useState(false);
  const [cacheReady, setCacheReady] = useState(() => globalCache.restaurants.length > 0);
  const [cacheLoading, setCacheLoading] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
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

  const myPlaceIds = useMemo(
    () => new Set(myVisits.map(v => v.placeId)),
    [myVisits],
  );
  const theirPlaceIds = useMemo(
    () => new Set(theirVisits.map(v => v.placeId)),
    [theirVisits],
  );
  const myAvgTaste = useMemo(
    () => arrAvg(myVisits.map(v => +v.taste)),
    [myVisits],
  );
  const theirAvgTaste = useMemo(
    () => arrAvg(theirVisits.map(v => +v.taste)),
    [theirVisits],
  );

  const ranked = useMemo(() => {
    const myThreshold = Math.max(7, myAvgTaste);
    const theirThreshold = Math.max(7, theirAvgTaste);
    const myWts = myWeights ?? DEFAULT_WEIGHTS;
    const theirWts = theirWeights ?? DEFAULT_WEIGHTS;

    const candidates = (globalCache.restaurants || []).filter(place => {
      if (place.validCount < 1 || place.avgTaste == null) return false;
      if (place.avgTaste < myThreshold || place.avgTaste < theirThreshold) return false;

      const inMine = myPlaceIds.has(place.placeId);
      const inTheirs = theirPlaceIds.has(place.placeId);
      if (visitTab === "neither" && (inMine || inTheirs)) return false;
      if (visitTab === "onlyMine" && (!inMine || inTheirs)) return false;
      if (visitTab === "onlyTheirs" && (inMine || !inTheirs)) return false;

      if (cuisine) {
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
    });

    const scored = candidates.map(place => {
      const r = rr(place.avgRepeat);
      const scoreA = calcBiteOutOf10(
        place.avgTaste, place.avgCost, place.avgPortions,
        place.avgWait, place.useRMajority, r, myWts, "USD",
      );
      const scoreB = calcBiteOutOf10(
        place.avgTaste, place.avgCost, place.avgPortions,
        place.avgWait, place.useRMajority, r, theirWts, "USD",
      );
      if (scoreA == null || scoreB == null) return null;
      return { place, scoreA, scoreB, minScore: Math.min(scoreA, scoreB) };
    }).filter(Boolean);

    return scored.sort((a, b) => b.minScore - a.minScore).slice(0, 9);
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    cuisine, budget, visitTab, cacheReady,
    myAvgTaste, theirAvgTaste, myPlaceIds, theirPlaceIds,
    myWeights, theirWeights,
  ]);

  useEffect(() => { setShufflePage(0); }, [ranked]);

  function buildReason({ place }) {
    const myCv = myVisits.filter(v => v.cuisine === place.cuisine);
    const thCv = theirVisits.filter(v => v.cuisine === place.cuisine);
    const myAvgC = myCv.length ? arrAvg(myCv.map(v => +v.taste)) : null;
    const thAvgC = thCv.length ? arrAvg(thCv.map(v => +v.taste)) : null;
    const myFn = firstName(myDisplayName);
    const thFn = firstName(friendName);

    if (myCv.length >= 2 && myAvgC >= 7.5 && thCv.length >= 2 && thAvgC >= 7.5) {
      return `${myFn} rates ${place.cuisine} ${myAvgC.toFixed(1)} on avg. ${thFn} has been ${thCv.length} times.`;
    }
    if (myCv.length === 0 && thCv.length === 0) {
      return `${place.cuisine} scores well for both of you — neither of you has tried this one.`;
    }
    if (myCv.length > 0 && thCv.length === 0) {
      return `${myFn} loved it here (${myAvgC.toFixed(1)}). First time for ${thFn}.`;
    }
    if (thCv.length > 0 && myCv.length === 0) {
      return `${thFn} loved it here (${thAvgC.toFixed(1)}). First time for ${myFn}.`;
    }
    return null;
  }

  const maxPages = Math.max(1, Math.ceil(ranked.length / 3));
  const visibleBatch = ranked.slice(shufflePage * 3, shufflePage * 3 + 3);
  const isLastPage = shufflePage >= maxPages - 1;
  const myFn = firstName(myDisplayName);
  const thFn = firstName(friendName);

  const tabOptions = [
    { key: "onlyMine", label: `Only ${myFn}` },
    { key: "neither", label: "Neither" },
    { key: "onlyTheirs", label: `Only ${thFn}` },
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.78)",
          zIndex: 399,
        }}
      />
      <div
        style={{
          position: "fixed", bottom: 0,
          left: "50%",
          transform: entered
            ? "translateX(-50%) translateY(0)"
            : "translateX(-50%) translateY(100%)",
          transition: "transform 0.25s ease-out",
          width: "100%", maxWidth: 480,
          background: "#1A1A18",
          borderRadius: "20px 20px 0 0",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "12px 16px 40px",
          zIndex: 400,
          boxSizing: "border-box",
        }}
      >
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.2)",
          margin: "0 auto 20px",
        }} />

        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 20,
        }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8" }}>
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
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>Cuisine</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
              <Pill label="Anything" active={!cuisine} onClick={() => setCuisine("")} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <CuisineInput
                  value={cuisine}
                  onChange={v => setCuisine(v)}
                  placeholder="Specific cuisine…"
                />
              </div>
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

            <div style={{
              display: "flex", gap: 6, marginBottom: 16, overflowX: "auto",
              paddingBottom: 2,
            }}>
              {tabOptions.map(opt => (
                <Pill
                  key={opt.key}
                  label={opt.label}
                  active={visitTab === opt.key}
                  onClick={() => setVisitTab(opt.key)}
                />
              ))}
            </div>

            {cacheLoading && (
              <p style={{ fontSize: 13, color: "#888780", textAlign: "center" }}>
                Finding places…
              </p>
            )}

            {!cacheLoading && ranked.length === 0 && (
              <p style={{
                fontSize: 13, color: "#888780",
                textAlign: "center", padding: "24px 0",
              }}>
                No places match both your tastes right now. Try "Anything" or a wider budget.
              </p>
            )}

            {visibleBatch.map(item => {
              const { place, scoreA, scoreB } = item;
              const reason = buildReason(item);
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                place.name + (place.city ? ", " + place.city : "")
              )}`;
              return (
                <div
                  key={place.placeId}
                  style={{
                    background: "#1E1E1C",
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "#252523", display: "flex",
                      alignItems: "center", justifyContent: "center",
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
                    <div style={{
                      fontSize: 11, color: "#888780", marginBottom: 6, fontStyle: "italic",
                    }}>
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
            })}

            {ranked.length > 0 && (
              <button
                type="button"
                onClick={() => setShufflePage(p => (p + 1) % maxPages)}
                style={{
                  width: "100%", padding: 11,
                  background: "transparent",
                  border: "0.5px solid rgba(255,255,255,0.15)",
                  borderRadius: 10, color: "#888780",
                  fontSize: 14, cursor: "pointer", marginTop: 4,
                }}
              >
                {isLastPage ? "Start over" : "Shuffle ↺"}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
