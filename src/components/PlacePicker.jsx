import { useEffect, useRef, useState } from "react";
import { S } from "../styles/sharedStyles.js";

/**
 * Shared-catalog name picker for restaurants/cafés. Replaces free-text input:
 * suggestions come from the cross-user `*_places` table, and city is shown
 * inline so users disambiguate by location instead of stuffing it in the name
 * (e.g. "Raku - SoHo"). Picking a row sets `placeId` on the form so save
 * attaches the visit to the canonical row instead of `ilike`-creating a near-dup.
 *
 * Editing the input after a pick clears `selectedPlaceId` — otherwise we'd
 * risk saving a different name against the wrong place row.
 */
export function PlacePicker({ value, selectedPlaceId, places, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);

  const q = value.trim().toLowerCase();
  const all = Array.isArray(places) ? places : [];

  /** Dedupe by id (defensive — caller may merge multiple sources later). */
  const byId = new Map();
  for (const p of all) {
    if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
  }
  const dedup = [...byId.values()];

  const filtered = q.length > 0
    ? dedup
        .filter((p) => p.name && p.name.toLowerCase().includes(q))
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 30)
    : [];

  const exactMatch = q.length > 0 && filtered.some((p) => p.name.toLowerCase() === q);
  const showAddNew = q.length > 0 && !exactMatch;

  useEffect(() => {
    function h(e) {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleType(next) {
    /** Clear pinned placeId whenever the typed text drifts from the picked name. */
    const stillMatches = selectedPlaceId
      && dedup.some((p) => p.id === selectedPlaceId && p.name === next);
    onChange({
      name: next,
      placeId: stillMatches ? selectedPlaceId : null,
      city: null,
    });
    setShow(true);
  }

  function pick(place) {
    onChange({ name: place.name, placeId: place.id, city: place.city || "" });
    setShow(false);
  }

  function addNew() {
    onChange({ name: value.trim(), placeId: null, city: null });
    setShow(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => handleType(e.target.value)}
        onFocus={() => setShow(true)}
        placeholder={placeholder || "e.g. Birch Coffee"}
        style={S.wb}
      />
      {show && (filtered.length > 0 || showAddNew) && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#1E1E1C",
            border: "0.5px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            zIndex: 100,
            maxHeight: 220,
            overflowY: "auto",
            marginTop: 4,
          }}
        >
          {filtered.map((p) => {
            const isPicked = selectedPlaceId === p.id;
            return (
              <div
                key={p.id}
                onMouseDown={() => pick(p)}
                style={{
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#F1EFE8",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  background: isPicked ? "#2C2C2A" : "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2C2C2A")}
                onMouseLeave={(e) => (e.currentTarget.style.background = isPicked ? "#2C2C2A" : "transparent")}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                {p.city && (
                  <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>
                    📍 {p.city}
                  </span>
                )}
              </div>
            );
          })}
          {showAddNew && (
            <div
              onMouseDown={addNew}
              style={{
                padding: "8px 12px",
                fontSize: 13,
                color: "#F0997B",
                cursor: "pointer",
                borderTop: filtered.length > 0 ? "0.5px solid rgba(255,255,255,0.08)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2C2C2A")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              + Add new: "{value.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
