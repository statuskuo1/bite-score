import { useEffect, useRef, useState } from "react";
import { searchUsersByUsername } from "../utils/followsApi.js";
import { supabase } from "../config/supabaseClient.js";
import { Avatar } from "./community/Avatar.jsx";

/**
 * Multi-user picker for "Dine with" tagging.
 * Shows a search input, dropdown results, and selected user pills.
 *
 * Props:
 *   userId       - caller's own user id (excluded from search results)
 *   tasteBudIds  - Set<string> of mutual-follow ids (shown with ⭐ hint)
 *   selected     - Array<{id, username, display_name, avatar_url}>
 *   onChange     - (newSelected) => void
 */
export function DineWithPicker({ userId, tasteBudIds = new Set(), selected = [], onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function h(e) {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setShow(false); return; }
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const hits = await searchUsersByUsername(supabase, query, userId, 6);
        const selectedIds = new Set(selected.map((s) => s.id));
        setResults(hits.filter((h) => !selectedIds.has(h.id)));
        setShow(true);
      } finally {
        setBusy(false);
      }
    }, 250);
  }, [query, userId, selected]);

  function addUser(profile) {
    onChange([...selected, profile]);
    setQuery("");
    setResults([]);
    setShow(false);
  }

  function removeUser(id) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Search input */}
      <div style={{ position: "relative" }}>
        <style>{`
          .bite-dine-input { font-size: 13px !important; color: #F1EFE8 !important; }
        `}</style>
        <input
          className="bite-dine-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setShow(true); }}
          placeholder="Search by username…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.12)",
            borderRadius: 8, padding: "9px 12px", outline: "none",
          }}
        />
        {busy && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#888780" }}>…</span>
        )}
      </div>

      {/* Dropdown results */}
      {show && results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.15)",
          borderRadius: 8, zIndex: 100, marginTop: 4, overflow: "hidden",
        }}>
          {results.map((p) => (
            <div
              key={p.id}
              onMouseDown={() => addUser(p)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", cursor: "pointer",
                borderBottom: "0.5px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2C2C2A")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar profile={p} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#F1EFE8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.display_name || p.username}
                  {tasteBudIds.has(p.id) && (
                    <span style={{ fontSize: 11, color: "#F0997B", marginLeft: 6, fontWeight: 500 }}>Taste Bud ★</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#888780" }}>@{p.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {show && !busy && query.trim() && results.length === 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.15)",
          borderRadius: 8, zIndex: 100, marginTop: 4,
          padding: "10px 12px", fontSize: 13, color: "#888780",
        }}>
          No users found
        </div>
      )}

      {/* Selected pills — below the input so the box never shifts */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {selected.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#2C2C2A", border: "0.5px solid rgba(255,255,255,0.15)",
                borderRadius: 20, padding: "4px 10px 4px 6px",
              }}
            >
              <Avatar profile={p} size={18} />
              <span style={{ fontSize: 12, color: "#F1EFE8" }}>
                {p.display_name || p.username}
                {tasteBudIds.has(p.id) && <span style={{ color: "#F0997B", marginLeft: 4 }}>★</span>}
              </span>
              <button
                type="button"
                onClick={() => removeUser(p.id)}
                style={{ background: "none", border: "none", color: "#888780", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0, marginLeft: 2 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
