import { useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { PlaceStatsSheet } from "./PlaceStatsSheet.jsx";
import {
  calcBiteOutOf10,
  calcCafeOutOf10,
  normalizeWeights,
  weightsToPercents,
  scoreColor,
  scoreLabel,
} from "../../utils/scoring.js";
import { CURRENCY_SYMBOLS } from "../../utils/currency.js";
import { FLAGS } from "../../constants/cuisineConstants.js";
import { Avatar } from "./Avatar.jsx";
import { addWantToGo, removeWantToGo } from "../../utils/wantToGoApi.js";
import { supabase } from "../../config/supabaseClient.js";

/**
 * Single feed card — a unified post for restaurant + cafe visits.
 *
 * Score display:
 *   - Primary chip: poster's own BITE (computed from their stored weights)
 *   - Below chip:   "You scored X.X" (if viewer has logged this place)
 *                   "You'd score X.X" (otherwise — poster's inputs through viewer's weights)
 */

const HEART_RED = "#E85A5A";
const ACCENT_ORANGE = "#F0997B";
const SUBTLE_BG = "#252523";
const CARD_BG = "#1E1E1C";
const BORDER = "0.5px solid rgba(255,255,255,0.08)";

const REACTOR_AVATAR_LIMIT = 3;
const COD_INER_AVATAR_LIMIT = 3;

const NO_DECIMALS = new Set(["JPY", "KRW", "VND", "IDR"]);

const REPEAT_LABEL_BY_RATING = {
  3: "Must return",
  2: "Would seek out",
  1: "If occasion calls",
};

function relativeDate(iso) {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const now = new Date();
  const then = new Date(ts);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatCostInline(amount, code) {
  if (!Number.isFinite(amount)) return null;
  const sym = CURRENCY_SYMBOLS[code || "USD"] || "$";
  const decimals = NO_DECIMALS.has(code) ? 0 : (Number.isInteger(amount) ? 0 : 2);
  return `${sym} ${amount.toFixed(decimals)}`;
}

function flagFor(post) {
  if (post.kind === "rest") return FLAGS[post.cuisine] || "🍽";
  if (post.category === "Sweets") return "🍰";
  if (post.category === "Tea") return "🍵";
  return "☕";
}

function subtitle(post) {
  const middle = post.kind === "rest" ? post.cuisine : post.category;
  return [middle, post.city].filter(Boolean).join(" · ");
}

function authorProfile(post) {
  return {
    id: post.ownerId,
    username: post.authorUsername,
    display_name: post.authorDisplayName,
    avatar_url: post.authorAvatarUrl,
    pref_weight_taste: post.authorWeightTaste,
    pref_weight_bpb: post.authorWeightBpb,
    pref_weight_wait: post.authorWeightWait,
  };
}

function computeScore(post, restaurantWeights, drinkWeights, sweetWeights) {
  if (post.kind === "rest") {
    return calcBiteOutOf10(
      post.taste, post.cost, post.portions, post.wait,
      post.useR, post.repeatability,
      restaurantWeights, post.currency_code,
    );
  }
  const wts = post.category === "Sweets" ? sweetWeights : drinkWeights;
  return calcCafeOutOf10(
    post.taste, post.cost, post.portions, post.wait || 0,
    post.useR, post.repeatability,
    wts, post.currency_code,
  );
}

/** Short description of a weight distribution for the lens label. */
function weightLens(pcts) {
  if (pcts.taste >= 60) return "taste-heavy";
  if (pcts.bpb >= 40) return "value-focused";
  if (pcts.wait >= 25) return "wait-sensitive";
  return "balanced";
}

function Pill({ icon, children, color }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 10px",
      borderRadius: 999,
      background: SUBTLE_BG,
      border: BORDER,
      fontSize: 12,
      color: color || "#C4C2BA",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    }}>
      {icon && <span style={{ fontSize: 11, opacity: 0.85 }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

function RepeatPill({ rating, useR }) {
  if (!useR) return null;
  if (rating === 0) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        background: SUBTLE_BG,
        border: "0.5px solid rgba(232,90,90,0.3)",
        fontSize: 12,
        color: HEART_RED,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}>
        <span style={{ fontSize: 11 }}>×</span>
        <span>wouldn't return</span>
      </span>
    );
  }
  if (![1, 2, 3].includes(rating)) return null;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 1,
      padding: "5px 10px",
      borderRadius: 999,
      background: SUBTLE_BG,
      border: BORDER,
      fontSize: 12,
      color: "#EFB347",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
      letterSpacing: 1,
    }} title={REPEAT_LABEL_BY_RATING[rating]}>
      {"★".repeat(rating)}
    </span>
  );
}

