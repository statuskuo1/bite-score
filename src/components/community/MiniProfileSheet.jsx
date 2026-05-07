import { useState, useEffect } from "react";
import { supabase } from "../../config/supabaseClient.js";
import { fetchRestaurantVisitsForUser, computeFoodStats } from "../../utils/visitPlacesApi.js";
import { profileStatsCache } from "../../utils/sessionCache.js";
import { normalizeWeights, weightsToPercents } from "../../utils/scoring.js";
import { Avatar } from "./Avatar.jsx";
import { FoodStatsBlock } from "../FoodStatsBlock.jsx";
import { QuestSheetBody } from "../QuestsPaletteSection.jsx";
import { BadgesView } from "../BadgesView.jsx";

/** Small inline badge span — purely informational, no interaction. */
export function StatusBadge({ label, bg, color, border }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
      background: bg, color, border: `1px solid ${border}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

/**
 * Confirmation dialog rendered on top of MiniProfileSheet (or inline in search).
 * `isTasteBuds` changes the message to warn about losing the mutual connection.
 */
export function UnfollowConfirmDialog({ profile, isTasteBuds, busy, onConfirm, onCancel }) {
  const username = profile?.username ? `@${profile.username}` : profile?.display_name || "this person";
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 320,
          background: "#1E1E1C",
          borderRadius: 14,
          border: "0.5px solid rgba(255,255,255,0.15)",
          padding: "20px",
          boxSizing: "border-box",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ fontSize: 14, color: "#F1EFE8", fontWeight: 600, marginBottom: 8 }}>
          Unfollow {username}?
        </div>
        {isTasteBuds && (
          <div style={{ fontSize: 13, color: "#888780", marginBottom: 16, lineHeight: 1.5 }}>
            This will remove your Taste Buds connection.
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: isTasteBuds ? 0 : 16 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 10,
              background: "transparent", border: "0.5px solid rgba(255,255,255,0.2)",
              color: "#C4C2BA", fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 10,
              background: "transparent", border: "1px solid rgba(163,45,45,0.5)",
              color: busy ? "#888780" : "#A32D2D",
              fontSize: 14, fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "…" : "Unfollow"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Bottom-sheet overlay shown when tapping a friend row or a notification.
 * Owns its own stats fetch so callers stay simple.
 *
 * Props:
 *   profile      — the other user's profile object
 *   relation     — "none" | "i_follow" | "they_follow" | "taste_buds"
 *   busy         — bool (follow/unfollow in progress)
 *   cachedVisits — optional pre-fetched visits array (skips the fetch)
 *   onClose      — () => void
 *   onCompareWith — (profile) => void
 *   onUnfollow   — (userId) => void
 *   onFollow     — (userId) => void
 *   onViewLog    — (profile) => void
 *   t            — translations object
 */
export function MiniProfileSheet({ profile, relation, busy, cachedVisits, onClose, onCompareWith, onUnfollow, onFollow, onViewLog, onWeightTap, onEditProfile, onSignOut, t, questL, toggleQ, selfCafes }) {
  const [stats, setStats] = useState(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [freshWeights, setFreshWeights] = useState(null);
  const [rawVisits, setRawVisits] = useState(cachedVisits ?? []);
  const [profileSection, setProfileSection] = useState(null);

  useEffect(() => {
    if (!profile?.id) { setStats(null); setFreshWeights(null); return; }
    let cancelled = false;

    // For self, caller injects current React-state weights into the profile prop — skip DB fetch.
    // For others, fetch fresh weights so we always show current values, not stale feed-load data.
    if (relation !== "self") {
      supabase
        .from("profiles")
        .select("pref_weight_taste, pref_weight_bpb, pref_weight_wait")
        .eq("id", profile.id)
        .maybeSingle()
        .then(({ data }) => { if (!cancelled && data) setFreshWeights(data); });
    }

    if (cachedVisits) {
      setRawVisits(cachedVisits);
      const s = computeFoodStats(cachedVisits);
      setStats(s);
      profileStatsCache.set(profile.id, s);
      return;
    }
    if (profileStatsCache.has(profile.id)) {
      setStats(profileStatsCache.get(profile.id));
      return;
    }
    setStats(null);
    setFreshWeights(null);
    (async () => {
      const v = await fetchRestaurantVisitsForUser(supabase, profile.id);
      const s = computeFoodStats(v);
      if (!cancelled) {
        setRawVisits(v);
        setStats(s);
        profileStatsCache.set(profile.id, s);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, cachedVisits, relation]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!profile) return null;

  const name = profile.display_name || profile.username || "—";
  const canCompare = relation === "taste_buds" || relation === "i_follow";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.78)",
          zIndex: 320,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 360,
            background: "#1E1E1C",
            borderRadius: 16,
            border: "0.5px solid rgba(255,255,255,0.15)",
            padding: "1.35rem",
            boxSizing: "border-box",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            overflowY: "auto",
            maxHeight: "90vh",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ fontSize: 22, color: "#888780", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}
            >×</button>
          </div>

          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
              <Avatar profile={profile} size={56} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8", lineHeight: 1.2 }}>
              {name}
            </div>
            <div style={{ fontSize: 13, color: "#C4C2BA", marginTop: 3 }}>
              @{profile.username || "–"}
            </div>
            {relation === "self" && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                {[["quests", "🗺 Quests", "#EF9F27", "rgba(239,159,39,0.3)", "#2A1E05"],
                  ["badges", "🏅 Badges", "#AFA9EC", "rgba(175,169,236,0.3)", "#1E1A3A"]].map(([key, lbl, color, border, bg]) => (
                  <button key={key} type="button" onClick={() => setProfileSection(key)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                      background: bg, color, border: `1px solid ${border}`,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                    {lbl}
                  </button>
                ))}
              </div>
            )}
            {relation !== "self" && (relation === "taste_buds" || relation === "i_follow") && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                {relation === "taste_buds" && (
                  <StatusBadge
                    label={t.tasteBuds || "Taste Buds"}
                    bg="#1A2E0A" color="#97C459" border="rgba(151,196,89,0.4)"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setConfirmUnfollow(true)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                    background: "rgba(155,169,213,0.1)", color: "#9BA9D5",
                    border: "1px solid rgba(155,169,213,0.3)",
                    cursor: "pointer",
                  }}
                >
                  {t.following || "Following"}
                </button>
              </div>
            )}
            {relation !== "self" && relation === "they_follow" && (
              <div style={{ marginTop: 8 }}>
                <StatusBadge label="Follows you" bg="#252523" color="#888780" border="rgba(255,255,255,0.15)" />
              </div>
            )}
          </div>

          <FoodStatsBlock stats={stats} style={{ marginBottom: 8 }} />

          {(() => {
            const src = freshWeights ?? profile;
            const w = normalizeWeights({
              taste: src?.pref_weight_taste,
              bpb:   src?.pref_weight_bpb,
              wait:  src?.pref_weight_wait,
            });
            const p = weightsToPercents(w);
            const isSelf = relation === "self";
            const label = isSelf ? "Your BITE weights" : "Their BITE weights";
            const cells = [
              { pct: p.taste, key: "taste", name: "Taste",  color: "#F0997B" },
              { pct: p.bpb,   key: "bpb",   name: "Value",  color: "#5B9BD5" },
              { pct: p.wait,  key: "wait",   name: "Wait",   color: "#97C459" },
            ];
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {cells.map(({ pct, key, name, color }) => (
                    <div
                      key={key}
                      onClick={onWeightTap || undefined}
                      style={{
                        flex: 1, textAlign: "center", background: "#252523", borderRadius: 8, padding: "7px 4px",
                        cursor: onWeightTap ? "pointer" : "default",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, color }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>{name}</div>
                    </div>
                  ))}
                </div>
                {onWeightTap && (
                  <div style={{ fontSize: 10, color: "#666663", textAlign: "center", marginTop: 5 }}>
                    tap any weight to adjust
                  </div>
                )}
              </div>
            );
          })()}

          {relation === "self" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onEditProfile}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 10,
                  background: "#3C1F13", border: "1px solid rgba(240,153,123,0.4)",
                  color: "#F0997B", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Edit profile
              </button>
              <button
                type="button"
                onClick={onSignOut}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 10,
                  background: "transparent", border: "0.5px solid rgba(255,255,255,0.2)",
                  color: "#C4C2BA", fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                {t?.signOut || "Sign out"}
              </button>
            </div>
          ) : (relation === "i_follow" || relation === "taste_buds") ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => { onViewLog?.({ ...profile, ...(freshWeights ?? {}) }); onClose?.(); }}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 10,
                  background: "#3C1F13", border: "1px solid rgba(240,153,123,0.4)",
                  color: "#F0997B", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                {t.viewLog || "View log"}
              </button>
              {canCompare && (
                <button
                  type="button"
                  onClick={() => { onCompareWith?.(profile); onClose?.(); }}
                  style={{
                    flex: 1, padding: "12px 14px", borderRadius: 10,
                    background: "transparent", border: "0.5px solid rgba(255,255,255,0.2)",
                    color: "#C4C2BA", fontSize: 14, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  {t.compareSub || "Compare"}
                </button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#888780", margin: "0 0 10px" }}>
                {t.followToSeeLog || "Follow to see their log"}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => onFollow?.(profile.id)}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  background: "#F0997B", border: "none",
                  color: "#141413", fontSize: 14, fontWeight: 600,
                  cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? "…" : (t.follow || "Follow")}
              </button>
            </div>
          )}
        </div>

      </div>

      {profileSection && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 400,
          display: "flex", justifyContent: "center",
        }}>
          <div style={{
            width: "100%", maxWidth: 640,
            background: "#141413",
            display: "flex", flexDirection: "column",
            height: "100%",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.1)",
              flexShrink: 0,
            }}>
              <button type="button" onClick={() => setProfileSection(null)}
                style={{ fontSize: 20, color: "#888780", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                ←
              </button>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8" }}>
                {profileSection === "quests" ? "🗺 Quests" : "🏅 Badges"}
              </span>
            </div>
            <div style={{ flex: 1, padding: "16px 16px 32px", overflowY: "auto" }}>
              {profileSection === "quests" && (
                <QuestSheetBody
                  entries={rawVisits}
                  questL={questL || new Set()}
                  toggleQ={toggleQ || (() => {})}
                  onSuggestClick={null}
                />
              )}
              {profileSection === "badges" && (
                <BadgesView
                  entries={rawVisits}
                  cafes={selfCafes || []}
                  weights={normalizeWeights({ taste: profile?.pref_weight_taste, bpb: profile?.pref_weight_bpb, wait: profile?.pref_weight_wait })}
                  questL={questL || new Set()}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {confirmUnfollow && (
        <UnfollowConfirmDialog
          profile={profile}
          isTasteBuds={relation === "taste_buds"}
          busy={busy}
          onConfirm={() => { onUnfollow?.(profile.id); setConfirmUnfollow(false); }}
          onCancel={() => setConfirmUnfollow(false)}
        />
      )}
    </>
  );
}
