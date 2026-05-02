import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlacePickerModal } from "./PlacePickerModal.jsx";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { listTasteBuds, unfollowUser } from "../../utils/followsApi.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import { fetchProfileByUsername } from "../../utils/profileApi.js";
import { myRestVisitsCache, getUserVisitsCache } from "../../utils/sessionCache.js";
import { pairCompatibility, restaurantOverlap } from "../../utils/compatibility.js";
import { tasteColor, weightsToPercents } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Pill } from "./Pill.jsx";
import { Toggle } from "../Toggle.jsx";
import { Avatar } from "./Avatar.jsx";
import { usePaginatedList } from "../usePaginatedList.js";
import { ShowMoreButton } from "../ShowMoreButton.jsx";
import { SectionLabel } from "../SectionLabel.jsx";

const FLAG_BOX_STYLE = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: "#252523",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  flexShrink: 0,
};

const YOU_LEGEND_COLOR = "#F0997B";
const FRIEND_LEGEND_COLOR = "#5B9BD5";

function topSharedCuisines(agreements, { limit = 2, threshold = 7 } = {}) {
  return [...(agreements || [])]
    .filter((a) => Math.min(a.mine, a.theirs) >= threshold)
    .sort((a, b) => Math.min(b.mine, b.theirs) - Math.min(a.mine, a.theirs))
    .slice(0, limit)
    .map((a) => a.cuisine);
}

function flagFor(cuisine, name) {
  return FLAGS[cuisine] || (cuisine?.[0] || name?.[0] || "?").toUpperCase();
}

function fmtTemplate(tpl, vars) {
  if (!tpl) return "";
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    tpl,
  );
}

