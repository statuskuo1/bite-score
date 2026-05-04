import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { listWantToGo } from "../../utils/wantToGoApi.js";
import {
  wantToGoCache,
  subscribeWantToGo,
  setWantToGoRows,
  GLOBAL_TTL_MS,
} from "../../utils/sessionCache.js";
import { PlaceLeaderboardRow } from "./PlaceLeaderboardRow.jsx";
import { resolveCity } from "../CityInput.jsx";

const DRINK_CATS = new Set(["Coffee", "Tea", "Other"]);

const PILL_BASE_STYLE = {
  padding: "5px 12px",
  borderRadius: 16,
  fontSize: 12,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  whiteSpace: "nowrap",
};

const DROPDOWN_STYLE = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  background: "#1E1E1C",
  border: "0.5px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
  zIndex: 50,
  minWidth: 180,
  overflow: "hidden",
};

/** Short "3d ago" / "Today" formatter for the right-side display column. */
function relativeShort(iso) {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const now = Date.now();
  const diffMs = Math.max(0, now - ts);
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}

/**
 * Explore > Want to Go sub-section.
 *
 * Lists every place the viewer has saved via `addWantToGo`. Three category
 * pills mirror Top Picks / Global (Restaurants / Drinks / Sweets).
 *
 * Rendering reuses `PlaceLeaderboardRow` so rows look identical to Global,
 * and tapping a row opens `PlaceStatsSheet` (the same sheet feed posts tap
 * into). The right-hand display column shows a compact "3d" relative save
 * time with a "Saved" label instead of a BITE score, since the viewer hasn't
 * logged this place yet — the real stats live in the sheet.
 *
 * Data: single `listWantToGo` fetch, session-cached (bumped on add/remove so
 * cross-surface saves and the auto-removal after a visit insert both land
 * without a remount). For legacy cafe rows missing `category`, we backfill
 * from the `cafePlaces` catalog that `App.jsx` already loads, so Drinks and
 * Sweets bucket correctly.
 */
