import { useState, useEffect, useMemo } from "react";
import { resolveCity } from "./CityInput.jsx";
import { useLang } from "../contexts/LangContext.jsx";
import { supabase } from "../config/supabaseClient.js";
import { fetchAggregatedRestaurantPlaces, fetchAggregatedCafePlaces } from "../utils/visitPlacesApi.js";
import { calcBiteOutOf10, calcCafeOutOf10, scoreColor, scoreLabel, tasteColor, tasteLabel } from "../utils/scoring.js";
import { RestRow } from "./RestRow.jsx";
import { CafeGroupRow } from "./CafeGroupRow.jsx";
import { SortFilterToolbar } from "./SortFilterToolbar.jsx";
import { ShowMoreButton } from "./ShowMoreButton.jsx";
import { usePaginatedList } from "./usePaginatedList.js";
import { rating010FilterRows } from "../constants/ratingTiers0to10.js";
import { S } from "../styles/sharedStyles.js";

function roundedRepeat(avg) {
  if (avg == null || !Number.isFinite(avg)) return 0;
  return Math.max(0, Math.min(3, Math.round(avg)));
}

function placeToRestEntry(place) {
  return {
    id: `g_${place.placeId}`,
    placeId: place.placeId,
    name: place.name,
    cuisine: place.cuisine || "",
    cuisine2: place.cuisine2 || "",
    isFusion: place.isFusion || false,
    city: place.city || "",
    letter: (place.cuisine?.[0] || "").toUpperCase(),
    taste: place.avgTaste ?? 0,
    cost: place.avgCost ?? 0,
    portions: place.avgPortions ?? 1,
    wait: place.avgWait ?? 0,
    repeatability: roundedRepeat(place.avgRepeat),
    useR: place.useRMajority ?? true,
    notes: "",
  };
}

function placeToCafeEntry(place) {
  return {
    id: `g_cafe_${place.placeId}_${place.category || ""}`,
    placeId: place.placeId,
    name: place.name,
    city: place.city || "",
    category: place.category || "Coffee",
    order: "",
    taste: place.avgTaste ?? 0,
    cost: place.avgCost ?? 0,
    portions: place.avgPortions ?? 1,
    wait: place.avgWait ?? 0,
    repeatability: roundedRepeat(place.avgRepeat),
    useR: place.useRMajority ?? true,
    notes: "",
  };
}

