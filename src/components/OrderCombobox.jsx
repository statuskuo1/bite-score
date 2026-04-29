import { useEffect, useRef, useState } from "react";

/**
 * Single combobox for the cafe order field. Replaces the old OrderPills +
 * OrderAutocomplete split. Suggestions are sourced (in priority order) from:
 *   1. pastOrdersAtCafe   - this user's past orders at the picked cafe
 *   2. popularAtCafe      - >=2 distinct users' popular orders at this cafe
 *   3. presets            - curated category presets (CAFE_ORDERS[category])
 *   4. pastOrdersForCategory - this user's other past orders for this category
 * Deduplicated by lower(trim). Free typing is always accepted.
 */
export function OrderCombobox({
  value,
  onChange,
  pastOrdersAtCafe = [],
  popularAtCafe = [],
  presets = [],
  pastOrdersForCategory = [],
  placeholder,
}) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setShow(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const buildSuggestions = (query) => {
    const seen = new Set();
    const out = [];
    const add = (item) => {
      if (typeof item !== "string") return;
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    };
    pastOrdersAtCafe.forEach(add);
    popularAtCafe.forEach(add);
    presets.forEach(add);
    pastOrdersForCategory.forEach(add);
    const q = (query || "").trim().toLowerCase();
    if (!q) return out.slice(0, 12);
    return out
      .filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q)
      .slice(0, 12);
  };

  const suggestions = buildSuggestions(value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        placeholder={placeholder}
        style={{
          width:"100%", boxSizing:"border-box",
          background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.12)",
          borderRadius:8, padding:"9px 12px",
          fontSize:13, color:"#F1EFE8", outline:"none",
        }}
      />
      {show && suggestions.length > 0 && (
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
            maxHeight: 200,
            overflowY: "auto",
            marginTop: 4,
          }}
        >
          {suggestions.map((o) => (
            <div
              key={o}
              onMouseDown={() => { onChange(o); setShow(false); }}
              style={{ padding: "8px 12px", fontSize: 13, color: "#F1EFE8", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2C2C2A")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
