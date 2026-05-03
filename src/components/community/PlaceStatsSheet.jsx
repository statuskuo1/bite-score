import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../config/supabaseClient.js";
import { calcBiteOutOf10, calcCafeOutOf10, scoreColor, scoreLabel } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Avatar } from "./Avatar.jsx";
import { useLang } from "../../contexts/LangContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { listTasteBuds } from "../../utils/followsApi.js";
import { addWantToGo } from "../../utils/wantToGoApi.js";

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","it","its","is","was","were","are","be","been","being",
  "have","has","had","do","does","did","so","if","to","of","in","on","at","for","with",
  "from","by","as","i","we","they","he","she","this","that","these","those","not","no",
  "very","too","also","just","like","get","got","my","our","their","your","his","her",
  "more","most","some","any","all","both","few","many","much","same","each","which","who",
  "would","could","should","will","can","may","might","shall","there","here","then","when",
  "where","how","why","what","really","quite","little","big","time","come","came","went",
  "right","left","first","last","only","well","never","always","again","now","about","than",
  "into","through","after","before","between","other","used","good","great","nice","bad",
  "food","place","service","back","new","one","two","out","up","down","over","still","even",
  "long","ordered","tried","got","went","came","had","was","felt","think","thought","pretty",
]);

function avg(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
}

function rr(v) {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(3, Math.round(v)));
}

