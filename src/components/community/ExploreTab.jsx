import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLang } from "../../contexts/LangContext.jsx";
import { ExploreTopPicksSection } from "./ExploreTopPicksSection.jsx";
import { ExploreGlobalSection } from "./ExploreGlobalSection.jsx";

const SECTIONS = [
  { key: "top-picks", labelKey: "exploreSectionTopPicks", icon: "⭐" },
  { key: "global", labelKey: "exploreSectionGlobal", icon: "🌐" },
];

const DEFAULT_SECTION = "top-picks";

/**
 * Explore tab container.
 *
 * Discovery surface that aggregates community data — currently Taste Buds'
 * top picks plus the full Global leaderboard. Two sub-sections via a small
 * inline strip; URL drives state at `/community/explore/:section` so deep
 * links and back-button work.
 *
 * Reserved for future "Trending" sub-section once we have signal density.
 */
export function ExploreTab({ user, myEntries, restaurantWeights, drinkWeights, sweetWeights }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = pathname.split("/")[3] || DEFAULT_SECTION;

  // Normalize unknown sub-paths back to the default.
  useEffect(() => {
    const parts = pathname.split("/");
    if (parts[2] !== "explore") return;
    if (parts.length < 4 || parts[3] === "") return;
    if (!SECTIONS.find((s) => s.key === parts[3])) {
      navigate("/community/explore/" + DEFAULT_SECTION, { replace: true });
    }
  }, [pathname, navigate]);

  return (
    <div>
      <div style={{
        display: "flex", background: "#252523", borderRadius: 10, padding: 3,
        gap: 2, marginBottom: 20,
      }}>
        {SECTIONS.map((s) => {
          const on = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => navigate("/community/explore/" + s.key)}
              style={{
                flex: 1, padding: "6px 0", textAlign: "center", borderRadius: 8,
                border: "none",
                background: on ? "#3C1F13" : "transparent",
                color: on ? "#F0997B" : "#888780",
                fontSize: 11, fontWeight: on ? 700 : 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {s.icon} {t[s.labelKey] || s.key}
            </button>
          );
        })}
      </div>

      {section === "top-picks" && <ExploreTopPicksSection user={user} myEntries={myEntries} restaurantWeights={restaurantWeights} />}
      {section === "global" && (
        <ExploreGlobalSection
          user={user}
          restaurantWeights={restaurantWeights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
        />
      )}
    </div>
  );
}
