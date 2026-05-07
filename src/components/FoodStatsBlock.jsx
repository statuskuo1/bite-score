/**
 * Emoji-row food stats block shared by the own-profile modal (AuthModal) and
 * the friend MiniProfileSheet (FriendsTab). Pass a `stats` object with
 * { restaurants, cuisines, cities, regions } — null values render as "—".
 */
export function FoodStatsBlock({ stats, style }) {
  const s = stats || {};
  const rows = [
    { emoji: "🍽", label: "Restaurants rated", val: s.restaurants != null ? String(s.restaurants) : "—", color: "#F0997B" },
    { emoji: "🌍", label: "Cuisines tried",    val: s.cuisines   != null ? `${s.cuisines} / 135`   : "—", color: "#97C459" },
    { emoji: "📍", label: "Cities explored",   val: s.cities     != null ? String(s.cities)         : "—", color: "#5B9BD5" },
    { emoji: "🗺",  label: "Regions explored",  val: s.regions    != null ? `${s.regions} / 17`      : "—", color: "#EF9F27" },
  ];

  return (
    <div style={{
      background: "#141413", borderRadius: 10,
      padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 7,
      ...style,
    }}>
      {rows.map(({ emoji, label, val, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{emoji}</span>
          <span style={{ flex: 1, fontSize: 13, color: "#C4C2BA" }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color }}>{val}</span>
        </div>
      ))}
    </div>
  );
}
