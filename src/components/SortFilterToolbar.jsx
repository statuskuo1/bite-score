import { useEffect, useRef, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { S } from "../styles/sharedStyles.js";

/**
 * Unified sort/filter toolbar shared across My Log (restaurants/drinks/sweets)
 * and the Community Global tab.
 *
 * Layout (left → right):
 *   View pill ▼  ·  City pill ▼ (optional)  ·  search  ·  filter (optional)  ·  ↕ sort dir
 *
 * The four dropdowns (view, city, search, filter) are owned here together with
 * a single outside-click handler; callers don't need to pass refs or manage
 * open/close state.
 *
 * Filter content varies per surface (tier rows on restaurants/sweets/Global,
 * milk + bean on drinks), so callers supply `filterContent` as a node — the
 * popover chrome (header w/ optional Clear) is rendered here, the body comes
 * from the caller. Pass `filterActive` so the icon styling reflects whether
 * any filter is set even when the popover is closed.
 *
 * Pill / dropdown chrome matches the existing tier-filter dropdown so the new
 * toolbar reads the same as the rest of the UI: bg #1E1E1C, 0.5px white-15
 * border, radius 10, soft shadow.
 */
export function SortFilterToolbar({
  viewBy,
  onViewBy,
  viewOptions,
  cityCounts,
  selectedCities,
  onCitiesChange,
  search,
  onSearch,
  searchPlaceholder,
  filterContent,
  filterActive,
  sortAsc,
  onToggleSortAsc,
}) {
  const { t } = useLang();
  const [openView, setOpenView] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openFilter, setOpenFilter] = useState(false);

  const viewRef = useRef(null);
  const cityRef = useRef(null);
  const searchRef = useRef(null);
  const filterRef = useRef(null);

  useEffect(() => {
    function h(e) {
      if (viewRef.current && !viewRef.current.contains(e.target)) setOpenView(false);
      if (cityRef.current && !cityRef.current.contains(e.target)) setOpenCity(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpenSearch(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setOpenFilter(false);
    }
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, []);

  const showCityPill = Array.isArray(cityCounts) && cityCounts.length > 1;

  const viewLabelText = (() => {
    const found = viewOptions.find(([k]) => k === viewBy);
    return `${t.viewLabel || "View"}: ${found ? found[1] : viewBy}`;
  })();

  const cityLabelText = (() => {
    const head = `${t.cityLabel || "City"}:`;
    if (!selectedCities || selectedCities.size === 0) return `${head} ${t.cityAll || "All"}`;
    const list = [...selectedCities];
    if (list.length === 1) return `${head} ${list[0]}`;
    return `${head} ${list[0]} +${list.length - 1}`;
  })();

  function toggleCity(city) {
    const next = new Set(selectedCities || []);
    if (next.has(city)) next.delete(city);
    else next.add(city);
    onCitiesChange(next);
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 6, flexWrap: "wrap" }}>
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap",
        minWidth: 0,
      }}>
        <div ref={viewRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setOpenView((x) => !x)}
            style={pillStyle(openView)}
          >
            {viewLabelText} <span style={{ fontSize: 9, opacity: 0.8 }}>▼</span>
          </button>
          {openView && (
            <div style={dropdownStyle("left")}>
              {viewOptions.map(([key, label]) => {
                const on = key === viewBy;
                return (
                  <div
                    key={key}
                    onClick={() => { onViewBy(key); setOpenView(false); }}
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

        {showCityPill && (
          <div ref={cityRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setOpenCity((x) => !x)}
              style={pillStyle(openCity || (selectedCities && selectedCities.size > 0))}
            >
              {cityLabelText} <span style={{ fontSize: 9, opacity: 0.8 }}>▼</span>
            </button>
            {openCity && (
              <div style={{ ...dropdownStyle("left"), minWidth: 200 }}>
                <div style={{
                  padding: "6px 10px",
                  borderBottom: "0.5px solid rgba(255,255,255,0.1)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={S.sm}>{t.cityLabel || "City"}</span>
                  {selectedCities && selectedCities.size > 0 && (
                    <button
                      type="button"
                      onClick={() => onCitiesChange(new Set())}
                      style={{ fontSize: 11, color: "#F0997B", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      {t.clear}
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto" }}>
                  {cityCounts.map(([city, cnt]) => {
                    const on = selectedCities && selectedCities.has(city);
                    return (
                      <div
                        key={city}
                        onClick={() => toggleCity(city)}
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
                        <span style={S.sm}>{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <div ref={searchRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setOpenSearch((x) => !x)}
            style={iconBtnStyle(openSearch || !!search)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          {openSearch && (
            <div style={{ ...dropdownStyle("right"), padding: "8px 10px", width: 200 }}>
              <input
                autoFocus
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); setOpenSearch(false); } }}
                placeholder={searchPlaceholder || t.searchPlaceholder}
                style={{ width: "100%", boxSizing: "border-box", fontSize: 12 }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearch("")}
                  style={{ fontSize: 11, color: "#888780", background: "none", border: "none", cursor: "pointer", padding: "4px 0 0", display: "block" }}
                >
                  {t.clear}
                </button>
              )}
            </div>
          )}
        </div>

        {filterContent != null && (
          <div ref={filterRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setOpenFilter((x) => !x)}
              style={iconBtnStyle(openFilter || !!filterActive)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 2h12l-4.5 5.5V12L5.5 10.5V7.5L1 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
            {openFilter && (
              <div style={{ ...dropdownStyle("right"), minWidth: 180, overflow: "hidden" }}>
                {filterContent}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleSortAsc}
          style={{
            ...iconBtnStyle(true),
            fontSize: 16,
          }}
        >
          {sortAsc ? "↑" : "↓"}
        </button>
      </div>
    </div>
  );
}

function pillStyle(active) {
  return {
    padding: "5px 12px",
    borderRadius: 16,
    fontSize: 12,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
    border: "1px solid " + (active ? "#F0997B" : "rgba(255,255,255,0.1)"),
    background: active ? "#3C1F13" : "transparent",
    color: active ? "#F0997B" : "#888780",
  };
}

function iconBtnStyle(active) {
  return {
    width: 34, height: 34, borderRadius: 8,
    border: "1.5px solid " + (active ? "#F0997B" : "rgba(255,255,255,0.1)"),
    background: active ? "#3C1F13" : "transparent",
    color: active ? "#F0997B" : "#888780",
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  };
}

function dropdownStyle(anchor) {
  return {
    position: "absolute",
    [anchor === "left" ? "left" : "right"]: 0,
    top: "calc(100% + 6px)",
    background: "#1E1E1C",
    border: "0.5px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
    zIndex: 50,
    minWidth: 180,
    overflow: "hidden",
  };
}
