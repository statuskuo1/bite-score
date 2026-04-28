import { useState } from "react";
import { useLang } from "../../contexts/LangContext.jsx";
import { GlobalTab } from "./GlobalTab.jsx";
import { FriendsTab } from "./FriendsTab.jsx";
import { CompareTab } from "./CompareTab.jsx";
import { GroupsTab } from "./GroupsTab.jsx";

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
 */
export function CommunityTab({ user }) {
  const { t } = useLang();
  const [active, setActive] = useState("global");
  const [compareTarget, setCompareTarget] = useState(null);

  function jumpToCompare(friendProfile) {
    setCompareTarget(friendProfile);
    setActive("compare");
  }

  const hint = t[SUBS.find((s) => s.key === active)?.hintKey] || "";

  return (
    <div>
      <div style={{
        display: "flex", background: "#252523", borderRadius: 10, padding: 3,
        gap: 2, marginBottom: 12,
      }}>
        {SUBS.map((s) => {
          const on = active === s.key;
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
              {s.icon} {t[s.labelKey] || s.key}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "#888780", margin: "0 0 12px" }}>{hint}</p>

      {active === "global" && <GlobalTab user={user} />}
      {active === "friends" && (
        <FriendsTab user={user} onCompareWith={jumpToCompare} />
      )}
      {active === "compare" && (
        <CompareTab user={user} initialTarget={compareTarget} onClearTarget={() => setCompareTarget(null)} />
      )}
      {active === "groups" && <GroupsTab user={user} />}
    </div>
  );
}