export function GuestLogView({ weights, drinkWeights, sweetWeights, onSignIn }) {
  const { t } = useLang();
  const [logTab, setLogTab] = useState("restaurants");
  const [restaurants, setRestaurants] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sweets, setSweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [sortBy, setSortBy] = useState("bite");
  const [sortAsc, setSortAsc] = useState(false);
  const [tiers, setTiers] = useState(new Set());
  const [cityFilter, setCityFilter] = useState(new Set());
  const [search, setSearch] = useState("");

  const [cafeSortBy, setCafeSortBy] = useState("bite");
  const [cafeSortAsc, setCafeSortAsc] = useState(false);
  const [cafeCityFilter, setCafeCityFilter] = useState(new Set());
  const [cafeSearch, setCafeSearch] = useState("");

  const [sweetsSortBy, setSweetsSortBy] = useState("bite");
  const [sweetsSortAsc, setSweetsSortAsc] = useState(false);
  const [sweetsCityFilter, setSweetsCityFilter] = useState(new Set());
  const [sweetsSearch, setSweetsSearch] = useState("");
  const [sweetsTiers, setSweetsTiers] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    Promise.all([
      fetchAggregatedRestaurantPlaces(supabase, { minVisits: 1 }),
      fetchAggregatedCafePlaces(supabase, { minVisits: 1, categoryFilter: "drinks" }),
      fetchAggregatedCafePlaces(supabase, { minVisits: 1, categoryFilter: "sweets" }),
    ]).then(([r, d, s]) => {
      if (cancelled) return;
      setRestaurants(r.map(placeToRestEntry));
      setDrinks(d.map(placeToCafeEntry));
      setSweets(s.map(placeToCafeEntry));
    }).catch(() => {
      if (!cancelled) setFailed(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const tierFilterRows = rating010FilterRows(t);

  const restaurantCityCounts = useMemo(() => {
    const m = new Map();
    restaurants.forEach(e => { const c = resolveCity(e.city || "") || "New York City"; m.set(c, (m.get(c) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [restaurants]);

  const drinkCityCounts = useMemo(() => {
    const m = new Map();
    drinks.forEach(e => { const c = resolveCity(e.city || "") || "New York City"; m.set(c, (m.get(c) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [drinks]);

  const sweetCityCounts = useMemo(() => {
    const m = new Map();
    sweets.forEach(e => { const c = resolveCity(e.city || "") || "New York City"; m.set(c, (m.get(c) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sweets]);

  function getRestDisplay(e) {
    if (sortBy === "taste") return { val: e.taste.toFixed(1), label: tasteLabel(e.taste, t), color: tasteColor(e.taste) };
    if (sortBy === "bpb") return { val: "$" + (e.cost / e.portions).toFixed(2), label: t.perPortion, color: "#5B9BD5" };
    if (sortBy === "wait") return { val: e.wait + " min", label: t.waitLabel, color: "#888780" };
    if (sortBy === "repeat") {
      const r = e.useR ? ("⭐".repeat(e.repeatability) || "✕") : t.off;
      const lbl = e.useR ? (e.repeatability === 3 ? t.mustReturnLabel : e.repeatability === 2 ? t.wouldSeekOutLabel : e.repeatability === 1 ? t.ifOccasionCallsLabel : t.wouldntReturnLabel) : "off";
      return { val: r, label: lbl, color: "#EF9F27" };
    }
    const sc = calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, weights);
    return { val: sc != null ? sc.toFixed(2) : "—", label: scoreLabel(sc, t), color: scoreColor(sc) };
  }

  const sortedR = useMemo(() => {
    return [...restaurants].sort((a, b) => {
      let d = 0;
      if (sortBy === "bite") d = (calcBiteOutOf10(a.taste, a.cost, a.portions, a.wait, a.useR, a.repeatability, weights) ?? 0) - (calcBiteOutOf10(b.taste, b.cost, b.portions, b.wait, b.useR, b.repeatability, weights) ?? 0);
      else if (sortBy === "taste") d = a.taste - b.taste;
      else if (sortBy === "bpb") d = (b.cost / b.portions) - (a.cost / a.portions);
      else if (sortBy === "wait") d = b.wait - a.wait;
      else if (sortBy === "repeat") d = a.repeatability - b.repeatability;
      return sortAsc ? d : -d;
    }).filter(e => {
      const sc = calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, weights);
      if (tiers.size > 0 && !tiers.has(scoreLabel(sc, t))) return false;
      if (cityFilter.size > 0 && !cityFilter.has(resolveCity(e.city || "") || "New York City")) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return e.name.toLowerCase().includes(q) || e.cuisine.toLowerCase().includes(q) || (resolveCity(e.city || "") || "New York City").toLowerCase().includes(q);
      }
      return true;
    });
  }, [restaurants, sortBy, sortAsc, tiers, cityFilter, search, weights, t]);

  const sortedDrinks = useMemo(() => {
    return [...drinks].sort((a, b) => {
      let d = 0;
      if (cafeSortBy === "bite") d = (calcCafeOutOf10(a.taste, a.cost, a.portions, a.wait, a.useR, a.repeatability, drinkWeights) ?? 0) - (calcCafeOutOf10(b.taste, b.cost, b.portions, b.wait, b.useR, b.repeatability, drinkWeights) ?? 0);
      else if (cafeSortBy === "taste") d = a.taste - b.taste;
      else if (cafeSortBy === "bpb") d = (b.cost / b.portions) - (a.cost / a.portions);
      else if (cafeSortBy === "wait") d = b.wait - a.wait;
      else if (cafeSortBy === "repeat") d = a.repeatability - b.repeatability;
      return cafeSortAsc ? d : -d;
    }).filter(e => {
      if (cafeCityFilter.size > 0 && !cafeCityFilter.has(resolveCity(e.city || "") || "New York City")) return false;
      if (cafeSearch.trim()) {
        const q = cafeSearch.trim().toLowerCase();
        return e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || (resolveCity(e.city || "") || "New York City").toLowerCase().includes(q);
      }
      return true;
    });
  }, [drinks, cafeSortBy, cafeSortAsc, cafeCityFilter, cafeSearch, drinkWeights]);

  const sortedSweets = useMemo(() => {
    return [...sweets].sort((a, b) => {
      let d = 0;
      if (sweetsSortBy === "bite") d = (calcCafeOutOf10(a.taste, a.cost, a.portions, a.wait, a.useR, a.repeatability, sweetWeights) ?? 0) - (calcCafeOutOf10(b.taste, b.cost, b.portions, b.wait, b.useR, b.repeatability, sweetWeights) ?? 0);
      else if (sweetsSortBy === "taste") d = a.taste - b.taste;
      else if (sweetsSortBy === "bpb") d = (b.cost / b.portions) - (a.cost / a.portions);
      else if (sweetsSortBy === "wait") d = b.wait - a.wait;
      else if (sweetsSortBy === "repeat") d = a.repeatability - b.repeatability;
      return sweetsSortAsc ? d : -d;
    }).filter(e => {
      const sc = calcCafeOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, sweetWeights);
      if (sweetsTiers.size > 0 && !sweetsTiers.has(scoreLabel(sc, t))) return false;
      if (sweetsCityFilter.size > 0 && !sweetsCityFilter.has(resolveCity(e.city || "") || "New York City")) return false;
      if (sweetsSearch.trim()) {
        const q = sweetsSearch.trim().toLowerCase();
        return e.name.toLowerCase().includes(q) || (resolveCity(e.city || "") || "New York City").toLowerCase().includes(q);
      }
      return true;
    });
  }, [sweets, sweetsSortBy, sweetsSortAsc, sweetsTiers, sweetsCityFilter, sweetsSearch, sweetWeights, t]);

  const restaurantPage = usePaginatedList(sortedR, `${sortBy}|${sortAsc}|${[...cityFilter].sort().join(",")}|${search}|${[...tiers].join(",")}|${logTab}`);
  const drinksPage = usePaginatedList(sortedDrinks, `${cafeSortBy}|${cafeSortAsc}|${[...cafeCityFilter].sort().join(",")}|${cafeSearch}|${logTab}`);
  const sweetsPage = usePaginatedList(sortedSweets, `${sweetsSortBy}|${sweetsSortAsc}|${[...sweetsCityFilter].sort().join(",")}|${sweetsSearch}|${logTab}`);

  const banner = (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 12, fontSize: 11, color: "#888780", flexWrap: "wrap" }}>
      <span>Browsing the community log —</span>
      <button type="button" onClick={onSignIn} style={{ background: "none", border: "none", padding: 0, color: "#F0997B", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>
        sign in
      </button>
      <span>to start your own</span>
    </div>
  );

  if (loading) {
    return (
      <div>
        {banner}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ background: "#1E1E1C", borderRadius: 10, height: 62, opacity: 0.4 + i * 0.08, animation: "pulse 1.2s ease-in-out infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  if (failed || (!restaurants.length && !drinks.length && !sweets.length)) {
    return (
      <div>
        {banner}
        <p style={{ color: "#888780", fontSize: 14, textAlign: "center", padding: "32px 0" }}>
          Sign in to start building your personal food log.
        </p>
      </div>
    );
  }

  return (
    <div>
      {banner}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", background: "#252523", borderRadius: 10, padding: 3, gap: 2, marginBottom: 8 }}>
          {[["restaurants", "🍽 " + t.restaurants], ["drinks", "☕ " + t.drinks], ["sweets", "🥐 " + t.sweets]].map(([v, l]) => (
            <button key={v} onClick={() => setLogTab(v)} style={{ flex: 1, padding: "6px 0", textAlign: "center", borderRadius: 8, border: "none", background: logTab === v ? "#3C1F13" : "transparent", color: logTab === v ? "#F0997B" : "#888780", fontSize: 11, fontWeight: logTab === v ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 12 }} />

      {logTab === "restaurants" && (
        <div>
          <SortFilterToolbar
            viewBy={sortBy}
            onViewBy={setSortBy}
            viewOptions={[["bite", "BITE"], ["taste", t.taste], ["bpb", t.bangBuck], ["wait", t.wait], ["repeat", t.repeatability]]}
            cityCounts={restaurantCityCounts}
            selectedCities={cityFilter}
            onCitiesChange={setCityFilter}
            search={search}
            onSearch={setSearch}
            filterContent={
              <>
                <div style={{ padding: "6px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={S.sm}>{t.filterByTier}</span>
                  {tiers.size > 0 && <button type="button" onClick={() => setTiers(new Set())} style={{ fontSize: 11, color: "#F0997B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{t.clear}</button>}
                </div>
                {tierFilterRows.map(([tier, col]) => {
                  const on = tiers.has(tier);
                  const cnt = sortedR.filter(e => scoreLabel(calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, weights), t) === tier).length;
                  return (
                    <div key={tier} onClick={() => setTiers(p => { const n = new Set(p); on ? n.delete(tier) : n.add(tier); return n; })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.1)", cursor: "pointer", background: on ? "rgba(255,255,255,0.03)" : "transparent" }}>
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
            onToggleSortAsc={() => setSortAsc(a => !a)}
          />
          {sortedR.length === 0 && <p style={{ color: "#888780", fontSize: 14 }}>{t.noEntries}</p>}
          {restaurantPage.visible.map(e => (
            <RestRow key={e.id} e={e} display={getRestDisplay(e)} user={null} visits={1} group={[e]} weights={weights} onEdit={() => {}} onDelete={() => {}} />
          ))}
          <ShowMoreButton remaining={restaurantPage.remaining} pageSize={restaurantPage.pageSize} onClick={restaurantPage.showMore} />
        </div>
      )}

      {logTab === "drinks" && (
        <div>
          <SortFilterToolbar
            viewBy={cafeSortBy}
            onViewBy={setCafeSortBy}
            viewOptions={[["bite", "BITE"], ["taste", t.taste], ["bpb", t.bangBuck], ["wait", t.wait], ["repeat", t.repeatability]]}
            cityCounts={drinkCityCounts}
            selectedCities={cafeCityFilter}
            onCitiesChange={setCafeCityFilter}
            search={cafeSearch}
            onSearch={setCafeSearch}
            filterContent={null}
            filterActive={false}
            sortAsc={cafeSortAsc}
            onToggleSortAsc={() => setCafeSortAsc(a => !a)}
          />
          {sortedDrinks.length === 0 && <p style={{ color: "#888780", fontSize: 14 }}>{t.noDrinks}</p>}
          {drinksPage.visible.map(e => (
            <CafeGroupRow key={e.id} group={[e]} cafeSortBy={cafeSortBy} weights={drinkWeights} user={null} onEdit={() => {}} onDelete={() => {}} />
          ))}
          <ShowMoreButton remaining={drinksPage.remaining} pageSize={drinksPage.pageSize} onClick={drinksPage.showMore} />
        </div>
      )}

      {logTab === "sweets" && (
        <div>
          <SortFilterToolbar
            viewBy={sweetsSortBy}
            onViewBy={setSweetsSortBy}
            viewOptions={[["bite", "BITE"], ["taste", t.taste], ["bpb", t.bangBuck], ["wait", t.wait], ["repeat", t.repeatability]]}
            cityCounts={sweetCityCounts}
            selectedCities={sweetsCityFilter}
            onCitiesChange={setSweetsCityFilter}
            search={sweetsSearch}
            onSearch={setSweetsSearch}
            filterContent={
              <>
                <div style={{ padding: "6px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={S.sm}>{t.filterByTier}</span>
                  {sweetsTiers.size > 0 && <button type="button" onClick={() => setSweetsTiers(new Set())} style={{ fontSize: 11, color: "#F0997B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{t.clear}</button>}
                </div>
                {tierFilterRows.map(([tier, col]) => {
                  const on = sweetsTiers.has(tier);
                  const cnt = sortedSweets.filter(e => scoreLabel(calcCafeOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, sweetWeights), t) === tier).length;
                  return (
                    <div key={tier} onClick={() => setSweetsTiers(p => { const n = new Set(p); on ? n.delete(tier) : n.add(tier); return n; })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.1)", cursor: "pointer", background: on ? "rgba(255,255,255,0.03)" : "transparent" }}>
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
            filterActive={sweetsTiers.size > 0}
            sortAsc={sweetsSortAsc}
            onToggleSortAsc={() => setSweetsSortAsc(a => !a)}
          />
          {sortedSweets.length === 0 && <p style={{ color: "#888780", fontSize: 14 }}>{t.noSweets}</p>}
          {sweetsPage.visible.map(e => (
            <CafeGroupRow key={e.id} group={[e]} cafeSortBy={sweetsSortBy} weights={sweetWeights} user={null} onEdit={() => {}} onDelete={() => {}} />
          ))}
          <ShowMoreButton remaining={sweetsPage.remaining} pageSize={sweetsPage.pageSize} onClick={sweetsPage.showMore} />
        </div>
      )}
    </div>
  );
}