export function ExploreWantToGoSection({
  user,
  cafePlaces = [],
  restaurantWeights,
  drinkWeights,
  sweetWeights,
}) {
  const { t } = useLang();
  const [cat, setCat] = useState("restaurants");
  const [loading, setLoading] = useState(false);
  const [openType, setOpenType] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const [cityFilter, setCityFilter] = useState(new Set());
  const typeRef = useRef(null);
  const cityRef = useRef(null);

  useEffect(() => {
    function h(e) {
      if (typeRef.current && !typeRef.current.contains(e.target)) setOpenType(false);
      if (cityRef.current && !cityRef.current.contains(e.target)) setOpenCity(false);
    }
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, []);

  /** Reset city filter when type changes so a city present under one type
   *  but absent under another doesn't leave the list mysteriously empty. */
  useEffect(() => { setCityFilter(new Set()); }, [cat]);

  const typeLabelByKey = {
    restaurants: t.restaurants,
    drinks: t.drinks,
    sweets: t.sweets,
  };
  const typeLabelText = `${t.typeLabel || "Type"}: ${typeLabelByKey[cat] || cat}`;

  const cityLabelText = (() => {
    const head = `${t.cityLabel || "City"}:`;
    if (cityFilter.size === 0) return `${head} ${t.cityAll || "All"}`;
    const list = [...cityFilter];
    if (list.length === 1) return `${head} ${list[0]}`;
    return `${head} ${list[0]} +${list.length - 1}`;
  })();

  // Rows are read directly from the shared cache via useSyncExternalStore.
  // Any add/remove anywhere in the app (feed, stats sheet, visit auto-remove,
  // boot seed) wakes this subscriber and the tab re-renders with fresh rows
  // — no polling, no manual version bumps.
  const rows = useSyncExternalStore(
    subscribeWantToGo,
    () => wantToGoCache.rows,
    () => wantToGoCache.rows,
  );

  useEffect(() => {
    if (!user?.id) return;
    // Cache is freshly seeded on app boot (App.jsx load()) and kept in sync
    // via mutations; only refetch if the cache belongs to another user or
    // is past its TTL (e.g. long background session).
    const stale =
      wantToGoCache.userId !== user.id ||
      Date.now() - wantToGoCache.fetchedAt > GLOBAL_TTL_MS;
    if (!stale) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await listWantToGo(supabase, user.id);
        if (cancelled) return;
        setWantToGoRows(user.id, data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /** `cafe_places` id → normalized category, for filling in legacy rows. */
  const cafeCategoryById = useMemo(() => {
    const m = new Map();
    for (const p of cafePlaces || []) {
      if (p?.id && p?.category) m.set(p.id, p.category);
    }
    return m;
  }, [cafePlaces]);

  const filtered = useMemo(() => {
    return (rows || []).filter((r) => {
      if (cat === "restaurants") return r.kind === "rest";
      if (r.kind !== "cafe") return false;
      const category = r.category || cafeCategoryById.get(r.place_id) || "";
      if (cat === "sweets") return category === "Sweets";
      // Drinks bucket: explicit drink categories, plus a legacy fallback
      // where we have no category info at all (better to show in Drinks
      // than hide the row entirely).
      if (DRINK_CATS.has(category)) return true;
      return !category; // legacy: show uncategorized cafe saves under drinks
    });
  }, [rows, cat, cafeCategoryById]);

  /** City counts scoped to the current type bucket. Aliases collapse via
   *  resolveCity, blank cities fall into the New York City bucket so the
   *  dropdown isn't littered with empties — same shape as Global. */
  const cityCounts = useMemo(() => {
    const m = new Map();
    filtered.forEach((r) => {
      const c = resolveCity(r.city || "") || "New York City";
      m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const cityFiltered = useMemo(() => (
    cityFilter.size === 0
      ? filtered
      : filtered.filter((r) => cityFilter.has(resolveCity(r.city || "") || "New York City"))
  ), [filtered, cityFilter]);

  const isGuest = !user?.id;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div ref={typeRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setOpenType((x) => !x)}
            style={{
              ...PILL_BASE_STYLE,
              border: "1px solid " + (openType ? "#F0997B" : "rgba(255,255,255,0.1)"),
              background: openType ? "#3C1F13" : "transparent",
              color: openType ? "#F0997B" : "#888780",
            }}
          >
            {typeLabelText} <span style={{ fontSize: 9, opacity: 0.8 }}>▼</span>
          </button>
          {openType && (
            <div style={DROPDOWN_STYLE}>
              {[
                ["restaurants", t.restaurants],
                ["drinks", t.drinks],
                ["sweets", t.sweets],
              ].map(([key, label]) => {
                const on = key === cat;
                return (
                  <div
                    key={key}
                    onClick={() => { setCat(key); setOpenType(false); }}
                    style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: 12,
                      color: on ? "#F0997B" : "#F1EFE8",
                      background: on ? "rgba(240,153,123,0.08)" : "transparent",
                      borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cityCounts.length > 1 && (
          <div ref={cityRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setOpenCity((x) => !x)}
              style={{
                ...PILL_BASE_STYLE,
                border: "1px solid " + (openCity || cityFilter.size > 0 ? "#F0997B" : "rgba(255,255,255,0.1)"),
                background: openCity || cityFilter.size > 0 ? "#3C1F13" : "transparent",
                color: openCity || cityFilter.size > 0 ? "#F0997B" : "#888780",
              }}
            >
              {cityLabelText} <span style={{ fontSize: 9, opacity: 0.8 }}>▼</span>
            </button>
            {openCity && (
              <div style={{ ...DROPDOWN_STYLE, minWidth: 200 }}>
                <div style={{
                  padding: "6px 10px",
                  borderBottom: "0.5px solid rgba(255,255,255,0.1)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 11, color: "#888780" }}>{t.cityLabel || "City"}</span>
                  {cityFilter.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setCityFilter(new Set())}
                      style={{ fontSize: 11, color: "#F0997B", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      {t.clear || "Clear"}
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto" }}>
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
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 10px",
                          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                          background: on ? "rgba(255,255,255,0.03)" : "transparent",
                        }}
                      >
                        <div style={{
                          width: 13, height: 13, borderRadius: 3,
                          border: "1.5px solid " + (on ? "#F0997B" : "rgba(255,255,255,0.2)"),
                          background: on ? "#F0997B" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {on && <span style={{ color: "#141413", fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ flex: 1, fontSize: 12, color: on ? "#F0997B" : "#F1EFE8", fontWeight: on ? 500 : 400 }}>
                          {city}
                        </span>
                        <span style={{ fontSize: 11, color: "#888780" }}>{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isGuest ? (
        <div style={{ color: "#888780", fontSize: 12, padding: "24px 8px", textAlign: "center" }}>
          {t.signInToSeeTopPicks || "Sign in to see your saved places."}
        </div>
      ) : loading && cityFiltered.length === 0 ? (
        <div style={{ color: "#888780", fontSize: 12, padding: "24px 8px", textAlign: "center" }}>
          {t.topPicksEmptyLoading || "Loading…"}
        </div>
      ) : cityFiltered.length === 0 ? (
        <div style={{ color: "#888780", fontSize: 12, padding: "24px 8px", textAlign: "center" }}>
          {t.wantToGoEmptyAll || "Nothing saved yet — tap '+ Want to go' on any place to save it."}
        </div>
      ) : (
        cityFiltered.map((r, i) => {
          const isRest = r.kind === "rest";
          const category = r.category || (isRest ? null : (cafeCategoryById.get(r.place_id) || ""));
          const place = isRest
            ? {
                placeId: r.place_id,
                name: r.name || "Unknown",
                cuisine: r.cuisine || "",
                city: r.city || "",
              }
            : {
                placeId: r.place_id,
                name: r.name || "Unknown",
                category, // may be "" — keys presence still flips cafe branch in the row
                city: r.city || "",
              };
          const display = {
            val: relativeShort(r.created_at),
            color: "#888780",
            label: t.wantToGoSavedLabel || "Saved",
          };
          return (
            <PlaceLeaderboardRow
              key={`${r.place_id}-${r.kind}`}
              place={place}
              display={display}
              rank={i + 1}
              placeKind={isRest ? "rest" : "cafe"}
              restaurantWeights={restaurantWeights}
              drinkWeights={drinkWeights}
              sweetWeights={sweetWeights}
            />
          );
        })
      )}
    </div>
  );
}