function AvatarStack({ profiles, size = 20, max = 3 }) {
  const visible = (profiles || []).slice(0, max);
  if (!visible.length) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      {visible.map((p, i) => (
        <span
          key={p.id}
          style={{
            marginLeft: i === 0 ? 0 : -8,
            border: "1.5px solid #1E1E1C",
            borderRadius: "50%",
            display: "inline-flex",
            position: "relative",
            zIndex: visible.length - i,
          }}
        >
          <Avatar profile={p} size={size} />
        </span>
      ))}
    </span>
  );
}

function firstName(profile) {
  const dn = profile?.display_name || profile?.username || "";
  return dn.split(/\s+/)[0] || dn || "Someone";
}

/**
 * Heart-row summary as discrete parts so the trailing "N other(s)" token
 * can be wrapped in a clickable span. The `othersToken` (if non-null) is
 * the substring the OthersListSheet trigger should attach to.
 *
 * Shapes:
 *   no profiles, count > 0 → ["3 hearts"]                 (no trigger)
 *   1 reactor              → ["FirstName"]                (no trigger)
 *   2 reactors             → ["FirstName", "+", "1 other"]   (trigger on tail)
 *   3+ reactors            → ["FirstName", "+", "N others"]  (trigger on tail)
 */
function reactorSummaryParts(reactors, count) {
  if (!count) return { parts: [], othersToken: null };
  if (!reactors?.length) {
    return { parts: [`${count} ${count === 1 ? "heart" : "hearts"}`], othersToken: null };
  }
  const first = firstName(reactors[0]);
  const others = count - 1;
  if (others <= 0) return { parts: [first], othersToken: null };
  const tail = others === 1 ? "1 other" : `${others} others`;
  return { parts: [first, "+", tail], othersToken: tail };
}

/**
 * Hoist the viewer to index 0 in a co-diner list when present, so the
 * AvatarStack and the dined-with text both read "you first". Returns the
 * input untouched when the viewer isn't tagged.
 */
function viewerFirst(profiles, viewerId) {
  if (!viewerId || !profiles?.length) return profiles || [];
  const idx = profiles.findIndex((p) => p?.id === viewerId);
  if (idx <= 0) return profiles;
  const reordered = [...profiles];
  const [self] = reordered.splice(idx, 1);
  reordered.unshift(self);
  return reordered;
}

/**
 * Dined-with summary as discrete parts so the renderer can choose
 * affordances per token. Each part is one of:
 *
 *   { kind: "name",   text, profile }   — tappable, opens MiniProfileSheet
 *   { kind: "you",    text: "you" }     — plain accent (viewer self; not tappable)
 *   { kind: "and",    text: "and" }     — grey literal separator
 *   { kind: "others", text: "N others" } — tappable, opens OthersListSheet
 *
 * Viewer-included rules:
 *   1 (just viewer)        → "you"
 *   2 (viewer + 1 other)   → "you and Name"
 *   3+ (viewer + 2+ others)→ "you and N others"   (N = profiles.length - 1)
 *
 * Viewer-not-included rules (existing behavior):
 *   1 → "Name"
 *   2 → "Name1 and Name2"
 *   3+→ "Name1 Name2 and N others"
 */
