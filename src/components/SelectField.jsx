import { useEffect, useRef, useState } from "react";

/**
 * Custom single-select dropdown that visually matches FlavorDropdown:
 *   - placeholder text: #666663, 13px (muted grey, same as Flavor Notes)
 *   - selected text: #F1EFE8, 13px
 *   - dark background, 0.5px border, animated ▼ chevron
 *
 * Accepts options as string[] or {value, label}[].
 * Uses a <button> trigger (not <select>) to avoid the global
 * input/select CSS overrides (font-size:16px!important, color:…!important).
 */
export function SelectField({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const opts = options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  const selected = opts.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 12px",
          background: "#1E1E1C",
          border: "0.5px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          borderBottomLeftRadius: open ? 0 : 8,
          borderBottomRightRadius: open ? 0 : 8,
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, color: selected ? "#F1EFE8" : "#666663" }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{
          fontSize: 10, color: "#888780", lineHeight: 1,
          display: "inline-block",
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.15s",
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60,
          background: "#1E1E1C",
          border: "0.5px solid rgba(255,255,255,0.12)",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          maxHeight: 200, overflowY: "auto",
        }}>
          {opts.map(o => (
            <div
              key={o.value}
              onMouseDown={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: "9px 12px", fontSize: 13,
                color: o.value === value ? "#F0997B" : "#F1EFE8",
                background: o.value === value ? "rgba(240,153,123,0.06)" : "transparent",
                cursor: "pointer",
                borderBottom: "0.5px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#2C2C2A"; }}
              onMouseLeave={e => { e.currentTarget.style.background = o.value === value ? "rgba(240,153,123,0.06)" : "transparent"; }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
