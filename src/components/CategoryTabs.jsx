import { useLang } from "../contexts/LangContext.jsx";

export function CategoryTabs({ active, onChange }) {
  const { t } = useLang();
  const tabs = [
    ["restaurants", "🍽 " + t.restaurants],
    ["drinks", "☕ " + t.drinks],
    ["sweets", "🥐 " + t.sweets],
  ];

  return (
    <div style={{ display: "flex", background: "#252523", borderRadius: 10, padding: 3, gap: 2 }}>
      {tabs.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            flex: 1,
            padding: "6px 0",
            textAlign: "center",
            borderRadius: 8,
            border: "none",
            background: active === v ? "#3C1F13" : "transparent",
            color: active === v ? "#F0997B" : "#888780",
            fontSize: 11,
            fontWeight: active === v ? 700 : 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