function topWords(notesArr, limit = 5) {
  const counts = {};
  for (const note of notesArr) {
    if (!note) continue;
    for (const w of note.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)) {
      if (w.length < 3 || STOP_WORDS.has(w)) continue;
      counts[w] = (counts[w] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

function RangeBar({ min, max }) {
  const same = min.toFixed(1) === max.toFixed(1);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#F1EFE8", marginBottom: 4 }}>
        <span>{min.toFixed(1)}</span>
        {!same && <span>{max.toFixed(1)}</span>}
      </div>
      <div style={{ position: "relative", height: 4, borderRadius: 2, background: "#3A3A38" }}>
        <div style={{
          position: "absolute",
          left: `${(min / 10) * 100}%`,
          right: `${100 - (max / 10) * 100}%`,
          height: "100%",
          borderRadius: 2,
          background: "#F0997B",
          minWidth: 4,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#888780", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}

function StatCell({ label, value, sub, type, min, max }) {
  return (
    <div style={{ background: "#252523", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      {type === "range" ? (
        <RangeBar min={min} max={max} />
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8" }}>{value}</div>
          {sub && <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>{sub}</div>}
        </>
      )}
    </div>
  );
}

export function PlaceStatsSheet({ post, restaurantWeights, drinkWeights, sweetWeights, onClose }) {
  const { t } = useLang();
  const { user } = useAuth();
  const [visits, setVisits] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [tasteBudsIds, setTasteBudsIds] = useState(null);
  const [wantedToGo, setWantedToGo] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch taste buds for the "who's been" section
  useEffect(() => {
    if (!user?.id) return;
    listTasteBuds(supabase, user.id).then((buds) => {
      setTasteBudsIds(new Set(buds.map((b) => b.otherUserId).filter(Boolean)));
    });
  }, [user?.id]);

  useEffect(() => {
    if (!post.placeId) return;
    let cancelled = false;
    const table = post.kind === "rest" ? "restaurant_visits" : "cafe_visits";
    (async () => {
      const { data } = await supabase
        .from(table)
        .select("taste, cost, portions, wait, repeatability, use_r, notes, user_id")
        .eq("place_id", post.placeId);
      if (cancelled) return;
      const rows = data || [];
      setVisits(rows);

      const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      if (!ids.length) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      if (cancelled) return;
      const m = {};
      for (const p of profs || []) m[p.id] = p;
      setProfiles(m);
    })();
    return () => { cancelled = true; };
  }, [post.placeId, post.kind]);

  const stats = useMemo(() => {
    if (!visits) return null;
    const valid = visits.filter(v =>
      Number.isFinite(+v.taste) && Number.isFinite(+v.cost) &&
      +v.portions > 0 && Number.isFinite(+v.wait)
    );
    const allTastes = visits.map(v => +v.taste).filter(t => Number.isFinite(t));
    const avgTaste = avg(valid.map(v => +v.taste));
    const avgCost = avg(valid.map(v => +v.cost));
    const avgWait = avg(valid.map(v => +v.wait));
    const avgPortions = avg(valid.map(v => +v.portions));
    const minTaste = allTastes.length ? Math.min(...allTastes) : null;
    const maxTaste = allTastes.length ? Math.max(...allTastes) : null;
    const useRMajority = valid.length > 0 && valid.filter(v => v.use_r).length >= valid.length / 2;
    const repeatRows = valid.filter(v => v.use_r && Number.isFinite(+v.repeatability));
    const repeatMode = (() => {
      if (!repeatRows.length) return null;
      const counts = [0, 0, 0, 0];
      for (const v of repeatRows) counts[Math.round(+v.repeatability)]++;
      return counts.indexOf(Math.max(...counts));
    })();

    return { avgTaste, avgCost, avgWait, avgPortions, minTaste, maxTaste, useRMajority, repeatMode, validCount: valid.length };
  }, [visits]);

  const hasBeenHere = user?.id && visits ? visits.some(v => v.user_id === user.id) : false;

  const biteScore = useMemo(() => {
    if (!stats || stats.avgTaste == null) return null;
    if (post.kind === "rest") {
      return calcBiteOutOf10(stats.avgTaste, stats.avgCost, stats.avgPortions, stats.avgWait, stats.useRMajority, rr(stats.repeatMode), restaurantWeights, "USD");
    }
    const wts = post.category === "Sweets" ? sweetWeights : drinkWeights;
    return calcCafeOutOf10(stats.avgTaste, stats.avgCost, stats.avgPortions, stats.avgWait || 0, stats.useRMajority, rr(stats.repeatMode), wts, "USD");
  }, [stats, post.kind, post.category, restaurantWeights, drinkWeights, sweetWeights]);

  // Taste Buds who've been (replaces "Top Logs")
  const tasteBudReviewers = useMemo(() => {
    if (!visits || !tasteBudsIds || !Object.keys(profiles).length) return [];
    const best = {};
    for (const v of visits) {
      if (!v.user_id || !tasteBudsIds.has(v.user_id)) continue;
      if (!Number.isFinite(+v.taste)) continue;
      if (best[v.user_id] == null || +v.taste > best[v.user_id]) best[v.user_id] = +v.taste;
    }
    return Object.entries(best)
      .sort((a, b) => b[1] - a[1])
      .map(([uid, taste]) => ({ profile: profiles[uid], taste }))
      .filter(r => r.profile);
  }, [visits, tasteBudsIds, profiles]);

  const words = useMemo(() => {
    if (!visits) return [];
    return topWords(visits.map(v => v.notes).filter(Boolean));
  }, [visits]);

  const flag = post.kind === "rest"
    ? (FLAGS[post.cuisine] || "🍽")
    : post.category === "Sweets" ? "🍰" : post.category === "Tea" ? "🍵" : "☕";

  const biteColor = biteScore != null ? scoreColor(biteScore) : "#888780";
  const biteTier = biteScore != null ? scoreLabel(biteScore, t) : null;
  const visitCount = visits?.length ?? 0;

  const costPerPortion = (stats?.avgCost != null && stats?.avgPortions != null && stats.avgPortions > 0)
    ? stats.avgCost / stats.avgPortions
    : null;

  const statCells = stats ? [
    stats.avgTaste != null && { label: "Avg Taste", value: stats.avgTaste.toFixed(1) },
    stats.minTaste != null && stats.maxTaste != null && {
      label: "Taste Range",
      type: "range",
      min: stats.minTaste,
      max: stats.maxTaste,
    },
    costPerPortion != null && { label: "Cost / portion", value: `$${costPerPortion.toFixed(2)}` },
    stats.avgWait != null && { label: "Avg Wait", value: `${Math.round(stats.avgWait)} min` },
    stats.repeatMode != null && {
      label: "Come Back?",
      value: "★".repeat(stats.repeatMode) + "☆".repeat(3 - stats.repeatMode),
      sub: "most common",
    },
  ].filter(Boolean) : [];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          background: "#1E1E1C",
          borderRadius: 16,
          border: "0.5px solid rgba(255,255,255,0.15)",
          padding: "20px 20px 24px",
          boxSizing: "border-box",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{flag}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F1EFE8", lineHeight: 1.3 }}>
              {post.name}
            </div>
            <div style={{ fontSize: 12, color: "#888780", marginTop: 3 }}>
              {[post.kind === "rest" ? post.cuisine : post.category, post.city].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#888780", fontSize: 20, lineHeight: 1, padding: 4, flexShrink: 0,
            }}
          >✕</button>
        </div>

        {visits === null && (
          <div style={{ fontSize: 13, color: "#888780", textAlign: "center", padding: "20px 0" }}>
            Loading…
          </div>
        )}

        {/* BITE score hero */}
        {biteScore != null && (
          <div style={{
            background: "#252523", borderRadius: 12, padding: "14px 16px",
            marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Avg BITE · your weights
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: biteColor, lineHeight: 1 }}>
                  {biteScore.toFixed(2)}
                </div>
                {biteTier && (
                  <div style={{ fontSize: 11, color: biteColor, marginTop: 4, fontWeight: 500 }}>
                    {biteTier}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#888780", textAlign: "right" }}>
                {visitCount} {visitCount === 1 ? "log" : "logs"}
                {hasBeenHere && (
                  <div style={{ fontSize: 11, color: "#7DBF8E", marginTop: 4, fontWeight: 500 }}>
                    ✓ you've been
                  </div>
                )}
                {!hasBeenHere && post.placeId && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user?.id || wantedToGo) return;
                        setWantedToGo(true);
                        await addWantToGo(supabase, user.id, {
                          placeId: post.placeId,
                          kind: post.kind || "rest",
                          name: post.name,
                          cuisine: post.cuisine || post.category,
                          city: post.city,
                        });
                      }}
                      style={{
                        fontSize: 11,
                        color: wantedToGo ? "#7DBF8E" : "#F0997B",
                        background: "none", border: "none",
                        cursor: wantedToGo ? "default" : "pointer",
                        padding: 0, fontWeight: 500,
                      }}
                    >
                      {wantedToGo ? "✓ Saved" : "＋ Want to go"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats grid */}
        {statCells.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {statCells.map(cell => (
              <StatCell key={cell.label} {...cell} />
            ))}
          </div>
        )}

        {/* Taste Buds who've been */}
        {tasteBudReviewers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Your Taste Buds who've been
            </div>
            {tasteBudReviewers.map(({ profile, taste }) => (
              <div key={profile.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Avatar profile={profile} size={26} />
                <div style={{ flex: 1, fontSize: 13, color: "#C4C2BA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profile.display_name || profile.username}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#F0997B", flexShrink: 0 }}>
                  {taste.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vibe words */}
        {words.length >= 3 && (
          <div>
            <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              People say
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {words.map(w => (
                <span key={w} style={{
                  padding: "4px 12px", borderRadius: 999,
                  background: "#252523",
                  border: "0.5px solid rgba(255,255,255,0.1)",
                  fontSize: 12, color: "#C4C2BA",
                }}>
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
