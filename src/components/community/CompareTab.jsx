import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { supabase } from "../../config/supabaseClient.js";
import { listFriendships, deleteFriendship } from "../../utils/friendsApi.js";
import { fetchRestaurantVisitsForUser } from "../../utils/visitPlacesApi.js";
import { pairCompatibility, restaurantOverlap } from "../../utils/compatibility.js";
import { tasteColor } from "../../utils/scoring.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Pill } from "./Pill.jsx";
import { Avatar } from "./Avatar.jsx";
import { UserIdentity } from "./UserIdentity.jsx";

const SECTION_LABEL_STYLE = {
  fontSize: 11,
  color: "#F0997B",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
  marginBottom: 8,
};

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

/** Color-side legend uses fixed accents so users can tell "left = me, right =
 *  them" at a glance even when both row scores happen to land on the same
 *  tier color. The friend accent matches the "good" tier color so it reads
 *  as a stable identifier rather than competing with score colors. */
const YOU_LEGEND_COLOR = "#F0997B";
const FRIEND_LEGEND_COLOR = "#5B9BD5";

const TOP_DISCOVER_LIMIT = 3;

/** Pick top shared cuisines for the "You both love …" summary line. We
 *  weight by `min(mine, theirs)` so the list highlights cuisines BOTH
 *  rate highly, not ones where one user drags the average up. */
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

/** Tier-colored hero card: "78% / Taste compatibility / You both love …". */
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

/** Score with tier color, used inside Both-visited rows. */
function Score({ value }) {
  const col = tasteColor(value);
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
        <Score value={row.mine} />
        <span style={{ fontSize: 11, color: "#666663" }}>vs</span>
        <Score value={row.theirs} />
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

export function CompareTab({ user, initialTarget, onClearTarget }) {
  const { t } = useLang();
  const [friends, setFriends] = useState([]);
  const [target, setTarget] = useState(initialTarget || null);
  const [myVisits, setMyVisits] = useState([]);
  const [theirVisits, setTheirVisits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { friends: f } = await listFriendships(supabase, user.id);
      if (!cancelled) setFriends(f);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, user.id);
      if (!cancelled) setMyVisits(v);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!target?.id) { setTheirVisits([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, target.id);
      if (!cancelled) {
        setTheirVisits(v);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [target?.id]);

  /** When user switches sub-tab in via initialTarget, sync local state once. */
  useEffect(() => {
    if (initialTarget && initialTarget.id !== target?.id) {
      setTarget(initialTarget);
    }
  }, [initialTarget?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const compat = useMemo(() => {
    if (!target?.id) return null;
    return pairCompatibility(myVisits, theirVisits);
  }, [myVisits, theirVisits, target?.id]);

  const overlap = useMemo(() => {
    if (!target?.id) return null;
    return restaurantOverlap(myVisits, theirVisits);
  }, [myVisits, theirVisits, target?.id]);

  function clearTarget() {
    setTarget(null);
    onClearTarget?.();
  }

  /** Unfriend lives here (rather than on the flat Friends row) because that
   *  row is now a single click-target → Compare; we keep the destructive
   *  action one drill-down away from the casual scan. */
  async function handleUnfriend() {
    const row = friends.find((f) => f.otherUserId === target?.id);
    if (!row?.id) return;
    await deleteFriendship(supabase, row.id);
    clearTarget();
  }

  if (!target) {
    return (
      <div>
        <p style={{ fontSize: 12, color: "#888780", margin: "0 0 12px" }}>{t.pickFriendToCompare}</p>
        {!friends.length && (
          <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noFriendsYet}</p>
        )}
        {friends.map((f) => (
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
      </div>
    );
  }

  const insufficientMine = (myVisits || []).length === 0;
  const sharedTop = compat ? topSharedCuisines(compat.agreements) : [];
  const summaryLine = sharedTop.length
    ? fmtTemplate(t.youBothLove || "You both love {cuisines}", {
      cuisines: sharedTop.join(t.andSeparator || " and "),
    })
    : null;

  const friendName = target.display_name || target.username || "—";
  const isAcceptedFriend = friends.some((f) => f.otherUserId === target?.id);

  const onlyTheirs = overlap?.onlyTheirs?.slice(0, TOP_DISCOVER_LIMIT) || [];
  const onlyMine = overlap?.onlyMine?.slice(0, TOP_DISCOVER_LIMIT) || [];

  return (
    <div>
      <button
        type="button"
        onClick={clearTarget}
        style={{
          fontSize: 12, color: "#888780", background: "none", border: "none",
          cursor: "pointer", padding: 0, marginBottom: 12,
        }}
      >{t.pickFriendToCompare}</button>

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
            <div style={SECTION_LABEL_STYLE}>{t.bothVisited}</div>
            {overlap.both.length === 0 ? (
              <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.noOverlapYet}</p>
            ) : (
              <>
                <div style={{
                  background: "#1E1E1C", border: "0.5px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, overflow: "hidden",
                }}>
                  {overlap.both.map((r, i) => (
                    <BothRow key={r.placeId} row={r} isLast={i === overlap.both.length - 1} />
                  ))}
                </div>
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
            <div style={SECTION_LABEL_STYLE}>
              {fmtTemplate(t.theyTriedYouHavent || "{name} tried, you haven't", { name: friendName })}
            </div>
            {onlyTheirs.length === 0 ? (
              <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.nothingNewFromThem}</p>
            ) : (
              onlyTheirs.map((r) => (
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
              ))
            )}
          </section>

          <section style={{ marginBottom: 16 }}>
            <div style={SECTION_LABEL_STYLE}>
              {fmtTemplate(t.youTriedTheyHavent || "You tried, {name} hasn't", { name: friendName })}
            </div>
            {onlyMine.length === 0 ? (
              <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>{t.nothingNewFromYou}</p>
            ) : (
              onlyMine.map((r) => (
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
              ))
            )}
          </section>
        </>
      )}

      {isAcceptedFriend && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <Pill onClick={handleUnfriend} tone="danger">{t.unfriend}</Pill>
        </div>
      )}
    </div>
  );
}
