import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { listTasteBuds, unfollowUser } from "../../utils/followsApi.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import { myRestVisitsCache, getUserVisitsCache } from "../../utils/sessionCache.js";
import { pairCompatibility, restaurantOverlap } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Pill } from "./Pill.jsx";
import { Toggle } from "../Toggle.jsx";
import { Avatar } from "./Avatar.jsx";
import { UserIdentity } from "./UserIdentity.jsx";
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

export function CompareTab({ user, initialTarget, onClearTarget, onFollowChange }) {
  const { t } = useLang();
  const [buds, setBuds] = useState([]);
  const [target, setTarget] = useState(initialTarget || null);
  const [myVisits, setMyVisits] = useState(() =>
    myRestVisitsCache.userId === user?.id ? myRestVisitsCache.data : [],
  );
  const [theirVisits, setTheirVisits] = useState(() => {
    const uv = getUserVisitsCache(user?.id);
    return initialTarget?.id && uv.has(initialTarget.id) ? uv.get(initialTarget.id) : [];
  });
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (initialTarget && initialTarget.id !== target?.id) {
      setTarget(initialTarget);
    }
  }, [initialTarget?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

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

  const compat = useMemo(() => {
    if (!target?.id) return null;
    return pairCompatibility(myVisits, theirVisits);
  }, [myVisits, theirVisits, target?.id]);

  const overlap = useMemo(() => {
    if (!target?.id) return null;
    return restaurantOverlap(myVisits, theirVisits);
  }, [myVisits, theirVisits, target?.id]);

  const filteredBoth = useMemo(() => {
    if (!dinedTogetherOnly) return overlap?.both || [];
    return (overlap?.both || []).filter((r) => dinedTogetherPlaceIds.has(r.placeId));
  }, [overlap?.both, dinedTogetherOnly, dinedTogetherPlaceIds]);

  /** Pagination tails. Hooks live above the early-return picker view so
   *  the order stays stable between the picker and the compare view. The
   *  buds picker resets when the bud set size changes; the per-target
   *  lists reset when the target changes. */
  const budsPage = usePaginatedList(buds, String(buds.length));
  const bothPage = usePaginatedList(filteredBoth, `${target?.id || ""}_${dinedTogetherOnly}`);
  const onlyTheirsPage = usePaginatedList(overlap?.onlyTheirs || [], target?.id || "", 3);
  const onlyMinePage = usePaginatedList(overlap?.onlyMine || [], target?.id || "", 3);

  function clearTarget() {
    setTarget(null);
    onClearTarget?.();
  }

  /** Unfollow from Compare view — breaks the mutual, downgrades out of Taste Buds. */
  async function handleUnfollow() {
    if (!user?.id || !target?.id) return;
    await unfollowUser(supabase, user.id, target.id);
    onFollowChange?.();
    clearTarget();
  }

  // ── Picker: no target selected yet ──
  if (!target) {
    return (
      <div>
        <p style={{ fontSize: 12, color: "#888780", margin: "0 0 12px" }}>
          {t.pickTasteBudToCompare || "Pick a Taste Bud to compare scores."}
        </p>
        {!buds.length && (
          <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
            {t.noTasteBudsYet || "No taste buds yet."}
          </p>
        )}
        {budsPage.visible.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTarget(f.otherProfile)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", marginBottom: 8, width: "100%",
              background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: 12, cursor: "pointer", textAlign: "left",
            }}
          >
            <UserIdentity profile={f.otherProfile} size={32} />
            <span style={{ fontSize: 18, color: "#888780" }}>›</span>
          </button>
        ))}
        <ShowMoreButton
          remaining={budsPage.remaining}
          pageSize={budsPage.pageSize}
          onClick={budsPage.showMore}
        />
      </div>
    );
  }

  // ── Compare view: target selected ──
  const insufficientMine = (myVisits || []).length === 0;
  const sharedTop = compat ? topSharedCuisines(compat.agreements) : [];
  const summaryLine = sharedTop.length
    ? fmtTemplate(t.youBothLove || "You both love {cuisines}", {
      cuisines: sharedTop.join(t.andSeparator || " and "),
    })
    : null;

  const friendName = target.display_name || target.username || "—";
  const isTasteBud = buds.some((f) => f.otherUserId === target?.id);

  const onlyTheirs = overlap?.onlyTheirs || [];
  const onlyMine = overlap?.onlyMine || [];

  return (
    <div>
      <button
        type="button"
        onClick={clearTarget}
        style={{
          fontSize: 12, color: "#888780", background: "none", border: "none",
          cursor: "pointer", padding: 0, marginBottom: 12,
        }}
      >{t.pickTasteBudToCompare || "← Pick a Taste Bud"}</button>

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