function CompatHeroCard({ score, summaryLine, t }) {
  const col = score == null ? "#888780" : tasteColor(score / 10);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      background: `${col}14`,
      border: `1px solid ${col}55`,
      borderRadius: 12, padding: "14px 16px",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: col, lineHeight: 1, flexShrink: 0 }}>
        {score == null ? "—" : `${score}%`}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#F1EFE8" }}>
          {t.tasteCompatibility || "Taste compatibility"}
        </div>
        {summaryLine ? (
          <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>{summaryLine}</div>
        ) : (
          <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>
            {score == null ? t.notEnoughSharedData : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function Score({ value, color }) {
  const col = color || tasteColor(value);
  return (
    <span style={{
      fontSize: 15, fontWeight: 600, color: col, lineHeight: 1.1,
      minWidth: 32, textAlign: "right",
    }}>
      {value.toFixed(2)}
    </span>
  );
}

function BothRow({ row, isLast }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px",
      borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
    }}>
      <div style={FLAG_BOX_STYLE}>{flagFor(row.cuisine, row.name)}</div>
      <div style={{
        flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: "#F1EFE8",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{row.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <Score value={row.mine} color={YOU_LEGEND_COLOR} />
      <span style={{ fontSize: 11, color: "#666663" }}>vs</span>
      <Score value={row.theirs} color={FRIEND_LEGEND_COLOR} />
      </div>
    </div>
  );
}

function DiscoverRow({ row, subLine, badgeText, badgeTone }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px", marginBottom: 6,
      background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
    }}>
      <div style={FLAG_BOX_STYLE}>{flagFor(row.cuisine, row.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: "#F1EFE8",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{row.name}</div>
        <div style={{
          fontSize: 11, color: "#888780",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{subLine}</div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 999,
        background: badgeTone.bg, color: badgeTone.color,
        border: `1px solid ${badgeTone.border}`,
        whiteSpace: "nowrap", flexShrink: 0,
      }}>{badgeText}</span>
    </div>
  );
}

const DISCOVER_TONE = { bg: "rgba(91,155,213,0.14)", color: "#5B9BD5", border: "rgba(91,155,213,0.4)" };
const RECOMMEND_TONE = { bg: "rgba(151,196,89,0.14)", color: "#97C459", border: "rgba(151,196,89,0.4)" };

const DEFAULT_WEIGHTS = { taste: 50, bpb: 40, wait: 10 };

function topWeightLabel(w) {
  if (!w) return "taste";
  const m = Math.max(w.taste, w.bpb, w.wait);
  if (w.taste === m) return "taste";
  if (w.bpb === m) return "bang per buck";
  return "wait time";
}

function buildCompatExplanation(compat, myWeights, theirWeights) {
  if (!compat || compat.notEnoughData || compat.score == null) {
    return "Log more meals to get a full compatibility score.";
  }
  const { weightSimilarity, regionOverlap, sharedVisits, ratingAgreementScore } = compat;
  const sentences = [];

  if (weightSimilarity > 0.75) {
    const label = topWeightLabel(myWeights);
    sentences.push(`You both prioritize ${label} — you'll likely agree on what makes a meal worth it.`);
  } else if (weightSimilarity < 0.45) {
    const labelA = topWeightLabel(myWeights ?? DEFAULT_WEIGHTS);
    const labelB = topWeightLabel(theirWeights ?? DEFAULT_WEIGHTS);
    sentences.push(`You weight ${labelA} heavily — they weight ${labelB}. You might disagree on whether a meal was worth it.`);
  }

  if (regionOverlap >= 2 / 3) {
    sentences.push("Strong overlap in cuisine preferences.");
  } else if (sharedVisits >= 3 && ratingAgreementScore != null && ratingAgreementScore > 0.8) {
    sentences.push("You've rated the same places almost identically.");
  }

  return sentences.slice(0, 2).join(" ") || null;
}

/** Lowercase a username for safe case-insensitive comparison. */
function lc(u) {
  return u ? String(u).toLowerCase() : "";
}

export function CompareTab({ user, myWeights, username, primedTarget, onFollowChange, myDisplayName = "" }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const [buds, setBuds] = useState([]);
  /** Source of truth for the comparison is the `username` prop (from the URL).
   *  `target` mirrors the resolved profile; the lazy initializer accepts the
   *  primed handoff when its username matches so we paint the 1:1 view without
   *  waiting on a fetch. */
  const [target, setTarget] = useState(() =>
    primedTarget && lc(primedTarget.username) === lc(username) ? primedTarget : null,
  );
  const [resolving, setResolving] = useState(false);
  const [myVisits, setMyVisits] = useState(() =>
    myRestVisitsCache.userId === user?.id ? myRestVisitsCache.data : [],
  );
  const [theirVisits, setTheirVisits] = useState(() => {
    const uv = getUserVisitsCache(user?.id);
    const seedId = primedTarget && lc(primedTarget.username) === lc(username) ? primedTarget.id : null;
    return seedId && uv.has(seedId) ? uv.get(seedId) : [];
  });
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [dinedTogetherOnly, setDinedTogetherOnly] = useState(false);
  const [dinedTogetherPlaceIds, setDinedTogetherPlaceIds] = useState(new Set());

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const b = await listTasteBuds(supabase, user.id);
      if (!cancelled) setBuds(b);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (myRestVisitsCache.userId === user?.id) return; // already hydrated from initializer
    let cancelled = false;
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, user.id);
      if (!cancelled) {
        setMyVisits(v);
        myRestVisitsCache.data = v;
        myRestVisitsCache.userId = user?.id;
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!target?.id) { setTheirVisits([]); return; }
    const uv = getUserVisitsCache(user?.id);
    if (uv.has(target.id)) {
      setTheirVisits(uv.get(target.id));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, target.id);
      if (!cancelled) {
        setTheirVisits(v);
        uv.set(target.id, v);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Resolve `username` → `target` profile.
   *  Order: existing target (no-op) → primed handoff → buds cache → DB fetch.
   *  Misses (unknown username, self-compare) bounce back to People > Taste Buds.
   *  `primedTarget` is included so a late-arriving handoff (notification path
   *  populates it via a `useEffect` one render after CompareTab mounts) can
   *  short-circuit the fetch. The `target` early-return prevents it from
   *  stomping an already-resolved value. */
  useEffect(() => {
    if (!username || !user?.id) return;
    if (target && lc(target.username) === lc(username)) return;
    if (primedTarget && lc(primedTarget.username) === lc(username)) {
      setTarget(primedTarget);
      return;
    }
    const fromBuds = buds.find((b) => lc(b.otherProfile?.username) === lc(username))?.otherProfile;
    if (fromBuds) { setTarget(fromBuds); return; }
    let cancelled = false;
    setResolving(true);
    (async () => {
      const p = await fetchProfileByUsername(supabase, username);
      if (cancelled) return;
      setResolving(false);
      if (!p || p.id === user.id) {
        navigate("/community/people/taste-buds", { replace: true });
        return;
      }
      setTarget(p);
    })();
    return () => { cancelled = true; };
  }, [username, user?.id, buds, primedTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDinedTogetherOnly(false);
    if (!user?.id || !target?.id) { setDinedTogetherPlaceIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const { data: tags } = await supabase
        .from("dine_with_tags")
        .select("entry_id, entry_type")
        .or(`and(tagger_id.eq.${user.id},tagged_id.eq.${target.id}),and(tagger_id.eq.${target.id},tagged_id.eq.${user.id})`)
        .not("entry_id", "is", null);
      if (cancelled) return;
      if (!tags?.length) { setDinedTogetherPlaceIds(new Set()); return; }
      const restIds = tags.filter((r) => r.entry_type !== "cafe").map((r) => r.entry_id);
      const cafeIds = tags.filter((r) => r.entry_type === "cafe").map((r) => r.entry_id);
      const [restRes, cafeRes] = await Promise.all([
        restIds.length ? supabase.from("restaurant_visits").select("place_id").in("id", restIds) : { data: [] },
        cafeIds.length ? supabase.from("cafe_visits").select("place_id").in("id", cafeIds) : { data: [] },
      ]);
      if (!cancelled) {
        const placeIds = [
          ...(restRes.data || []).map((v) => v.place_id),
          ...(cafeRes.data || []).map((v) => v.place_id),
        ].filter(Boolean);
        setDinedTogetherPlaceIds(new Set(placeIds));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const theirWeights = target?.pref_weight_taste != null
    ? weightsToPercents({ taste: target.pref_weight_taste, bpb: target.pref_weight_bpb, wait: target.pref_weight_wait })
    : null;
  const myWeightsPct = myWeights ? weightsToPercents(myWeights) : null;

  const compat = useMemo(() => {
    if (!target?.id) return null;
    return pairCompatibility(myVisits, theirVisits, myWeightsPct ?? null, theirWeights);
  }, [myVisits, theirVisits, target?.id, myWeightsPct, theirWeights]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlap = useMemo(() => {
    if (!target?.id) return null;
    return restaurantOverlap(myVisits, theirVisits);
  }, [myVisits, theirVisits, target?.id]);

  const filteredBoth = useMemo(() => {
    if (!dinedTogetherOnly) return overlap?.both || [];
    return (overlap?.both || []).filter((r) => dinedTogetherPlaceIds.has(r.placeId));
  }, [overlap?.both, dinedTogetherOnly, dinedTogetherPlaceIds]);

  /** Pagination tails. Per-target lists reset when the target changes. */
  const bothPage = usePaginatedList(filteredBoth, `${target?.id || ""}_${dinedTogetherOnly}`);
  const onlyTheirsPage = usePaginatedList(overlap?.onlyTheirs || [], target?.id || "", 3);
  const onlyMinePage = usePaginatedList(overlap?.onlyMine || [], target?.id || "", 3);

  /** Back-navigate to People > Taste Buds. The dominant Compare entry path
   *  is a tap on a Taste Bud → MiniProfileSheet → Compare, so back belongs
   *  on the buds list. Bare /community/compare without a username is bounced
   *  here automatically by CommunityTab. */
  function goBackToBuds() {
    navigate("/community/people/taste-buds");
  }

  /** Unfollow from Compare view — breaks the mutual, downgrades out of Taste Buds. */
  async function handleUnfollow() {
    if (!user?.id || !target?.id) return;
    await unfollowUser(supabase, user.id, target.id);
    onFollowChange?.();
    goBackToBuds();
  }

  // Resolving the URL username → profile (or pre-fetch in flight). A stale
  // render with no target is also possible briefly between username changes;
  // either way show the same minimal placeholder so the surface doesn't pop empty.
  if (!target) {
    return (
      <p style={{ fontSize: 12, color: "#888780" }}>
        {resolving ? "…" : ""}
      </p>
    );
  }

  // ── Compare view: target selected ──
  const insufficientMine = (myVisits || []).length === 0;
  const summaryLine = loading ? null : buildCompatExplanation(compat, myWeightsPct, theirWeights);

  const friendName = target.display_name || target.username || "—";
  const isTasteBud = buds.some((f) => f.otherUserId === target?.id);

  const onlyTheirs = overlap?.onlyTheirs || [];
  const onlyMine = overlap?.onlyMine || [];

  return (
    <div>
      <button
        type="button"
        onClick={goBackToBuds}
        style={{
          fontSize: 12, color: "#888780", background: "none", border: "none",
          cursor: "pointer", padding: 0, marginBottom: 12,
        }}
      >{t.backToBuds || "← Back to Buds"}</button>

      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 14,
      }}>
        <Avatar profile={target} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 600, color: "#F1EFE8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{friendName}</div>
          <div style={{
            fontSize: 12, color: "#888780",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {fmtTemplate(t.comparingSharedRestaurants || "Comparing {n} shared restaurants", {
              n: overlap?.both?.length ?? 0,
            })}
          </div>
        </div>
      </div>

      <CompatHeroCard
        score={loading ? null : compat?.score}
        summaryLine={summaryLine}
        t={t}
      />

      <button
        type="button"
        onClick={() => setShowPicker(true)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          width: "100%", padding: "11px",
          background: "transparent",
          border: "0.5px solid rgba(240,153,123,0.35)",
          borderRadius: 10, color: "#F0997B",
          fontSize: 14, fontWeight: 500, cursor: "pointer",
          marginBottom: 16,
        }}
      >
        🍽 Pick a place for us
      </button>

      {showPicker && (
        <PlacePickerModal
          user={user}
          myVisits={myVisits}
          theirVisits={theirVisits}
          myWeights={myWeights}
          theirWeights={theirWeights}
          myDisplayName={myDisplayName}
          friendName={friendName}
          onClose={() => setShowPicker(false)}
        />
      )}

      {loading && (
        <p style={{ fontSize: 12, color: "#888780" }}>…</p>
      )}

      {!loading && insufficientMine && (
        <p style={{ fontSize: 12, color: "#888780" }}>{t.insufficientVisits}</p>
      )}

      {!loading && !insufficientMine && overlap && (
        <>
          <section style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <SectionLabel style={{ marginBottom: 0 }}>{t.bothVisited}</SectionLabel>
              {dinedTogetherPlaceIds.size > 0 && (
                <>
                  <Toggle on={dinedTogetherOnly} onClick={() => setDinedTogetherOnly((v) => !v)} />
                  <span style={{ fontSize: 11, color: "#888780" }}>Dined together</span>
                </>
              )}
            </div>
            {filteredBoth.length === 0 ? (
              <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
                {dinedTogetherOnly ? "No shared restaurants dined together yet." : t.noOverlapYet}
              </p>
            ) : (
              <>
                <div style={{
                  background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, overflow: "hidden",
                }}>
                  {bothPage.visible.map((r, i) => (
                    <BothRow key={r.placeId} row={r} isLast={i === bothPage.visible.length - 1} />
                  ))}
                </div>
                <ShowMoreButton
                  remaining={bothPage.remaining}
                  pageSize={bothPage.pageSize}
                  onClick={bothPage.showMore}
                />
                <div style={{
                  display: "flex", justifyContent: "center", gap: 6,
                  fontSize: 11, color: "#888780", marginTop: 8,
                }}>
                  <span style={{ color: YOU_LEGEND_COLOR, fontWeight: 600 }}>
                    {t.youLegend || "You"}
                  </span>
                  <span>vs</span>
                  <span style={{ color: FRIEND_LEGEND_COLOR, fontWeight: 600 }}>
                    {friendName}
                  </span>
                </div>
              </>
            )}
          </section>

          <section style={{ marginBottom: 18 }}>
            <SectionLabel>
              {fmtTemplate(t.theyTriedYouHavent || "{name} tried, you haven't", { name: friendName })}
            </SectionLabel>
            {onlyTheirs.length === 0 ? (
              <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.nothingNewFromThem}</p>
            ) : (
              <>
                {onlyTheirsPage.visible.map((r) => (
                  <DiscoverRow
                    key={r.placeId}
                    row={r}
                    subLine={[
                      r.cuisine,
                      fmtTemplate(t.friendRatedText || "{name} rated {score}", {
                        name: friendName, score: r.theirs.toFixed(2),
                      }),
                    ].filter(Boolean).join(" · ")}
                    badgeText={t.discoverBadge}
                    badgeTone={DISCOVER_TONE}
                  />
                ))}
                <ShowMoreButton
                  remaining={onlyTheirsPage.remaining}
                  pageSize={onlyTheirsPage.pageSize}
                  onClick={onlyTheirsPage.showMore}
                />
              </>
            )}
          </section>

          <section style={{ marginBottom: 16 }}>
            <SectionLabel>
              {fmtTemplate(t.youTriedTheyHavent || "You tried, {name} hasn't", { name: friendName })}
            </SectionLabel>
            {onlyMine.length === 0 ? (
              <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.nothingNewFromYou}</p>
            ) : (
              <>
                {onlyMinePage.visible.map((r) => (
                  <DiscoverRow
                    key={r.placeId}
                    row={r}
                    subLine={[
                      r.cuisine,
                      fmtTemplate(t.youRatedText || "You rated {score}", {
                        score: r.mine.toFixed(2),
                      }),
                    ].filter(Boolean).join(" · ")}
                    badgeText={t.recommendBadge}
                    badgeTone={RECOMMEND_TONE}
                  />
                ))}
                <ShowMoreButton
                  remaining={onlyMinePage.remaining}
                  pageSize={onlyMinePage.pageSize}
                  onClick={onlyMinePage.showMore}
                />
              </>
            )}
          </section>
        </>
      )}

    </div>
  );
}
