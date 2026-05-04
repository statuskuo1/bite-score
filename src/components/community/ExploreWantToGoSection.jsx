import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

const CATS = [
  { key: "restaurants", labelKey: "restaurants", icon: "🍽" },
  { key: "drinks", labelKey: "drinks", icon: "☕" },
  { key: "sweets", labelKey: "sweets", icon: "🥐" },
];

const DRINK_CATS = new Set(["Coffee", "Tea", "Other"]);

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

  const isGuest = !user?.id;

  return (
    <div>
      <CategoryStrip cat={cat} setCat={setCat} t={t} />

      {isGuest ? (
        <div style={{ color: "#888780", fontSize: 12, padding: "24px 8px", textAlign: "center" }}>
          {t.signInToSeeTopPicks || "Sign in to see your saved places."}
        </div>
      ) : loading && filtered.length === 0 ? (
        <div style={{ color: "#888780", fontSize: 12, padding: "24px 8px", textAlign: "center" }}>
          {t.topPicksEmptyLoading || "Loading…"}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "#888780", fontSize: 12, padding: "24px 8px", textAlign: "center" }}>
          {t.wantToGoEmptyAll || "Nothing saved yet — tap '+ Want to go' on any place to save it."}
        </div>
      ) : (
        filtered.map((r, i) => {
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
