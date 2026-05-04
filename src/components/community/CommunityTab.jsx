import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLang } from "../../contexts/LangContext.jsx";
import { FeedTab } from "./FeedTab.jsx";
import { PeopleTab } from "./PeopleTab.jsx";
import { ExploreTab } from "./ExploreTab.jsx";
import { CompareTab } from "./CompareTab.jsx";
import { UserLogView } from "./UserLogView.jsx";

/** Top-strip sub-tabs (Compare lives at /community/compare but is intentionally
 *  not in the strip — it's reached by tapping a user → MiniProfileSheet → Compare). */
const SUBS = [
  { key: "feed", labelKey: "feedSub", hintKey: "communityHintFeed", icon: "📣" },
  { key: "people", labelKey: "peopleSub", hintKey: "communityHintPeople", icon: "👥" },
  { key: "explore", labelKey: "exploreSub", hintKey: "communityHintExplore", icon: "🔍" },
];

const DEFAULT_TAB = "feed";

function GuestPreview({ message, onSignIn, children }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
        <p style={{ fontSize:13, color:"#C4C2BA", margin:0, lineHeight:1.5 }}>{message}</p>
        <button type="button" onClick={onSignIn} style={{ padding:"8px 20px", borderRadius:8, border:"none", background:"#F0997B", color:"#141413", fontSize:13, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
          Sign In
        </button>
      </div>
      <div style={{ opacity:0.3, pointerEvents:"none", userSelect:"none" }}>
        {children}
      </div>
    </div>
  );
}

function PeopleMockup() {
  const FRIENDS = [
    { init:"A", color:"#5B9BD5", name:"Alex Chen",    handle:"alexc",    badge:"Taste Buds", compat:91 },
    { init:"J", color:"#97C459", name:"Jordan Kim",   handle:"jordank",  badge:"Following",  compat:78 },
    { init:"M", color:"#EF9F27", name:"Maya Patel",   handle:"mayap",    badge:"Taste Buds", compat:65 },
  ];
  const rowStyle = { display:"flex", alignItems:"center", gap:10, padding:"8px 10px", marginBottom:6, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:10 };
  const sectionLabel = { fontSize:11, color:"#F0997B", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600, marginBottom:6 };
  return (
    <div>
      <div style={{ display:"flex", background:"#252523", borderRadius:10, padding:3, gap:2, marginBottom:12 }}>
        {[["following","👤 Following"],["discover","🔍 Discover"],["groups","🎉 Groups"]].map(([v,l])=>(
          <button key={v} style={{ flex:1, padding:"6px 0", textAlign:"center", borderRadius:8, border:"none", background:v==="following"?"#3C1F13":"transparent", color:v==="following"?"#F0997B":"#888780", fontSize:11, fontWeight:v==="following"?700:500, cursor:"pointer" }}>{l}</button>
        ))}
      </div>
      <div style={sectionLabel}>Taste Buds · 3</div>
      {FRIENDS.map(f => (
        <div key={f.handle} style={rowStyle}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:f.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#141413", flexShrink:0 }}>{f.init}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:"#F1EFE8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
            <div style={{ fontSize:11, color:"#888780" }}>@{f.handle}</div>
          </div>
          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#3C1F13", color:"#F0997B", border:"0.5px solid rgba(240,153,123,0.3)" }}>{f.badge}</span>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"rgba(91,155,213,0.12)", color:"#5B9BD5", border:"0.5px solid rgba(91,155,213,0.25)" }}>{f.compat}% match</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExploreMockup() {
  const ROWS = [
    { flag:"🇮🇹", name:"Lilia",             cuisine:"Italian",        city:"New York City", bite:"9.14", label:"Exceptional",  color:"#97C459" },
    { flag:"🍕",   name:"Lucali",            cuisine:"Italian",        city:"New York City", bite:"8.82", label:"Exceptional",  color:"#97C459" },
    { flag:"🇯🇵", name:"Raku",              cuisine:"Japanese",       city:"New York City", bite:"8.47", label:"Worth It",     color:"#5B9BD5" },
    { flag:"🇮🇹", name:"Don Angie",         cuisine:"Italian",        city:"New York City", bite:"8.31", label:"Worth It",     color:"#5B9BD5" },
    { flag:"🇺🇸", name:"Ugly Bagel",        cuisine:"American",       city:"New York City", bite:"7.95", label:"Solid Pick",   color:"#EF9F27" },
  ];
  return (
    <div>
      <div style={{ display:"flex", background:"#252523", borderRadius:10, padding:3, gap:2, marginBottom:12 }}>
        {[["top-picks","⭐ Top Picks"],["global","🌐 Global"]].map(([v,l])=>(
          <button key={v} style={{ flex:1, padding:"6px 0", textAlign:"center", borderRadius:8, border:"none", background:v==="top-picks"?"#3C1F13":"transparent", color:v==="top-picks"?"#F0997B":"#888780", fontSize:11, fontWeight:v==="top-picks"?700:500, cursor:"pointer" }}>{l}</button>
        ))}
      </div>
      {ROWS.map(r => (
        <div key={r.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", marginBottom:6, background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:10 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:"#252523", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{r.flag}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:"#F1EFE8", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
            <div style={{ fontSize:11, color:"#888780" }}>{r.cuisine} · {r.city}</div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:r.color }}>{r.bite}</div>
            <div style={{ fontSize:10, color:r.color, opacity:0.8 }}>{r.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedMockup() {
  const POSTS = [
    { init:"A", color:"#5B9BD5", name:"Alex Chen",  ago:"2h ago",  flag:"🇮🇹", rest:"Lilia",      sub:"Italian · NYC",  bite:"9.14", biteCol:"#97C459", label:"Exceptional", taste:"9.2", cost:"$120", wait:"25", hearts:3, notes:"best pasta in NYC, no contest" },
    { init:"J", color:"#97C459", name:"Jordan Kim", ago:"5h ago",  flag:"🇺🇸", rest:"Ugly Bagel", sub:"American · NYC", bite:"7.95", biteCol:"#5B9BD5", label:"Worth It",    taste:"8.5", cost:"$22",  wait:"10", hearts:1, notes:"server was fire!" },
    { init:"M", color:"#EF9F27", name:"Maya Patel", ago:"Yesterday",flag:"🇯🇵", rest:"Raku",       sub:"Japanese · NYC", bite:"8.47", biteCol:"#5B9BD5", label:"Worth It",    taste:"8.7", cost:"$75",  wait:"20", hearts:5, notes:null },
  ];
  const pill = { padding:"3px 8px", borderRadius:20, background:"#252523", border:"0.5px solid rgba(255,255,255,0.08)", fontSize:11, color:"#C4C2BA" };
  return (
    <div>
      {POSTS.map(p => (
        <div key={p.name} style={{ background:"#1E1E1C", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:14, padding:14, marginBottom:12, boxSizing:"border-box" }}>
          {/* Author */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:p.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#141413", flexShrink:0 }}>{p.init}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:"#F1EFE8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
              <div style={{ fontSize:11, color:"#888780", marginTop:2 }}>{p.ago}</div>
            </div>
          </div>
          {/* Place + score chip */}
          <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:12 }}>
            <div style={{ fontSize:38, lineHeight:1, flexShrink:0 }}>{p.flag}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#F1EFE8", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.rest}</div>
              <div style={{ fontSize:12, color:"#888780", marginTop:4 }}>{p.sub}</div>
            </div>
            <div style={{ flexShrink:0, padding:"8px 12px", borderRadius:10, background:"#252523", textAlign:"center", minWidth:64 }}>
              <div style={{ fontSize:18, fontWeight:700, color:p.biteCol, lineHeight:1 }}>{p.bite}</div>
              <div style={{ fontSize:10, fontWeight:500, color:p.biteCol, marginTop:4, opacity:0.9 }}>{p.label}</div>
            </div>
          </div>
          {/* Pills */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom: p.notes ? 12 : 0 }}>
            <span style={pill}>✦ {p.taste} taste</span>
            <span style={pill}>{p.cost}</span>
            <span style={pill}>⏱ {p.wait} min</span>
            <span style={pill}>★★★ Would seek out</span>
          </div>
          {/* Notes */}
          {p.notes && (
            <div style={{ fontSize:13, fontStyle:"italic", color:"#C4C2BA", lineHeight:1.5, wordBreak:"break-word" }}>
              "{p.notes}"
            </div>
          )}
          {/* Reactions */}
          <div style={{ marginTop:12, paddingTop:10, borderTop:"0.5px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:16 }}>❤️</span>
            <span style={{ fontSize:13, color:"#888780" }}>{p.hearts}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Community sub-tab router.
 *
 * Three sub-tabs in the top strip — Feed (default), People, Explore.
 * Compare is intentionally NOT in the strip; it lives at
 * `/community/compare/:username` (URL is the source of truth for who you're
 * comparing against) and is reached by tapping any user → MiniProfileSheet
 * → Compare button, which calls `jumpToCompare`. A bare `/community/compare`
 * with no username bounces signed-in users to `/community/people/following`.
 *
 * `primedCompareTarget` is an instant-render hint for CompareTab so the click
 * path doesn't flash a loading state while the resolved profile is fetched
 * (which would otherwise happen on refresh / deep link). `userLogTarget`
 * (set externally by notifications, or internally by MiniProfileSheet's
 * View Log button) makes UserLogView take over the entire Community surface
 * until Back; the active sub-tab strip is preserved underneath.
 *
 * `restaurantWeights` / `drinkWeights` / `sweetWeights` flow through to
 * Explore > Global so its mean-then-BITE leaderboard reflects the viewer's
 * own My Taste sliders.
 */
export function CommunityTab({ user, myEntries, cafes = [], cafePlaces = [], myRestaurantPlaceIds, restaurantWeights, drinkWeights, sweetWeights, unseenFollowers = 0, onMarkFollowersSeen, onFollowChange, externalUserLogTarget, onExternalUserLogConsumed, externalCompareTarget, onExternalCompareConsumed, externalFeedScrollTarget, onExternalFeedScrollConsumed, coDinersRefreshKey = 0, onSignIn, myDisplayName = "", guestTasteBud = null, guestTasteBudCompat = null }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const segs = pathname.split("/");
  const topSeg = segs[2] || DEFAULT_TAB;
  // Compare's target identity now lives in the URL: /community/compare/:username.
  // The third segment is the username we're comparing against; null means the
  // signed-in user hit /community/compare bare and should bounce to People.
  const compareUsername = topSeg === "compare" ? (segs[3] || null) : null;
  // Compare renders at /community/compare but isn't in the strip; resolve
  // strip highlight to the default tab so nothing lights up while comparing.
  const active = SUBS.find((s) => s.key === topSeg) ? topSeg : (topSeg === "compare" ? null : DEFAULT_TAB);
  /** Instant-render hint for CompareTab. Set by intra-app handoffs (MiniProfileSheet,
   *  notifications) so the 1:1 view paints without waiting on a profile fetch.
   *  The URL is the source of truth; this is purely an optimization for the click path. */
  const [primedCompareTarget, setPrimedCompareTarget] = useState(null);
  /** When set, the read-only `UserLogView` takes over the Community surface
   *  until the user taps Back. The sub-tab strip and `active` selection are
   *  preserved underneath so we land back on the same tab on dismissal. */
  const [userLogTarget, setUserLogTarget] = useState(null);

  useEffect(() => {
    if (externalUserLogTarget) {
      setUserLogTarget(externalUserLogTarget);
      onExternalUserLogConsumed?.();
    }
  }, [externalUserLogTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (externalCompareTarget) {
      setPrimedCompareTarget(externalCompareTarget);
      onExternalCompareConsumed?.();
    }
  }, [externalCompareTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Notification handoff: tag-back / tag-accepted notifs route here so
   *  the recipient lands on the feed with the relevant post scrolled into
   *  view. Hold the target locally until FeedTab consumes it. */
  const [feedScrollTarget, setFeedScrollTarget] = useState(null);
  useEffect(() => {
    if (externalFeedScrollTarget) {
      setFeedScrollTarget(externalFeedScrollTarget);
      onExternalFeedScrollConsumed?.();
      // Drop any stale UserLogView so the feed is what renders.
      setUserLogTarget(null);
    }
  }, [externalFeedScrollTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bounce signed-in users away from a bare /community/compare with no username.
  // Declared after the externalCompareTarget consumer so the prop-sync runs first;
  // a notification handoff that lands on /community/compare/<name> will not trip this.
  useEffect(() => {
    if (topSeg !== "compare") return;
    if (!user) return;
    if (compareUsername) return;
    navigate("/community/people/following", { replace: true });
  }, [topSeg, compareUsername, user]); // eslint-disable-line react-hooks/exhaustive-deps

  function jumpToCompare(friendProfile) {
    if (!friendProfile?.username) return;
    setPrimedCompareTarget(friendProfile);
    navigate(`/community/compare/${friendProfile.username}`);
  }

  const hint = active ? (t[SUBS.find((s) => s.key === active)?.hintKey] || "") : "";

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

  // /community/compare/:username renders CompareTab full-width without the
  // sub-tab strip — it's a focused 1:1 view, reached via MiniProfileSheet.
  if (topSeg === "compare") {
    if (!user) {
      return (
        <GuestPreview message="Sign in to compare your taste with friends" onSignIn={onSignIn}>
          <PeopleMockup />
        </GuestPreview>
      );
    }
    if (!compareUsername) return null; // redirect effect above handles the bounce
    return (
      <CompareTab
        user={user}
        myWeights={restaurantWeights}
        username={compareUsername}
        primedTarget={primedCompareTarget}
        onFollowChange={onFollowChange}
        myDisplayName={myDisplayName}
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
          // Unseen-followers badge surfaces on People (where the New
          // Followers banner lives, under People > Discover).
          const badge = s.key === "people" && unseenFollowers > 0 ? unseenFollowers : 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                if (s.key === "people" && unseenFollowers > 0) {
                  navigate("/community/people/discover");
                } else {
                  navigate("/community/" + s.key);
                }
              }}
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
      {/* Explore owns its own hint copy so the line can swap between the
          Top Picks and Global blurbs as the user toggles the section strip. */}
      {active !== "explore" && (
        <p style={{ fontSize: 12, color: "#888780", margin: "0 0 12px" }}>{hint}</p>
      )}

      {active === "feed" && !user && (
        <GuestPreview message="Sign in to see your Taste Buds' feed" onSignIn={onSignIn}>
          <FeedMockup />
        </GuestPreview>
      )}
      {active === "feed" && user && (
        <FeedTab
          user={user}
          restaurantWeights={restaurantWeights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
          myRestaurantPlaceIds={myRestaurantPlaceIds}
          onCompareWith={jumpToCompare}
          onViewLog={setUserLogTarget}
          onFollowChange={onFollowChange}
          scrollTarget={feedScrollTarget}
          onScrollTargetConsumed={() => setFeedScrollTarget(null)}
          coDinersRefreshKey={coDinersRefreshKey}
        />
      )}

      {active === "people" && (
        <PeopleTab
          user={user}
          myWeights={restaurantWeights}
          onCompareWith={jumpToCompare}
          onMarkFollowersSeen={onMarkFollowersSeen}
          onFollowChange={onFollowChange}
          onViewLog={setUserLogTarget}
          guestTasteBud={guestTasteBud}
          guestTasteBudCompat={guestTasteBudCompat}
          onSignIn={onSignIn}
        />
      )}

      {active === "explore" && !user && (
        <GuestPreview message="Sign in to see top picks and the live community leaderboard" onSignIn={onSignIn}>
          <ExploreMockup />
        </GuestPreview>
      )}
      {active === "explore" && user && (
        <ExploreTab
          user={user}
          myEntries={myEntries}
          cafes={cafes}
          cafePlaces={cafePlaces}
          restaurantWeights={restaurantWeights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
        />
      )}
    </div>
  );
}
