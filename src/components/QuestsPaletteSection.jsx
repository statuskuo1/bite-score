import { useLang } from "../contexts/LangContext.jsx";
import { ALPHABET, CUISINE_REGIONS, FLAGS } from "../constants/cuisineConstants.js";
import { S } from "../styles/sharedStyles.js";
import { Tooltip } from "./Tooltip.jsx";

/**
 * A–Z and cuisine quest UI (inline under My Taste → Restaurants).
 * `questL` / `toggleQ` state live in App (localStorage + settings merge).
 */
export function QuestsPaletteSection({ entries, questL, toggleQ, onOpenSuggest }) {
  const { t } = useLang();
  const covered = new Set(entries.map((e) => (e.letter || e.cuisine?.[0])?.toUpperCase()));
  const loggedC = new Set(entries.map((e) => e.cuisine && e.cuisine.trim()));
  const totalCuisines = Object.values(CUISINE_REGIONS).flat().length;
  const doneCount = Object.values(CUISINE_REGIONS).flat().filter((x) => loggedC.has(x)).length;
  const totalForBar = totalCuisines > 0 ? totalCuisines : 1;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#F1EFE8" }}>{t.aZQuest}</span>
          <span style={{ fontSize: 18, fontWeight: 500, color: "#97C459" }}>
            {questL.size}
            <span style={{ fontSize: 13, fontWeight: 400, color: "#888780" }}> / 26</span>
          </span>
        </div>
        <p style={{ fontSize: 11, color: "#888780", margin: "0 0 10px" }}>{t.tapToToggle}</p>
        <div style={{ background: "#0D0D0C", borderRadius: 8, height: 6, marginBottom: 16, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${(questL.size / 26) * 100}%`,
              background: "#97C459",
              borderRadius: 8,
              transition: "width 0.4s",
            }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(36px,1fr))", gap: 6 }}>
          {ALPHABET.map((l) => {
            const isQ = questL.has(l),
              isL = covered.has(l);
            const entry = entries.find((e) => (e.letter || e.cuisine?.[0])?.toUpperCase() === l);
            return (
              <div
                key={l}
                title={entry ? entry.name : l}
                onClick={() => toggleQ(l)}
                style={{
                  height: 36,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: isL ? "pointer" : "default",
                  transition: "all 0.15s",
                  background: isQ ? "#1A2E0A" : isL ? "#3C1F13" : "#1E1E1C",
                  color: isQ ? "#97C459" : isL ? "#F0997B" : "#888780",
                  border:
                    "0.5px solid " + (isQ ? "#97C459" : isL ? "#D85A30" : "rgba(255,255,255,0.1)"),
                }}
              >
                {l}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          {[
            [t.questLegendQuest, "#97C459", "#1A2E0A"],
            [t.questLegendLogged, "#F0997B", "#3C1F13"],
            [t.questLegendNotYet, "#888780", "#1E1E1C"],
          ].map(([label, col, bg]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: "0.5px solid " + col }} />
              <span style={S.sm}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.1)", marginBottom: 32 }} />

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#F1EFE8" }}>{t.cuisineQuest}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 500, color: "#F0997B" }}>
              {doneCount}
              <span style={{ fontSize: 13, fontWeight: 400, color: "#888780" }}> / {totalCuisines}</span>
            </span>
            <button
              type="button"
              onClick={onOpenSuggest}
              style={{
                fontSize: 11,
                color: "#F0997B",
                background: "#3C1F13",
                border: "0.5px solid #F0997B",
                borderRadius: 20,
                padding: "4px 10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t.suggestRestaurant}
            </button>
          </div>
        </div>
        <div style={{ background: "#0D0D0C", borderRadius: 8, height: 6, marginBottom: 20, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${(doneCount / totalForBar) * 100}%`,
              background: "#F0997B",
              borderRadius: 8,
              transition: "width 0.4s",
            }}
          />
        </div>
        {Object.entries(CUISINE_REGIONS).map(([region, cuisines]) => {
          const rd = cuisines.filter((x) => loggedC.has(x)).length,
            pct = Math.round((rd / cuisines.length) * 100);
          return (
            <div key={region} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={S.val}>{region}</span>
                <span style={{ fontSize: 12, color: rd === cuisines.length ? "#97C459" : "#888780" }}>
                  {rd}/{cuisines.length}
                </span>
              </div>
              <div style={{ background: "#0D0D0C", borderRadius: 6, height: 5, marginBottom: 8, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: pct + "%",
                    background: rd === cuisines.length ? "#97C459" : "#F0997B",
                    borderRadius: 6,
                    transition: "width 0.4s",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {cuisines.map((x) => {
                  const done = loggedC.has(x);
                  const names = entries.filter((e) => e.cuisine && e.cuisine.trim() === x).map((e) => e.name).join("; ");
                  return (
                    <Tooltip key={x} content={done ? names : null}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 12,
                          background: done ? "#3C1F13" : "#1E1E1C",
                          color: done ? "#F0997B" : "#888780",
                          border: "0.5px solid " + (done ? "#F0997B" : "rgba(255,255,255,0.1)"),
                          fontWeight: done ? 500 : 400,
                        }}
                      >
                        {FLAGS[x] ? FLAGS[x] + " " : ""}
                        {x}
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
