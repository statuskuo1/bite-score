import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import {
  calcBiteOutOf10,
  meanRestaurantBiteOutOf10,
  scoreColor,
  scoreLabel,
} from "../../utils/scoring.js";
import { RestRow } from "../RestRow.jsx";
import { Avatar } from "./Avatar.jsx";

/**
 * Read-only restaurant log for another user. Reached from the View Log button
 * on the MiniProfileSheet.
 *
 * The list is grouped + sorted exactly like My Log (same BITE-descending
 * ordering, same per-name grouping) so viewers see the other person's library
 * through their own weights — i.e. "what would these places score for me?".
 *
 * Edit/delete is naturally disabled: `RestRow` consults `canSwipeGroup(grp,
 * user)` which only returns true when every visit in the group is owned by
 * the viewer. We still pass no-op handlers as belt-and-braces in case those
 * code paths ever fire.
 */
export function UserLogView({ user, targetProfile, restaurantWeights, onBack }) {
  const { t } = useLang();
  const [visits, setVisits] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!targetProfile?.id) { setVisits([]); setLoaded(true); return; }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, targetProfile.id);
      if (cancelled) return;
      setVisits(v);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [targetProfile?.id]);

  const weights = restaurantWeights;

  /** Group visits by restaurant name (mirrors My Log) and sort each group by
   *  average BITE descending so the best places land on top. */
  const groups = useMemo(() => {
    const byName = {};
    for (const e of visits) {
      const k = e.name;
      if (!byName[k]) byName[k] = [];
      byName[k].push(e);
    }
    return Object.values(byName)
      .map((grp) => {
        const head = grp[grp.length - 1];
        const biteVals = grp
          .map((e) => calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, weights))
          .filter((v) => v != null);
        const avgBite = biteVals.length ? biteVals.reduce((a, b) => a + b, 0) / biteVals.length : 0;
        return { grp, head, avgBite };
      })
      .sort((a, b) => b.avgBite - a.avgBite);
  }, [visits, weights]);

  const totalEntries = visits.length;
  const meanBite = useMemo(
    () => (visits.length ? meanRestaurantBiteOutOf10(visits, weights) : null),
    [visits, weights],
  );
  const name = targetProfile?.display_name || targetProfile?.username || "—";

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "none",
          color: "#888780", fontSize: 12, cursor: "pointer",
          padding: 0, marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>‹</span>
        {t.backToFriends || "Back to Friends"}
      </button>

      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 14,
      }}>
        <Avatar profile={targetProfile} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 600, color: "#F1EFE8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {name}
          </div>
          <div style={{
            fontSize: 11, color: "#888780", marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            @{targetProfile?.username || "—"} · {t.readOnlyLog || "Read-only log"}
          </div>
        </div>
      </div>

      <div style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 12 }} />

      {!loaded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                background: "#1E1E1C",
                borderRadius: 10,
                height: 62,
                opacity: 0.4 + i * 0.08,
                animation: "pulse 1.2s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {loaded && totalEntries === 0 && (
        <p style={{ fontSize: 13, color: "#888780" }}>
          {t.noEntriesYet || "No entries yet."}
        </p>
      )}

      {loaded && groups.map(({ grp, head, avgBite }) => {
        const sc = calcBiteOutOf10(head.taste, head.cost, head.portions, head.wait, head.useR, head.repeatability, weights);
        const display = {
          val: sc != null ? sc.toFixed(2) : "—",
          label: scoreLabel(sc, t),
          color: scoreColor(sc),
        };
        return (
          <RestRow
            key={head.id}
            e={head}
            display={display}
            user={user}
            visits={grp.length}
            group={grp}
            weights={weights}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        );
      })}

      {loaded && totalEntries > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 16 }}>
          <div style={{
            background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 11, color: "#888780" }}>{t.entries || "Entries"}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: "#F1EFE8" }}>{totalEntries}</div>
          </div>
          <div style={{
            background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 11, color: "#888780" }}>{t.avgBite || "Avg BITE"}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: "#F1EFE8" }}>
              {meanBite != null ? `${meanBite.toFixed(2)}/10` : "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
