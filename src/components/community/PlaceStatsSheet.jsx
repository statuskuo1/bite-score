import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../config/supabaseClient.js";
import { calcBiteOutOf10, calcCafeOutOf10, scoreColor, scoreLabel } from "../../utils/scoring.js";
import { toUSD, fromUSD, CURRENCY_SYMBOLS } from "../../utils/currency.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Avatar } from "./Avatar.jsx";
import { MapsLink } from "./MapsLink.jsx";
import { useLang } from "../../contexts/LangContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { listTasteBuds } from "../../utils/followsApi.js";
import {
  addWantToGo,
  removeWantToGo,
  optimisticAddWantToGo,
  optimisticRemoveWantToGo,
} from "../../utils/wantToGoApi.js";
import { useWantToGoSaved } from "../../utils/useWantToGoSaved.js";

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

/** Extract general vibe words (most frequent non-stopwords). */
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

/**
 * Extract likely dish names: sequences of mid-sentence capitalized words
 * (e.g., "Pad Thai", "Tonkotsu Ramen", "Dan Dan Noodles"). Mid-sentence caps
 * in food notes almost always signal a proper dish name.
 */
function topDishes(notesArr, limit = 6) {
  const counts = {};
  for (const note of notesArr) {
    if (!note) continue;
    const words = note.split(/\s+/);
    let i = 0;
    while (i < words.length) {
      if (i > 0 && /^[A-Z][a-z]{1,}/.test(words[i])) {
        const seq = [words[i].replace(/[^a-zA-Z]/g, "")];
        let j = i + 1;
        while (j < words.length && /^[A-Z][a-z]{1,}/.test(words[j])) {
          seq.push(words[j].replace(/[^a-zA-Z]/g, ""));
          j++;
        }
        const key = seq.join(" ").toLowerCase();
        if (key.length >= 3 && !STOP_WORDS.has(seq[0].toLowerCase())) {
          counts[key] = (counts[key] || 0) + 1;
        }
        i = j;
      } else {
        i++;
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w.replace(/\b\w/g, (c) => c.toUpperCase()));
}

function StatCell({ label, value, sub }) {
  return (
    <div style={{ background: "#252523", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function PlaceStatsSheet({ post, restaurantWeights, drinkWeights, sweetWeights, onClose }) {
  const { t } = useLang();
  const { user } = useAuth();
  const [visits, setVisits] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [tasteBudsIds, setTasteBudsIds] = useState(null);
  const wantedToGo = useWantToGoSaved(post.placeId, post.kind || "rest");

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
        .select("taste, cost, portions, wait, repeatability, use_r, notes, user_id, currency_code")
        .eq("place_id", post.placeId);
      if (cancelled) return;
      const rows = data || [];
      setVisits(rows);

      const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      if (!ids.length) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, pref_weight_taste, pref_weight_bpb, pref_weight_wait, pref_weight_drink_taste, pref_weight_drink_bpb, pref_weight_drink_wait, pref_weight_sweet_taste, pref_weight_sweet_bpb, pref_weight_sweet_wait")
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

    // Determine the modal currency so costs display correctly (e.g. NT$ for Taiwan)
    const currencyFreq = {};
    for (const v of valid) {
      const c = v.currency_code || "USD";
      currencyFreq[c] = (currencyFreq[c] || 0) + 1;
    }
    const modalCurrency = Object.keys(currencyFreq).length
      ? Object.entries(currencyFreq).sort((a, b) => b[1] - a[1])[0][0]
      : "USD";

    // Average cost in USD (for BITE scoring) and in modal currency (for display)
    const avgCostUSD = avg(valid.map(v => toUSD(+v.cost, v.currency_code || "USD")));
    const avgCostDisplay = avgCostUSD != null ? fromUSD(avgCostUSD, modalCurrency) : null;
    const costSymbol = CURRENCY_SYMBOLS[modalCurrency] || modalCurrency + " ";

    return {
      avgTaste, avgCostUSD, avgCostDisplay, costSymbol, modalCurrency,
      avgWait, avgPortions, minTaste, maxTaste, useRMajority, repeatMode,
      validCount: valid.length,
    };
  }, [visits]);

  const hasBeenHere = user?.id && visits ? visits.some(v => v.user_id === user.id) : false;

  const biteScore = useMemo(() => {
    if (!stats || stats.avgTaste == null) return null;
    if (post.kind === "rest") {
      return calcBiteOutOf10(stats.avgTaste, stats.avgCostUSD, stats.avgPortions, stats.avgWait, stats.useRMajority, rr(stats.repeatMode), restaurantWeights, "USD");
    }
    const wts = post.category === "Sweets" ? sweetWeights : drinkWeights;
    return calcCafeOutOf10(stats.avgTaste, stats.avgCostUSD, stats.avgPortions, stats.avgWait || 0, stats.useRMajority, rr(stats.repeatMode), wts, "USD");
  }, [stats, post.kind, post.category, restaurantWeights, drinkWeights, sweetWeights]);

  const tasteBudReviewers = useMemo(() => {
    if (!visits || !tasteBudsIds || !Object.keys(profiles).length) return [];
    const best = {}; // uid → best BITE score
    for (const v of visits) {
      if (!v.user_id || !tasteBudsIds.has(v.user_id)) continue;
      if (!Number.isFinite(+v.taste) || !+v.portions) continue;
      const prof = profiles[v.user_id];
      if (!prof) continue;
      let wts;
      if (post.kind === "rest") {
        wts = { taste: prof.pref_weight_taste ?? null, bpb: prof.pref_weight_bpb ?? null, wait: prof.pref_weight_wait ?? null };
      } else if (post.category === "Sweets") {
        wts = { taste: prof.pref_weight_sweet_taste ?? null, bpb: prof.pref_weight_sweet_bpb ?? null, wait: prof.pref_weight_sweet_wait ?? null };
      } else {
        wts = { taste: prof.pref_weight_drink_taste ?? null, bpb: prof.pref_weight_drink_bpb ?? null, wait: prof.pref_weight_drink_wait ?? null };
      }
      const bite = post.kind === "rest"
        ? calcBiteOutOf10(+v.taste, +v.cost, +v.portions, +v.wait, v.use_r, rr(+v.repeatability), wts, v.currency_code || "USD")
        : calcCafeOutOf10(+v.taste, +v.cost, +v.portions, +v.wait, v.use_r, rr(+v.repeatability), wts, v.currency_code || "USD");
      if (bite == null) continue;
      if (best[v.user_id] == null || bite > best[v.user_id]) best[v.user_id] = bite;
    }
    return Object.entries(best)
      .sort((a, b) => b[1] - a[1])
      .map(([uid, bite]) => ({ profile: profiles[uid], bite }))
      .filter(r => r.profile);
  }, [visits, tasteBudsIds, profiles, post.kind, post.category]);

  const words = useMemo(() => {
    if (!visits) return [];
    return topWords(visits.map(v => v.notes).filter(Boolean));
  }, [visits]);

  const dishes = useMemo(() => {
    if (!visits) return [];
    return topDishes(visits.map(v => v.notes).filter(Boolean));
  }, [visits]);

  const flag = post.kind === "rest"
    ? (FLAGS[post.cuisine] || "🍽")
    : post.category === "Sweets" ? "🍰" : post.category === "Tea" ? "🍵" : "☕";

  const biteColor = biteScore != null ? scoreColor(biteScore) : "#888780";
  const biteTier = biteScore != null ? scoreLabel(biteScore, t) : null;
  const visitCount = visits?.length ?? 0;

  const costPerPortion = (stats?.avgCostDisplay != null && stats?.avgPortions != null && stats.avgPortions > 0)
    ? stats.avgCostDisplay / stats.avgPortions
    : null;

  const statCells = stats ? [
    stats.avgTaste != null && {
      label: "Avg Taste",
      value: stats.avgTaste.toFixed(1),
      sub: (stats.minTaste != null && stats.maxTaste != null)
        ? `min: ${stats.minTaste.toFixed(1)} · max: ${stats.maxTaste.toFixed(1)}`
        : undefined,
    },
    { label: "Logs", value: `${visitCount}` },
    costPerPortion != null && {
      label: "AVG Cost / portion",
      value: `${stats.costSymbol}${costPerPortion.toFixed(costPerPortion >= 100 ? 0 : 2)}`,
    },
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
            <div style={{ marginTop: 6 }}>
              <MapsLink name={post.name} city={post.city} size="md" />
            </div>
          </div>
          {/* Top-right: dismiss + you've been badge */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#888780", fontSize: 20, lineHeight: 1, padding: 4,
              }}
            >✕</button>
            {hasBeenHere && (
              <span style={{ fontSize: 11, color: "#7DBF8E", fontWeight: 500, whiteSpace: "nowrap" }}>
                ✓ you've been
              </span>
            )}
          </div>
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
                  Global Rating → your weights
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
                {!hasBeenHere && post.placeId && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user?.id) return;
                        const kind = post.kind || "rest";
                        const category = kind === "cafe" ? (post.category || null) : null;
                        if (wantedToGo) {
                          optimisticRemoveWantToGo({ placeId: post.placeId, kind });
                          const res = await removeWantToGo(supabase, user.id, { placeId: post.placeId, kind });
                          if (!res.ok) {
                            optimisticAddWantToGo(user.id, {
                              placeId: post.placeId, kind,
                              name: post.name, cuisine: post.cuisine || post.category, city: post.city,
                              category,
                            });
                          }
                        } else {
                          optimisticAddWantToGo(user.id, {
                            placeId: post.placeId, kind,
                            name: post.name, cuisine: post.cuisine || post.category, city: post.city,
                            category,
                          });
                          const res = await addWantToGo(supabase, user.id, {
                            placeId: post.placeId, kind,
                            name: post.name, cuisine: post.cuisine || post.category, city: post.city,
                            category,
                          });
                          if (!res.ok) optimisticRemoveWantToGo({ placeId: post.placeId, kind });
                        }
                      }}
                      style={{
                        fontSize: 11,
                        color: wantedToGo ? "#7DBF8E" : "#F0997B",
                        background: "none", border: "none",
                        cursor: "pointer",
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

        {/* Taste Buds who've been — capped height so modal doesn't grow unbounded */}
        {tasteBudReviewers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Your Taste Buds who've been
            </div>
            <div style={{
              maxHeight: tasteBudReviewers.length > 3 ? 120 : undefined,
              overflowY: tasteBudReviewers.length > 3 ? "auto" : undefined,
              paddingRight: tasteBudReviewers.length > 3 ? 4 : undefined,
            }}>
              {tasteBudReviewers.map(({ profile, bite }) => (
                <div key={profile.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Avatar profile={profile} size={26} />
                  <div style={{ flex: 1, fontSize: 13, color: "#C4C2BA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {profile.display_name || profile.username}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: scoreColor(bite), flexShrink: 0 }}>
                    {bite != null ? bite.toFixed(2) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Popular dishes — mid-sentence capitalized words from notes */}
        {dishes.length >= 2 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Popular dishes
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dishes.map(w => (
                <span key={w} style={{
                  padding: "4px 12px", borderRadius: 999,
                  background: "#1A2A1A",
                  border: "0.5px solid rgba(125,191,142,0.3)",
                  fontSize: 12, color: "#7DBF8E",
                }}>
                  {w}
                </span>
              ))}
            </div>
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
