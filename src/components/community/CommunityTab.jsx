import { useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { GlobalTab } from "./GlobalTab.jsx";
import { FriendsTab } from "./FriendsTab.jsx";
import { CompareTab } from "./CompareTab.jsx";
import { GroupsTab } from "./GroupsTab.jsx";
import { UserLogView } from "./UserLogView.jsx";

const SUBS = [
  { key: "global", labelKey: "globalSub", hintKey: "communityHintGlobal", icon: "🌐" },
  { key: "friends", labelKey: "friendsSub", hintKey: "communityHintFriends", icon: "👥" },
  { key: "compare", labelKey: "compareSub", hintKey: "communityHintCompare", icon: "🪞" },
  { key: "groups", labelKey: "groupsSub", hintKey: "communityHintGroups", icon: "🎉" },
];

/**
 * Community sub-tab router.
 *
 * `compareTarget` lets one tab hand off a friend to Compare (e.g. "Compare with"
 * button on a friend card jumps into Compare with that friend pre-selected).
 *
 * `restaurantWeights` / `drinkWeights` / `sweetWeights` flow through to
 * GlobalTab so its mean-then-BITE leaderboard reflects the viewer's own My
 * Taste sliders. The other sub-tabs don't read weights today.
 */
export function CommunityTab({ user, restaurantWeights, drinkWeights, sweetWeights, unseenFollowers = 0, onMarkFollowersSeen, onFollowChange }) {
  const { t } = useLang();
  const [active, setActive] = useState("global");
  const [compareTarget, setCompareTarget] = useState(null);
  /** When set, the read-only `UserLogView` takes over the Community surface
   *  until the user taps Back. The sub-tab strip and `active` selection are
   *  preserved underneath so we land back on Friends on dismissal. */
  const [userLogTarget, setUserLogTarget] = useState(null);

  function jumpToCompare(friendProfile) {
    setCompareTarget(friendProfile);
    setActive("compare");
  }

  const hint = t[SUBS.find((s) => s.key === active)?.hintKey] || "";

  if (userLogTarget) {
    return (
      <UserLogView
        user={user}
        targetProfile={userLogTarget}
        restaurantWeights={restaurantWeights}
        onBack={() => setUserLogTarget(null)}
      />
    );
  }

  return (
    <div>
      <div style={{
        display: "flex", background: "#252523", borderRadius: 10, padding: 3,
        gap: 2, marginBottom: 12,
      }}>
        {SUBS.map((s) => {
          const on = active === s.key;
          const badge = s.key === "friends" && unseenFollowers > 0 ? unseenFollowers : 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              style={{
                flex: 1, padding: "6px 0", textAlign: "center", borderRadius: 8,
                border: "none",
                background: on ? "#3C1F13" : "transparent",
                color: on ? "#F0997B" : "#888780",
                fontSize: 11, fontWeight: on ? 700 : 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {s.icon} {t[s.labelKey] || s.key}
                {badge > 0 && (
                  <span style={{
                    minWidth: 16, height: 16, padding: "0 4px",
                    borderRadius: 8, background: "#E85A5A",
                    color: "#FFF", fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1, boxSizing: "border-box",
                  }}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "#888780", margin: "0 0 12px" }}>{hint}</p>

      {active === "global" && (
        <GlobalTab
          user={user}
          restaurantWeights={restaurantWeights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
        />
      )}
      {active === "friends" && (
        <FriendsTab
          user={user}
          onCompareWith={jumpToCompare}
          onMarkFollowersSeen={onMarkFollowersSeen}
          onFollowChange={onFollowChange}
          onViewLog={setUserLogTarget}
        />
      )}
      {active === "compare" && (
        <CompareTab user={user} initialTarget={compareTarget} onClearTarget={() => setCompareTarget(null)} onFollowChange={onFollowChange} />
      )}
      {active === "groups" && <GroupsTab user={user} />}
    </div>
  );
}