function dinedWithSummary(profiles, viewerId) {
  if (!profiles?.length) return { parts: null, othersToken: null };
  const youIdx = viewerId ? profiles.findIndex((p) => p?.id === viewerId) : -1;
  const others = youIdx >= 0
    ? profiles.filter((_, i) => i !== youIdx)
    : profiles;

  if (youIdx >= 0) {
    if (others.length === 0) {
      return { parts: [{ kind: "you", text: "you" }], othersToken: null };
    }
    if (others.length === 1) {
      return {
        parts: [
          { kind: "you", text: "you" },
          { kind: "and", text: "and" },
          { kind: "name", text: firstName(others[0]), profile: others[0] },
        ],
        othersToken: null,
      };
    }
    const tail = `${others.length} others`;
    return {
      parts: [
        { kind: "you", text: "you" },
        { kind: "and", text: "and" },
        { kind: "others", text: tail },
      ],
      othersToken: tail,
    };
  }

  if (others.length === 1) {
    return {
      parts: [{ kind: "name", text: firstName(others[0]), profile: others[0] }],
      othersToken: null,
    };
  }
  if (others.length === 2) {
    return {
      parts: [
        { kind: "name", text: firstName(others[0]), profile: others[0] },
        { kind: "and", text: "and" },
        { kind: "name", text: firstName(others[1]), profile: others[1] },
      ],
      othersToken: null,
    };
  }
  const tail = `${others.length - 2} others`;
  return {
    parts: [
      { kind: "name", text: firstName(others[0]), profile: others[0] },
      { kind: "name", text: firstName(others[1]), profile: others[1] },
      { kind: "and", text: "and" },
      { kind: "others", text: tail },
    ],
    othersToken: tail,
  };
}

function HeartIcon({ filled, size = 16 }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path
          fill={HEART_RED}
          d="M12 21s-7.5-4.6-9.7-9.4C.7 7.5 3.5 3 7.6 3c2.2 0 3.6 1.2 4.4 2.4C12.8 4.2 14.2 3 16.4 3c4.1 0 6.9 4.5 5.3 8.6C19.5 16.4 12 21 12 21z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        fill="none"
        stroke="#888780"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M12 20.5s-7-4.3-9.1-8.8C1.3 7.7 3.7 3.7 7.4 3.7c2 0 3.4 1.1 4.1 2.2C12.2 4.8 13.6 3.7 15.6 3.7c3.7 0 6.1 4 4.5 8c-2.1 4.5-9.1 8.8-9.1 8.8z"
      />
    </svg>
  );
}

export function FeedPostRow({
  post,
  restaurantWeights,
  drinkWeights,
  sweetWeights,
  viewerVisitedIds,
  viewerId,
  coDiners,
  reactionState,
  reactionBusy,
  onOpenProfile,
  onToggleHeart,
  onOpenOthers,
}) {
  const { t } = useLang();
  const [showStats, setShowStats] = useState(false);
  const [wantedToGo, setWantedToGo] = useState(false);

  const author = authorProfile(post);

  const posterWeights = normalizeWeights({
    taste: post.authorWeightTaste,
    bpb: post.authorWeightBpb,
    wait: post.authorWeightWait,
  });
  const posterPcts = weightsToPercents(posterWeights);

  // Primary score: poster's BITE using their own weights
  const posterScore = computeScore(post, posterWeights, posterWeights, posterWeights);

  // Secondary score: poster's raw inputs through viewer's weights
  const viewerScore = computeScore(post, restaurantWeights, drinkWeights, sweetWeights);

  const primaryScore = posterScore ?? viewerScore;
  const primaryCol = primaryScore == null ? "#888780" : scoreColor(primaryScore);
  const primaryTier = primaryScore == null ? "" : scoreLabel(primaryScore, t);

  const hasBeenHere = !!(post.placeId && viewerVisitedIds?.has(post.placeId));

  const cost = formatCostInline(post.cost, post.currency_code);
  const tasteVal = Number.isFinite(post.taste) ? post.taste.toFixed(1) : null;
  const wait = Number.isFinite(post.wait) ? post.wait : 0;

  /** Reorder co-diners so the viewer is first when tagged — both the
   *  AvatarStack (slices [0..3]) and the dined-with text read "you" up
   *  front, matching the new copy rules. */
  const orderedDiners = viewerFirst(coDiners, viewerId);
  const dinedWith = dinedWithSummary(orderedDiners, viewerId);
  const heartCount = reactionState?.count || 0;
  const heartMine = !!reactionState?.mine;
  const reactors = reactionState?.reactors || [];
  const reactorSum = reactorSummaryParts(reactors, heartCount);

  const headerInteractive = typeof onOpenProfile === "function";
  const heartInteractive = typeof onToggleHeart === "function";
  const othersInteractive = typeof onOpenOthers === "function";
  const profileInteractive = typeof onOpenProfile === "function";

  /** Inline accent style for the clickable "N others" tokens — accent-orange
   *  with a dotted underline + pointer to signal interactivity. The named
   *  tappable tokens reuse this so all interactive copy in the row shares
   *  one affordance. */
  const tappableAccentStyle = {
    color: ACCENT_ORANGE,
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationStyle: "dotted",
    textUnderlineOffset: 2,
  };

  return (
    <div style={{
      background: CARD_BG,
      border: BORDER,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      width: "100%",
      boxSizing: "border-box",
      overflow: "hidden",
    }}>
      {/* Header: author (clickable) + been/want badge on the right */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div
          onClick={headerInteractive ? () => onOpenProfile(author) : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            flex: 1, minWidth: 0,
            cursor: headerInteractive ? "pointer" : "default",
          }}
        >
          <Avatar profile={author} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: "#F1EFE8",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {author.display_name || author.username || "—"}
            </div>
            <div style={{ fontSize: 11, color: "#888780", marginTop: 1 }}>
              {relativeDate(post.visitedAt)}
            </div>
            <div style={{ fontSize: 10, color: "#666663", marginTop: 1 }}>
              {weightLens(posterPcts)} · T {posterPcts.taste}% · BpB {posterPcts.bpb}%
            </div>
          </div>
        </div>

        {/* Been / want-to-go badge */}
        {post.placeId && (
          hasBeenHere ? (
            <span style={{ fontSize: 11, color: "#7DBF8E", fontWeight: 500, flexShrink: 0 }}>
              ✓ been
            </span>
          ) : (
            <button
              type="button"
              onClick={async () => {
                if (!viewerId) return;
                if (wantedToGo) {
                  setWantedToGo(false);
                  await removeWantToGo(supabase, viewerId, { placeId: post.placeId, kind: post.kind });
                } else {
                  setWantedToGo(true);
                  await addWantToGo(supabase, viewerId, {
                    placeId: post.placeId, kind: post.kind,
                    name: post.name, cuisine: post.cuisine || post.category, city: post.city,
                  });
                }
              }}
              style={{
                fontSize: 11,
                color: wantedToGo ? "#7DBF8E" : ACCENT_ORANGE,
                background: "none", border: "none",
                cursor: "pointer",
                padding: 0, fontWeight: 500, flexShrink: 0,
              }}
            >
              {wantedToGo ? "✓ saved" : "＋ want to go"}
            </button>
          )
        )}
      </div>

      {/* Place row */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 38, lineHeight: 1, flexShrink: 0 }}>
          {flagFor(post)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={() => post.placeId && setShowStats(true)}
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#F1EFE8",
              lineHeight: 1.2,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              cursor: post.placeId ? "pointer" : "default",
            }}
          >
            {post.name || "—"}
          </div>
          <div style={{
            fontSize: 12,
            color: "#888780",
            marginTop: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {subtitle(post)}
          </div>
        </div>

        {/* Score chip: poster's BITE only */}
        <div style={{
          flexShrink: 0,
          padding: "8px 12px",
          borderRadius: 10,
          background: SUBTLE_BG,
          textAlign: "center",
          minWidth: 64,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: primaryCol, lineHeight: 1 }}>
            {primaryScore == null ? "—" : primaryScore.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, color: primaryCol, marginTop: 4, opacity: 0.9 }}>
            {primaryTier || "BITE"}
          </div>
        </div>
      </div>

      {/* Pills + viewer's estimated BITE on the same row, est aligned under the score chip */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1, minWidth: 0 }}>
          {tasteVal && <Pill icon="✦">{tasteVal} taste</Pill>}
          {cost && <Pill>{cost}</Pill>}
          <Pill icon="⏱">{wait} min</Pill>
          <RepeatPill rating={post.repeatability} useR={post.useR} />
        </div>
        {viewerScore != null && (
          <div style={{
            fontSize: 11,
            color: "#888780",
            flexShrink: 0,
            textAlign: "right",
            paddingTop: 6,
            lineHeight: 1.2,
          }}>
            your est. BITE: {viewerScore.toFixed(1)}
          </div>
        )}
      </div>

      {/* Dined with */}
      {dinedWith.parts && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          borderRadius: 10,
          background: SUBTLE_BG,
          border: BORDER,
          marginBottom: post.notes ? 12 : 0,
        }}>
          <AvatarStack profiles={orderedDiners} size={20} max={COD_INER_AVATAR_LIMIT} />
          <div style={{
            fontSize: 12,
            color: "#C4C2BA",
            minWidth: 0,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            <span style={{ color: "#888780" }}>dined with </span>
            {dinedWith.parts.map((part, i) => {
              const trailing = i < dinedWith.parts.length - 1 ? " " : "";

              if (part.kind === "name") {
                const tappable = profileInteractive && !!part.profile;
                return (
                  <span
                    key={i}
                    onClick={tappable ? (e) => {
                      e.stopPropagation();
                      onOpenProfile(part.profile);
                    } : undefined}
                    style={tappable
                      ? tappableAccentStyle
                      : { color: ACCENT_ORANGE, fontWeight: 500 }}
                  >
                    {part.text}{trailing}
                  </span>
                );
              }

              if (part.kind === "others") {
                const tappable = othersInteractive;
                return (
                  <span
                    key={i}
                    onClick={tappable ? (e) => {
                      e.stopPropagation();
                      onOpenOthers({
                        kind: "co_diners",
                        post,
                        profiles: orderedDiners,
                        title: "Dined with",
                      });
                    } : undefined}
                    style={tappable
                      ? tappableAccentStyle
                      : { color: ACCENT_ORANGE, fontWeight: 500 }}
                  >
                    {part.text}{trailing}
                  </span>
                );
              }

              if (part.kind === "and") {
                return (
                  <span key={i} style={{ color: "#888780", fontWeight: 400 }}>
                    {part.text}{trailing}
                  </span>
                );
              }

              // "you" — plain accent text, not tappable (it's the viewer)
              return (
                <span key={i} style={{ color: ACCENT_ORANGE, fontWeight: 500 }}>
                  {part.text}{trailing}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {post.notes && (
        <div style={{
          fontSize: 13,
          fontStyle: "italic",
          color: "#C4C2BA",
          lineHeight: 1.5,
          marginTop: 4,
          wordBreak: "break-word",
        }}>
          "{post.notes}"
        </div>
      )}

      {/* Reactions */}
      <div style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: BORDER,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        {heartInteractive ? (
          <button
            type="button"
            onClick={() => onToggleHeart(post)}
            disabled={reactionBusy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px",
              background: "none",
              border: "none",
              cursor: reactionBusy ? "wait" : "pointer",
              color: heartCount ? "#F1EFE8" : "#888780",
              fontSize: 13,
              fontWeight: 500,
              opacity: reactionBusy ? 0.6 : 1,
              flexShrink: 0,
            }}
            aria-label={heartMine ? "Unheart" : "Heart"}
          >
            <HeartIcon filled={heartMine} size={18} />
            {heartCount > 0 && <span>{heartCount}</span>}
          </button>
        ) : (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 6px",
            color: heartCount ? "#F1EFE8" : "#888780",
            fontSize: 13,
            fontWeight: 500,
            flexShrink: 0,
          }}>
            <HeartIcon filled={heartMine || heartCount > 0} size={18} />
            {heartCount > 0 && <span>{heartCount}</span>}
          </span>
        )}
        {heartCount > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            minWidth: 0,
          }}>
            <AvatarStack profiles={reactors} size={20} max={REACTOR_AVATAR_LIMIT} />
            <span style={{
              fontSize: 12,
              color: "#888780",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}>
              {reactorSum.parts.map((part, i) => {
                const isOthersToken = othersInteractive && part === reactorSum.othersToken;
                return (
                  <span
                    key={i}
                    onClick={isOthersToken ? (e) => {
                      e.stopPropagation();
                      onOpenOthers({
                        kind: "reactors",
                        post,
                        profiles: reactors,
                        title: "Hearts",
                      });
                    } : undefined}
                    style={isOthersToken ? tappableAccentStyle : undefined}
                  >
                    {part}
                    {i < reactorSum.parts.length - 1 ? " " : ""}
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>

      {showStats && post.placeId && (
        <PlaceStatsSheet
          post={post}
          restaurantWeights={restaurantWeights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}
