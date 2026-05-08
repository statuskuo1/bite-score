import { useState, useReducer, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LangContext } from "./contexts/LangContext.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import { T } from "./translations.js";
import { supabase } from "./config/supabaseClient.js";
import { canMutateVisit } from "./utils/rowAccess.js";
import {
  fetchRestaurantVisitsJoined,
  fetchCafeVisitsJoined,
  fetchAllRestaurantPlaces,
  fetchAllCafePlaces,
  ensureRestaurantPlace,
  ensureCafePlace,
  restaurantVisitInsertPayload,
  restaurantVisitUpdatePayload,
  cafeVisitInsertPayload,
  cafeVisitUpdatePayload,
  mapRestaurantVisitRow,
  mapCafeVisitRow,
  RESTAURANT_VISIT_SELECT,
  CAFE_VISIT_SELECT,
} from "./utils/visitPlacesApi.js";
import { INIT_REST, INIT_CAFE } from "./data/initialData.js";
import { GUEST_USER, GUEST_REST_ENTRIES, GUEST_CAFE_ENTRIES, GUEST_TASTE_BUD, GUEST_TASTE_BUD_COMPAT } from "./data/guestData.js";
import { reducer } from "./state/logReducer.js";
import {
  calcBiteOutOf10,
  calcCafeOutOf10,
  scoreColor,
  scoreLabel,
  tasteColor,
  tasteLabel,
  RESTAURANT_WEIGHT_DEFAULTS,
  CAFE_WEIGHT_DEFAULTS,
  normalizeWeights,
  weightsToPercents,
} from "./utils/scoring.js";
import { rating010FilterRows } from "./constants/ratingTiers0to10.js";
import { BEAN_REGIONS, regionOf } from "./constants/coffeeConstants.js";
import { S } from "./styles/sharedStyles.js";
import { MouthLogo } from "./components/MouthLogo.jsx";
import { RestRow } from "./components/RestRow.jsx";
import { RestForm } from "./components/RestForm.jsx";
import { CafeForm } from "./components/CafeForm.jsx";
import { CafeGroupRow } from "./components/CafeGroupRow.jsx";
import { SuggestView } from "./components/SuggestView.jsx";
import { PaletteView } from "./components/PaletteView.jsx";
import { FaqView } from "./components/FaqView.jsx";
import { AuthModal } from "./components/AuthModal.jsx";
import { ResetPasswordModal } from "./components/ResetPasswordModal.jsx";
import { WeightSliders } from "./components/WeightSliders.jsx";
import { CommunityTab } from "./components/community/CommunityTab.jsx";
import { SortFilterToolbar } from "./components/SortFilterToolbar.jsx";
import { countUnseenFollowers, markFollowersSeen, followUser, unfollowUser, getRelation, fetchFollowingIds, fetchFollowerIds } from "./utils/followsApi.js";
import { MiniProfileSheet } from "./components/community/MiniProfileSheet.jsx";
import { countUnreadNotifications, fetchUnreadNotifications, markNotificationsRead, tickUserMilestones } from "./utils/notificationsApi.js";
import { usePaginatedList } from "./components/usePaginatedList.js";
import { ShowMoreButton } from "./components/ShowMoreButton.jsx";
import { NotificationPanel } from "./components/NotificationPanel.jsx";
import { FeedPostSheet } from "./components/community/FeedPostSheet.jsx";
import {
  fetchUnloggedDineTags,
  countUnloggedDineTags,
  dismissDineTag,
  fetchCoDiners,
  fetchDinedWithByEntry,
  resolveGroupVisitTaggedNotif,
} from "./utils/groupVisitsApi.js";
import {
  findCandidateGroupVisit,
  findAlreadyLoggedMatch,
  createGroupVisit,
  joinExistingGroupVisit,
  fetchGroupVisitWithMembers,
  fetchVisitsByIds,
  tickGroupVisitsExpiry,
  autoAttachVisitToGroupVisits,
  findExpiredGroupVisitCandidates,
  syncGroupVisitMembersOnEdit,
} from "./utils/groupVisitsApi.js";
import { DineTagsBanner } from "./components/DineTagsBanner.jsx";
import { toUSD, fromUSD, CURRENCY_SYMBOLS } from "./utils/currency.js";
import { resolveCity } from "./components/CityInput.jsx";
import { CategoryTabs } from "./components/CategoryTabs.jsx";
import { ConfirmSheet } from "./components/ConfirmSheet.jsx";
import { SameDinnerSheet } from "./components/SameDinnerSheet.jsx";
import { PickVisitSheet } from "./components/PickVisitSheet.jsx";
import { RetroAttachSheet } from "./components/RetroAttachSheet.jsx";
import { OnboardingModal } from "./components/OnboardingModal.jsx";
import { TasteBudsPromptSheet } from "./components/TasteBudsPromptSheet.jsx";
import { evalBadges } from "./utils/badgeDefinitions.js";
import { BadgeSVG } from "./components/BadgesView.jsx";
import { removeWantToGo, listWantToGo } from "./utils/wantToGoApi.js";
import { setWantToGoRows } from "./utils/sessionCache.js";
import { formatVisitDateInput } from "./utils/visitDate.js";
import posthog from "./config/posthog.js";
const GUEST_PALETTE_ENTRIES = [
  {id:"gp1",name:"Lilia",             cuisine:"Italian",        letter:"I",city:"New York City",taste:9.2,cost:120,portions:2,wait:20,repeatability:3,useR:true,notes:""},
  {id:"gp2",name:"Don Angie",         cuisine:"Italian",        letter:"I",city:"New York City",taste:8.8,cost:95, portions:2,wait:15,repeatability:3,useR:true,notes:""},
  {id:"gp3",name:"Lucali",            cuisine:"Italian",        letter:"I",city:"New York City",taste:9.5,cost:55, portions:2,wait:45,repeatability:3,useR:true,notes:""},
  {id:"gp4",name:"Ugly Bagel",        cuisine:"American",       letter:"A",city:"New York City",taste:8.5,cost:22, portions:1,wait:10,repeatability:2,useR:true,notes:""},
  {id:"gp5",name:"Superiority Burger",cuisine:"American",       letter:"A",city:"New York City",taste:8.1,cost:18, portions:1,wait:12,repeatability:2,useR:true,notes:""},
  {id:"gp6",name:"Raku",              cuisine:"Japanese",       letter:"J",city:"New York City",taste:8.7,cost:75, portions:1,wait:25,repeatability:3,useR:true,notes:""},
  {id:"gp7",name:"Xi'an Famous",      cuisine:"Chinese",        letter:"C",city:"New York City",taste:8.2,cost:28, portions:1,wait:8, repeatability:2,useR:true,notes:""},
  {id:"gp8",name:"Sammy's Halal",     cuisine:"Middle Eastern", letter:"M",city:"New York City",taste:7.8,cost:14, portions:1,wait:5, repeatability:2,useR:true,notes:""},
];

const EXAMPLE_RESTAURANT = {
  id: "__example__",
  name: "Lilia",
  cuisine: "Italian",
  isFusion: false,
  cuisine2: "",
  taste: 9.2,
  cost: 120,
  currency_code: "USD",
  portions: 2,
  wait: 25,
  repeatability: 3,
  useR: true,
  notes: "Best pasta in NYC, no contest.",
  city: "New York City",
  placeId: null,
  visitedAt: null,
};

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

function getTombstonedIds(userId) {
  try {
    const raw = localStorage.getItem(`bite_dismissed_tags_${userId}`);
    const parsed = JSON.parse(raw || "[]");
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Set(parsed.filter((x) => x.t > cutoff).map((x) => x.id));
  } catch { return new Set(); }
}

function tombstoneTag(userId, tagId) {
  try {
    const raw = localStorage.getItem(`bite_dismissed_tags_${userId}`);
    const parsed = JSON.parse(raw || "[]");
    const deduped = parsed.filter((x) => x.id !== tagId).slice(-199);
    deduped.push({ id: tagId, t: Date.now() });
    localStorage.setItem(`bite_dismissed_tags_${userId}`, JSON.stringify(deduped));
  } catch {}
}

function SwipeHint({ userId, hint }) {
  const key = `bite_swipe_hint_dismissed_${userId}`;
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(key); } catch { return true; }
  });
  if (!visible) return null;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,background:"rgba(240,153,123,0.08)",border:"0.5px solid rgba(240,153,123,0.3)",marginBottom:2}}>
      <span style={{fontSize:15,animation:"swipeArrow 1.2s ease-in-out infinite"}}>👈</span>
      <span style={{flex:1,fontSize:12,color:"#C8A090"}}>{hint}</span>
      <button
        type="button"
        onClick={() => { try { localStorage.setItem(key,"1"); } catch {} setVisible(false); }}
        style={{background:"none",border:"none",color:"#888780",fontSize:14,cursor:"pointer",padding:"0 2px",lineHeight:1}}
      >✕</button>
      <style>{`@keyframes swipeArrow{0%,100%{transform:translateX(0)}50%{transform:translateX(-4px)}}`}</style>
    </div>
  );
}

export default function App() {
  const { user, authReady, username, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [st, dispatch] = useReducer(reducer, { entries: [] });

  /** Shaped like the rows returned by `fetchCoDinersForPosts` so EntryCard /
   *  OthersListSheet can render the viewer alongside their tagged friends in
   *  the "Dining Party" sheet. Lives at the App level so My Log row renders
   *  share one identity. Null until auth lands. */
  const viewerProfile = useMemo(() => (
    user?.id ? {
      id: user.id,
      username: profile?.username || "",
      display_name: profile?.display_name || "",
      avatar_url: profile?.avatar_url || null,
    } : null
  ), [user?.id, profile?.username, profile?.display_name, profile?.avatar_url]);

  // ── URL-derived view state ────────────────────────────────────────────────
  const logTab = pathname === "/log/drinks" ? "drinks" : pathname === "/log/sweets" ? "sweets" : "restaurants";
  const [showSuggest, setShowSuggest] = useState(false);
  const [cafes, setCafes] = useState([]);
  /** Shared cross-user catalog for PlacePicker. Loaded once on auth boot. */
  const [restaurantPlaces, setRestaurantPlaces] = useState([]);
  const [cafePlaces, setCafePlaces] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSelfSheet, setShowSelfSheet] = useState(false);
  /** Unseen-followers count drives the red badge on the Community tab in the
   *  bottom nav. Refreshed on auth + after every follow/unfollow action; the
   *  Friends sub-tab additionally calls markFollowersSeen on mount to clear it. */
  const [unseenFollowers, setUnseenFollowers] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifAnchorPos, setNotifAnchorPos] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifFollowingIds, setNotifFollowingIds] = useState(() => new Set());
  const [notifLoading, setNotifLoading] = useState(false);
  const notifContainerRef = useRef(null);
  const [notifSheetProfile, setNotifSheetProfile] = useState(null);
  const [notifSheetRelation, setNotifSheetRelation] = useState("none");
  const [notifSheetBusy, setNotifSheetBusy] = useState(false);
  /** Tap-target for heart-reaction notifications. When set, FeedPostSheet
   *  mounts and renders the hearted post as a single read-only card. */
  const [heartSheetTarget, setHeartSheetTarget] = useState(null);
  /** Tap-target for tag-back notifications (`dine_tag_back` /
   *  `dine_tag_accepted`). Sends the user to /community/feed and tells
   *  FeedTab to scroll the matching post into view. If the post isn't in
   *  the viewer's mutual-only feed, FeedTab falls back to opening
   *  FeedPostSheet over the feed (with hearts enabled). */
  const [feedScrollTarget, setFeedScrollTarget] = useState(null);
  const [dineTags, setDineTags] = useState([]);
  const [dineTagCount, setDineTagCount] = useState(0);
  const [dineTagsReady, setDineTagsReady] = useState(false);
  const [dinedWithMap, setDinedWithMap] = useState(new Map());
  /** Bumped whenever the dine_with_tags graph changes in a way the FeedTab
   *  can't observe on its own (Tag-them-back inside NotificationPanel). FeedTab
   *  watches this and re-enriches its loaded posts so the "dined with" pill
   *  refreshes without a page reload. dinedWithMap covers My Log because
   *  RestRow/CafeGroupRow read from it directly via dinedWithForEntry. */
  const [coDinersRefreshKey, setCoDinersRefreshKey] = useState(0);
  // `group_visit_tagged` carries the variant (standard / auto_linked /
  // pick_visit) directly on `meta.variant`, so no client-side re-typing is
  // needed anymore. Legacy `dine_tag` notifications are still rendered in
  // NotificationPanel's generic fallback path. `resolvedDineTagIds` remains
  // wired through as an empty set for backward compat with the panel
  // component prop shape. See src/_archive/dine-tag-notifications.md.
  const annotatedNotifications = notifications;
  const resolvedDineTagIds = useMemo(() => new Set(), []);
  const [addPrefill, setAddPrefill] = useState(null);
  const [addInitialDineWith, setAddInitialDineWith] = useState([]);
  const [addFormKey, setAddFormKey] = useState(0);
  const [addTagTaggerId, setAddTagTaggerId] = useState(null);
  /** Set when a `group_visit_tagged` notification tap pre-fills the Add form.
   *  The save handler reads this and calls joinExistingGroupVisit(...) instead
   *  of the normal candidate-lookup flow. Cleared on /add leave (same as the
   *  other prefill state). */
  const [addGroupVisitId, setAddGroupVisitId] = useState(null);
  /** Set after a successful save when a candidate group_visit was found.
   *  Drives the SameDinnerSheet — Yes joins the candidate, No falls through
   *  to creating a new group_visit with the prepared per-member variants. */
  const [sameDinnerPending, setSameDinnerPending] = useState(null);
  /** Set when a `group_visit_tagged` notif arrives with `variant: 'pick_visit'`.
   *  Drives the PickVisitSheet — pick a date → joinExistingGroupVisit. */
  const [pickVisitState, setPickVisitState] = useState(null);
  /** Set after a save when `find_expired_group_visit_candidates` finds a
   *  >7-day-old group_visit (already marked `expired` by the day-7 sweep)
   *  at the same place within ±30 days of the new visit. Drives the
   *  retrospective "Was this with @X on {date}?" modal. Yes attaches the
   *  new visit_id to that member row (no parent status change, no notif
   *  fan-out — the group has already expired for everyone else). */
  const [retroPromptState, setRetroPromptState] = useState(null);
  const formStateRef = useRef(null);
  const [addDraftData, setAddDraftData] = useState(null);
  const [tasteBudIds, setTasteBudIds] = useState(() => new Set());
  const [mutualFollowCount, setMutualFollowCount] = useState(0);
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [onboardingDone, setOnboardingDone] = useState(null);
  const [tasteBudsDone, setTasteBudsDone] = useState(true);
  const [tasteHalfStep, setTasteHalfStep] = useState(false);
  const [showTasteBudsPrompt, setShowTasteBudsPrompt] = useState(false);
  const [showGuestOnboarding, setShowGuestOnboarding] = useState(true);
  const [showBadgesCard, setShowBadgesCard] = useState(false);
  const [earnedBadgeQueue, setEarnedBadgeQueue] = useState([]);
  const [badgeModal, setBadgeModal] = useState(null);
  const guestReachedSignIn = useRef(false);
  const [guestEntries, setGuestEntries] = useState(() => GUEST_REST_ENTRIES);
  const [guestCafes,   setGuestCafes]   = useState(() => GUEST_CAFE_ENTRIES);
  const [extUserLogTarget, setExtUserLogTarget] = useState(null);
  const [extCompareTarget, setExtCompareTarget] = useState(null);
  const lastLogPath = useRef("/log");
  const lastTastePath = useRef("/taste");
  const pendingBadgesCard = useRef(null);
  /** Mandarin localization is temporarily stashed while EN gets polish.
   *  `T.zh` and components' `lang === "zh"` branches are intentionally preserved
   *  so reviving = restore lang state + UI toggles. See
   *  docs/decisions/2026-04-28-stash-mandarin-localization.md. */
  const lang = "en";
  const t = T.en;

  useEffect(() => {
    if (user) setShowAuthModal(false);
  }, [user]);

  useEffect(() => {
    if (profile?.home_currency) setHomeCurrency(profile.home_currency);
  }, [profile?.home_currency]);

  useEffect(() => {
    if (!profile || !user?.id) return;
    if (profile.pref_weight_taste && profile.pref_weight_bpb && profile.pref_weight_wait) {
      // Only apply Supabase weights if this device has no local override yet (new device scenario).
      let hasLocal = false;
      try { hasLocal = !!localStorage.getItem(`bite_restaurantWeights_${user.id}`); } catch {}
      if (!hasLocal) {
        const w = normalizeWeights({
          taste: profile.pref_weight_taste,
          bpb: profile.pref_weight_bpb,
          wait: profile.pref_weight_wait,
        });
        setWeights(w);
        try {
          localStorage.setItem(`bite_restaurantWeights_${user.id}`, JSON.stringify(w));
          localStorage.setItem("bite_restaurantWeights_bootstrap", JSON.stringify(w));
        } catch {}
      }
    }
  }, [profile?.pref_weight_taste, profile?.pref_weight_bpb, profile?.pref_weight_wait]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile || !user?.id) return;
    if (profile.pref_weight_drink_taste) {
      let hasLocal = false;
      try { hasLocal = !!localStorage.getItem(`bite_drinkWeights_${user.id}`); } catch {}
      if (!hasLocal) {
        const w = normalizeWeights({ taste: profile.pref_weight_drink_taste, bpb: profile.pref_weight_drink_bpb, wait: profile.pref_weight_drink_wait });
        setDrinkWeights(w);
        try { localStorage.setItem(`bite_drinkWeights_${user.id}`, JSON.stringify(w)); localStorage.setItem("bite_drinkWeights_bootstrap", JSON.stringify(w)); } catch {}
      }
    }
    if (profile.pref_weight_sweet_taste) {
      let hasLocal = false;
      try { hasLocal = !!localStorage.getItem(`bite_sweetWeights_${user.id}`); } catch {}
      if (!hasLocal) {
        const w = normalizeWeights({ taste: profile.pref_weight_sweet_taste, bpb: profile.pref_weight_sweet_bpb, wait: profile.pref_weight_sweet_wait });
        setSweetWeights(w);
        try { localStorage.setItem(`bite_sweetWeights_${user.id}`, JSON.stringify(w)); localStorage.setItem("bite_sweetWeights_bootstrap", JSON.stringify(w)); } catch {}
      }
    }
  }, [profile?.pref_weight_drink_taste, profile?.pref_weight_drink_bpb, profile?.pref_weight_drink_wait, profile?.pref_weight_sweet_taste, profile?.pref_weight_sweet_bpb, profile?.pref_weight_sweet_wait]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile) return;
    // localStorage acts as a fast synchronous override: if the user has ever
    // dismissed/completed onboarding on this device, skip the modal even if
    // the DB write hasn't propagated yet (race condition on quick refresh).
    let locallyDone = false;
    try { locallyDone = !!localStorage.getItem(`bite_welcomeDismissed_${user?.id}`); } catch {}
    setOnboardingDone(locallyDone || (profile.has_completed_onboarding ?? true));
    setTasteBudsDone(profile.has_seen_taste_buds_prompt ?? false);
  }, [profile?.has_completed_onboarding, profile?.has_seen_taste_buds_prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist "seen" the moment the signed-in OnboardingModal first renders so a
  // mid-flow refresh or tab-close doesn't loop back to card 0. Sets localStorage
  // synchronously so next load skips the modal immediately, then fires the DB
  // write asynchronously.
  useEffect(() => {
    if (!user?.id || onboardingDone !== false || !authReady) return;
    try { localStorage.setItem(`bite_welcomeDismissed_${user.id}`, "1"); } catch {}
    supabase.from("profiles").update({ has_completed_onboarding: true }).eq("id", user.id)
      .then(({ error }) => { if (error) console.warn("[BITE] mark onboarding seen:", error.message); });
  }, [user?.id, onboardingDone, authReady]); // eslint-disable-line react-hooks/exhaustive-deps



  useEffect(() => {
    if (!user?.id) { lastCity.current = ""; return; }
    try {
      lastCity.current = resolveCity(localStorage.getItem(`bite_lastUsedCity_${user.id}`) || "") || "";
    } catch { lastCity.current = ""; }
    // Restore pending badges card destination across page reloads
    try {
      const pending = sessionStorage.getItem(`bite_pendingBadgesCard_${user.id}`);
      if (pending) pendingBadgesCard.current = pending;
    } catch {}
  }, [user?.id]);

  const refreshUnseenFollowers = useCallback(async () => {
    if (!user?.id) { setUnseenFollowers(0); return; }
    const n = await countUnseenFollowers(supabase, user.id);
    setUnseenFollowers(n);
  }, [user?.id]);

  const refreshNotifCount = useCallback(async () => {
    if (!user?.id) { setNotifCount(0); return; }
    const n = await countUnreadNotifications(supabase, user.id);
    setNotifCount(n);
  }, [user?.id]);

  useEffect(() => { refreshNotifCount(); }, [refreshNotifCount]);

  async function openNotifPanel() {
    if (showNotifPanel) { setShowNotifPanel(false); return; }
    const rect = notifContainerRef.current?.getBoundingClientRect();
    if (rect) {
      setNotifAnchorPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setShowNotifPanel(true);
    setNotifLoading(true);
    try {
      // Opportunistic sweeps run here. Both are idempotent and cheap:
      //  • day-7 group-visit expiry (3 predicate-bound UPDATEs, partial idx)
      //  • milestone anniversary check (one SELECT + ON CONFLICT INSERTs)
      // Awaited together so the notifications fetch below renders the
      // post-sweep state.
      await Promise.all([
        tickGroupVisitsExpiry(supabase),
        tickUserMilestones(supabase),
      ]);
      const [rows, ids] = await Promise.all([
        fetchUnreadNotifications(supabase, user.id),
        fetchFollowingIds(supabase, user.id),
      ]);
      setNotifications(rows);
      setNotifFollowingIds(ids);
      await markNotificationsRead(supabase, user.id);
      setNotifCount(0);
    } finally {
      setNotifLoading(false);
    }
  }

  async function handleNotifFollowBack(targetId) {
    if (!user?.id) return { ok: false };
    const res = await followUser(supabase, user.id, targetId);
    await refreshSocialCounts();
    refreshDineTags();
    return res;
  }

  async function refetchNotifications() {
    if (!user?.id) return;
    try {
      // Wait for the Postgres trigger to fire before fetching.
      await new Promise((r) => setTimeout(r, 700));
      await Promise.all([
        tickGroupVisitsExpiry(supabase),
        tickUserMilestones(supabase),
      ]);
      const [rows, ids] = await Promise.all([
        fetchUnreadNotifications(supabase, user.id),
        fetchFollowingIds(supabase, user.id),
      ]);
      setNotifications(rows);
      setNotifFollowingIds(ids);
      await markNotificationsRead(supabase, user.id);
      setNotifCount(0);
    } catch (err) {
      console.error("refetch notifications:", err);
    }
  }

  async function handleOpenNotifProfile(profile) {
    if (!profile?.id) return;
    setShowNotifPanel(false);
    setNotifSheetBusy(true);
    setNotifSheetProfile(profile);
    setNotifSheetRelation("none");
    try {
      const rel = await getRelation(supabase, user?.id, profile.id);
      setNotifSheetRelation(rel);
    } finally {
      setNotifSheetBusy(false);
    }
  }

  async function applyDineTagPrefill({ restaurantName, city, cuisine, taggerId, entryId, taggerProfile, entryType = "restaurant", visitedAt }) {
    const resolvedCity = resolveCity(city || "");
    const visitDate = formatVisitDateInput(visitedAt);
    let prefill;
    let coDiners;
    if (entryType === "cafe") {
      coDiners = await fetchCoDiners(supabase, { taggerId, entryId, excludeUserId: user?.id });
      prefill = {
        name: restaurantName || "",
        ...(resolvedCity ? { city: resolvedCity } : {}),
        ...(visitDate ? { visitDate } : {}),
        category: cuisine || "Coffee",
      };
    } else {
      const [placeRes, coD] = await Promise.all([
        supabase.from("restaurant_places").select("is_fusion, cuisine, cuisine2")
          .ilike("name", restaurantName || "").limit(1).maybeSingle(),
        fetchCoDiners(supabase, { taggerId, entryId, excludeUserId: user?.id }),
      ]);
      coDiners = coD;
      const place = placeRes.data;
      const resolvedCuisine = cuisine || place?.cuisine || "";
      prefill = {
        name: restaurantName || "",
        ...(resolvedCity ? { city: resolvedCity } : {}),
        ...(visitDate ? { visitDate } : {}),
        cuisine: resolvedCuisine,
        cuisine2: place?.cuisine2 || "",
        isFusion: !!place?.is_fusion,
        letter: (resolvedCuisine[0] || "").toUpperCase(),
      };
    }
    setAddPrefill(prefill);
    // Always include the tagger when we have a taggerId. taggerProfile may
    // arrive null (older notifs / partial hydration in notificationsApi),
    // so fall back to a direct profiles lookup before assembling the
    // dined-with seed. Falls back to no-tagger if the lookup fails.
    let resolvedTagger = taggerProfile || null;
    if (!resolvedTagger && taggerId) {
      const { data: tProf } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", taggerId)
        .maybeSingle();
      if (tProf) resolvedTagger = tProf;
    }
    // Tagger + co-diners, deduplicated, current user excluded (fetchCoDiners already handles that).
    const all = [...(resolvedTagger ? [resolvedTagger] : []), ...coDiners];
    const seen = new Set();
    setAddInitialDineWith(all.filter(p => p?.id && !seen.has(p.id) && seen.add(p.id)));
    setAddTagTaggerId(taggerId || null);
    setAddDraftData(null);
    setAddFormKey(k => k + 1);
    setAddType(entryType === "cafe" ? "cafe" : "restaurant");
    navigate("/add");
  }

  /** Pre-fill the Add form from a `group_visit_tagged` notification. Mirror
   *  applyDineTagPrefill, but seed `addGroupVisitId` so the save handler
   *  calls joinExistingGroupVisit(...) instead of running candidate lookup
   *  + createGroupVisit again. Kind-aware (restaurant vs cafe) since Phase 2.
   *
   *  `fallbackMeta` is the raw notification meta — used as a last resort when
   *  fetchGroupVisitWithMembers returns null (e.g. RLS gap on tagged user). */
  async function applyGroupVisitPrefill(groupVisitId, fallbackMeta, creatorProfile) {
    if (!groupVisitId || !user?.id) return;
    const gv = await fetchGroupVisitWithMembers(supabase, groupVisitId);
    if (!gv) {
      // Fallback: use notification meta to prefill what we know.
      if (!fallbackMeta) return;
      const kind = fallbackMeta.kind || "restaurant";
      const isCafe = kind === "cafe";
      const placeId = fallbackMeta.place_id;
      const visitDate = formatVisitDateInput(fallbackMeta.visited_at);
      if (isCafe) {
        const { data: place } = placeId ? await supabase.from("cafe_places").select("name, city").eq("id", placeId).maybeSingle() : { data: null };
        const resolvedCity = resolveCity(place?.city || "");
        setAddPrefill({
          name: fallbackMeta.restaurant_name || place?.name || "",
          placeId: placeId || null,
          ...(resolvedCity ? { city: resolvedCity } : {}),
          ...(visitDate ? { visitDate } : {}),
        });
      } else {
        const { data: place } = placeId ? await supabase.from("restaurant_places").select("name, city, cuisine, cuisine2, is_fusion").eq("id", placeId).maybeSingle() : { data: null };
        const resolvedCity = resolveCity(place?.city || "");
        const resolvedCuisine = place?.cuisine || "";
        setAddPrefill({
          name: fallbackMeta.restaurant_name || place?.name || "",
          placeId: placeId || null,
          ...(resolvedCity ? { city: resolvedCity } : {}),
          ...(visitDate ? { visitDate } : {}),
          cuisine: resolvedCuisine,
          cuisine2: place?.cuisine2 || "",
          isFusion: !!place?.is_fusion,
          letter: (resolvedCuisine[0] || "").toUpperCase(),
        });
      }
      // Include the creator in dine-with if we have their profile from the notif.
      const fallbackDineWith = creatorProfile?.id && creatorProfile.id !== user.id ? [creatorProfile] : [];
      setAddInitialDineWith(fallbackDineWith);
      setAddTagTaggerId(null);
      setAddGroupVisitId(groupVisitId);
      setAddDraftData(null);
      setAddFormKey((k) => k + 1);
      setAddType(isCafe ? "cafe" : "restaurant");
      navigate("/add");
      return;
    }
    const isCafe = gv.kind === "cafe";
    if (isCafe) {
      // Cafes don't carry cuisine/fusion — just look up name/city for the
      // prefill. Category (Coffee/Drinks vs Sweets) is left to the form's
      // default since the group visit doesn't pin which one B will log.
      const { data: place } = await supabase
        .from("cafe_places")
        .select("name, city")
        .eq("id", gv.placeId)
        .maybeSingle();
      const resolvedCity = resolveCity(place?.city || "");
      const visitDate = formatVisitDateInput(gv.visitedAt);
      setAddPrefill({
        name: gv.restaurantName || place?.name || "",
        placeId: gv.placeId,
        ...(resolvedCity ? { city: resolvedCity } : {}),
        ...(visitDate ? { visitDate } : {}),
      });
    } else {
      // Restaurant prefill: cuisine/fusion + city.
      const { data: place } = await supabase
        .from("restaurant_places")
        .select("name, city, cuisine, cuisine2, is_fusion")
        .eq("id", gv.placeId)
        .maybeSingle();
      const resolvedCity = resolveCity(place?.city || "");
      const resolvedCuisine = place?.cuisine || "";
      const visitDate = formatVisitDateInput(gv.visitedAt);
      setAddPrefill({
        name: gv.restaurantName || place?.name || "",
        placeId: gv.placeId,
        ...(resolvedCity ? { city: resolvedCity } : {}),
        ...(visitDate ? { visitDate } : {}),
        cuisine: resolvedCuisine,
        cuisine2: place?.cuisine2 || "",
        isFusion: !!place?.is_fusion,
        letter: (resolvedCuisine[0] || "").toUpperCase(),
      });
    }
    // Pre-fill dined-with with every other member (creator + co-tagged
    // friends), excluding the viewer. Order is deterministic — creator first,
    // then alphabetic by username — so the form looks the same on reopen.
    const others = gv.members
      .filter((m) => m.userId !== user.id && m.profile)
      .sort((a, b) => {
        if (a.userId === gv.createdBy) return -1;
        if (b.userId === gv.createdBy) return 1;
        return (a.profile?.username || "").localeCompare(b.profile?.username || "");
      })
      .map((m) => m.profile);
    // If the creator's profile wasn't in group_visit_members (e.g. RLS gap),
    // fall back to the notif's fromProfile so the tagger always appears.
    const creatorAlreadyIn = others.some(p => p?.id === gv.createdBy);
    if (!creatorAlreadyIn && creatorProfile?.id && creatorProfile.id !== user.id) {
      others.unshift(creatorProfile);
    }
    setAddInitialDineWith(others);
    // No reverse-tag semantics for group visits — clear addTagTaggerId so the
    // save flow doesn't try to insert a `dine_tag_accepted` notification.
    setAddTagTaggerId(null);
    setAddGroupVisitId(groupVisitId);
    setAddDraftData(null);
    setAddFormKey((k) => k + 1);
    setAddType(isCafe ? "cafe" : "restaurant");
    navigate("/add");
  }

  function handleGroupVisitTaggedTap(notif) {
    setShowNotifPanel(false);
    const meta = notif?.meta || {};
    const groupVisitId = meta.group_visit_id;
    if (!groupVisitId) return;
    const variant = meta.variant || "standard";
    const kind = meta.kind || "restaurant";
    // auto_linked: the inline Tag-them-back button is the primary action, but
    // tapping the notif body itself should land on the feed scrolled to the
    // user's already-logged post (so they can verify or react). Falls back to
    // the feed root when auto_linked_visit_id is missing on legacy rows.
    if (variant === "auto_linked") {
      if (meta.auto_linked_visit_id) {
        setFeedScrollTarget({
          postId: meta.auto_linked_visit_id,
          postType: kind,
          kind: entryTypeToKind(kind),
        });
      }
      navigate("/community/feed");
      return;
    }
    if (variant === "pick_visit") {
      const candidateIds = meta.candidate_visit_ids || [];
      if (!candidateIds.length) {
        applyGroupVisitPrefill(groupVisitId, meta, notif.fromProfile);
        return;
      }
      Promise.all([
        fetchVisitsByIds(supabase, { kind, visitIds: candidateIds }),
        fetchGroupVisitWithMembers(supabase, groupVisitId),
      ]).then(([visits, gv]) => {
        if (!visits.length) {
          applyGroupVisitPrefill(groupVisitId, meta, notif.fromProfile);
          return;
        }
        setPickVisitState({
          groupVisitId,
          kind: gv?.kind || kind,
          visits,
          creatorUsername: gv?.creatorProfile?.username || notif.fromProfile?.username || "",
          restaurantName: gv?.restaurantName || meta.restaurant_name || "",
        });
      });
      return;
    }
    applyGroupVisitPrefill(groupVisitId, meta, notif.fromProfile);
  }

  // Legacy: group_visit_logged stopped being inserted on 2026-05-04 in
  // favor of the single `group_visit_all_logged` fan-out. Kept so notifs
  // stored in the DB before the refactor still tap through sensibly.
  function handleGroupVisitLoggedTap(notif) {
    setShowNotifPanel(false);
    const meta = notif?.meta || {};
    if (meta.entry_id && meta.entry_type) {
      setFeedScrollTarget({ postId: meta.entry_id, postType: meta.entry_type, kind: entryTypeToKind(meta.entry_type) });
      navigate("/community/feed");
      return;
    }
    const p = notif.fromProfile;
    if (p) handleOpenNotifProfile(p);
  }

  /** The whole party has logged — fan out by the Postgres auto-resolve
   *  trigger (see supabase/migrations/20260504_tagging_refactor.sql). Tap
   *  deep-links to the group's comparison view so the user can see
   *  everyone's BITE scores side-by-side. */
  function handleGroupVisitAllLoggedTap(notif) {
    setShowNotifPanel(false);
    const meta = notif?.meta || {};
    const kind = meta.kind || "restaurant";
    const groupVisitId = meta.group_visit_id;
    if (groupVisitId && user?.id) {
      fetchGroupVisitWithMembers(supabase, groupVisitId).then((gv) => {
        const member = gv?.members?.find((m) => m.userId === user.id);
        if (member?.visitId) {
          setFeedScrollTarget({ postId: member.visitId, postType: kind, kind: entryTypeToKind(kind) });
        }
        navigate("/community/feed");
      });
    } else {
      navigate("/community/feed");
    }
  }

  /** After a fresh save with tagged friends and no candidate group match (or
   *  after a "No, different" answer to SameDinnerSheet), pick a per-member
   *  variant + status by looking for already-logged matches and call
   *  createGroupVisit. Returns the new group_visit_id (or null). Kind-aware
   *  since Phase 2 (restaurants and cafes share the flow). */
  async function createGroupVisitForSave({ kind, creatorVisitId, placeId, restaurantName, visitedAt, taggedIds }) {
    if (!user?.id || !taggedIds?.length) return null;
    const k = kind || "restaurant";
    const taggedMembers = await Promise.all(taggedIds.map(async (id) => {
      const matches = await findAlreadyLoggedMatch(supabase, { kind: k, userId: id, placeId, visitedAt });
      if (matches.length === 0) {
        return { userId: id, variant: "standard", status: "pending" };
      }
      if (matches.length === 1) {
        return {
          userId: id, variant: "auto_linked", status: "logged",
          visitId: matches[0].id,
        };
      }
      return {
        userId: id, variant: "pick_visit", status: "pending",
        candidateVisitIds: matches.map((m) => m.id),
      };
    }));
    const res = await createGroupVisit(supabase, {
      kind: k,
      creatorId: user.id,
      placeId,
      restaurantName,
      visitedAt,
      creatorVisitId,
      taggedMembers,
    });
    return res?.id || null;
  }

  /** Group-visits dispatch shared between restaurant + cafe save handlers.
   *  Lifted out of the inline restaurant onSave block so cafes (drinks +
   *  sweets) get the same standard / auto_linked / pick_visit / same-dinner
   *  flow without duplicating the branch logic.
   *
   *  Branches:
   *    – sourceGroupVisitId set (B saved via a group_visit_tagged notif) →
   *      joinExistingGroupVisit, no notification fan-out from this side.
   *    – taggedIds non-empty → look for a candidate group_visit at this place
   *      within ±7 days and member overlap; if found, defer to SameDinnerSheet
   *      (Yes joins, No falls through to create); else createGroupVisitForSave.
   *    – nothing tagged → no-op.
   *
   *  `taggedIds` should NOT exclude `sourceTaggerId` here (Scenario 4 fix):
   *  the candidate search and createGroupVisit both want the full co-diner
   *  set so the dedupe prompt fires when B opens /add via A's banner. The
   *  legacy `dine_tag` insert loop above the call site keeps filtering
   *  sourceTaggerId. */
  async function runGroupVisitsForSave({
    kind,
    sourceGroupVisitId,
    creatorVisitId,
    placeId,
    restaurantName,
    visitedAt,
    taggedIds,
  }) {
    if (!user?.id) return;
    if (sourceGroupVisitId) {
      await joinExistingGroupVisit(supabase, {
        groupVisitId: sourceGroupVisitId,
        userId: user.id,
        visitId: creatorVisitId,
      });
      return;
    }
    if (!taggedIds?.length) return;
    const candidate = await findCandidateGroupVisit(supabase, {
      kind,
      placeId,
      memberIds: [user.id, ...taggedIds],
      visitedAt,
    });
    if (candidate) {
      // Defer until the user answers the SameDinnerSheet — the pending bag
      // carries everything we need to either join (Yes) or fall through to
      // create (No).
      setSameDinnerPending({
        kind,
        candidate,
        creatorVisitId,
        placeId,
        restaurantName,
        visitedAt,
        taggedIds,
      });
      return;
    }
    await createGroupVisitForSave({
      kind,
      creatorVisitId,
      placeId,
      restaurantName,
      visitedAt,
      taggedIds,
    });
  }

  /** Post-save companion to runGroupVisitsForSave. Handles the two
   *  listening-window behaviors introduced by the 2026-05-04 tagging
   *  refactor:
   *    1. Auto-attach: any *pending* group_visit where this user is still
   *       a member at this place within ±30 days gets this new visit_id
   *       attached + flipped to 'logged'. The Postgres trigger then
   *       decides whether the parent resolves and fan-outs the
   *       `group_visit_all_logged` ping.
   *    2. Retrospective prompt: any *expired* group_visit at this place
   *       within ±30 days gets queued into retroPromptState so we can ask
   *       "Was this with @X on {date}?". One prompt at a time — we take
   *       the most recent. */
  async function runPostSaveGroupVisitBackfill({ kind, placeId, visitedAt, visitId }) {
    if (!user?.id || !placeId || !visitId) return;
    try {
      await autoAttachVisitToGroupVisits(supabase, {
        userId: user.id,
        kind,
        placeId,
        visitedAt,
        visitId,
      });
      const candidates = await findExpiredGroupVisitCandidates(supabase, {
        userId: user.id,
        kind,
        placeId,
        visitedAt,
      });
      if (candidates.length && !retroPromptState) {
        const next = candidates[0];
        setRetroPromptState({
          groupVisitId: next.groupVisitId,
          kind: next.kind || kind,
          creatorUsername: next.creatorProfile?.username || "",
          creatorDisplayName: next.creatorProfile?.display_name || "",
          restaurantName: next.restaurantName || "",
          visitedAt: next.visitedAt,
          visitId,
        });
      }
    } catch (err) {
      console.warn("[BITE] runPostSaveGroupVisitBackfill threw:", err);
    }
  }

  function handleHeartTap(notif) {
    setShowNotifPanel(false);
    const meta = notif?.meta || {};
    if (!meta.post_id || !meta.post_type) return;
    setHeartSheetTarget({ postId: meta.post_id, postType: meta.post_type });
  }

  function handleDineTagTap(notif) {
    setShowNotifPanel(false);
    const meta = notif.meta || {};
    // Legacy `dine_tag` tap — kept for notifs in the DB from before the
    // 2026-05-04 refactor stopped inserting them. Pre-Phase 5 we used to
    // enrich missing fields from the dine_with_tags row; that table is
    // gone now, so we just trust whatever meta carries. Old rows may have
    // missing city/cuisine — applyDineTagPrefill falls through to a places
    // lookup for those.
    applyDineTagPrefill({
      restaurantName: meta.restaurant_name,
      city: meta.city,
      cuisine: meta.cuisine,
      taggerId: notif.from_user_id,
      entryId: meta.entry_id || null,
      taggerProfile: notif.fromProfile,
      entryType: meta.entry_type || "restaurant",
    });
  }

  /** entry_type in notification meta is "restaurant" | "cafe"; the feed's
   *  post.kind is "rest" | "cafe". Normalize for FeedTab's scroll target. */
  function entryTypeToKind(t) {
    return t === "cafe" ? "cafe" : "rest";
  }

  function handleDineTagBackTap(notif) {
    setShowNotifPanel(false);
    const meta = notif.meta || {};
    if (meta.entry_id && meta.entry_type) {
      setFeedScrollTarget({ postId: meta.entry_id, postType: meta.entry_type, kind: entryTypeToKind(meta.entry_type) });
    }
    // Always land on the feed for "tagged you back" notifs, even when entry_id
    // is missing on legacy rows — feed root is acceptable as a fallback.
    navigate("/community/feed");
  }

  function handleFollowNotifTap(notif) {
    const profile = notif?.fromProfile;
    if (profile?.id) {
      handleOpenNotifProfile(profile);
    } else {
      setShowNotifPanel(false);
      navigate("/community/people/discover");
    }
  }

  function handleDineTagAcceptedTap(notif) {
    setShowNotifPanel(false);
    const meta = notif.meta || {};
    if (meta.entry_id && meta.entry_type) {
      setFeedScrollTarget({ postId: meta.entry_id, postType: meta.entry_type, kind: entryTypeToKind(meta.entry_type) });
    }
    navigate("/community/feed");
  }

  // Legacy tag-mutual handler kept for notifications stored in the DB from
  // before the 2026-05-04 tagging refactor. New `dine_tag` notifications are
  // no longer inserted (see src/_archive/dine-tag-notifications.md), so this
  // is only reachable via old rows. As of the dine_with_tags deprecation
  // (20260526) there's no dine_with_tags row to dismiss either — we just
  // clear the local banner state and refresh the dinedWithMap. The
  // group_visit auto-resolve trigger handles the "they know you were
  // there" signal via the eventual group_visit_all_logged fan-out.
  async function handleDineTagMutualBack(notif) {
    if (!user?.id) return;
    const fromUserId = notif.from_user_id;
    const restaurantName = notif.meta?.restaurant_name || "";
    setDineTags((prev) => prev.filter((t) => t.tagger_id !== fromUserId
      || (t.restaurant_name || "").toLowerCase() !== restaurantName.toLowerCase()));
    fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
  }

  /** "Tag them to my entry" action for `group_visit_tagged` (variant
   *  `auto_linked`). The tagged user already has a matching visit logged
   *  at this place — this handler attaches their existing visit to the
   *  group_visit by flipping their member row to `status='logged'` with
   *  `<kind>_visit_id` set. The auto-resolve trigger handles party-logged
   *  fan-out when the last pending member resolves.
   *
   *  As of 20260528, this also hard-deletes the bell notif (RLS DELETE
   *  policy on notifications allows recipient self-clear) so the bell
   *  badge decrements and the row vanishes on next panel open. The local
   *  `notifications` state stamp keeps the panel rendering "Tagged ✓"
   *  past-tense until the panel closes, so the user gets in-session
   *  confirmation. We also call `refreshDineTags()` so the /add banner
   *  re-pulls from DB and reflects the now-`logged` member row (the
   *  prior name-based local filter was fragile — case/whitespace mismatch
   *  could leave the banner showing). */
  async function handleGroupVisitMutualBack(notif) {
    if (!user?.id || !notif?.id) return;
    const fromUserId = notif.from_user_id;
    if (!fromUserId) return;
    const meta = notif.meta || {};
    if (meta.tagged_back) return;
    const myVisitId = meta.auto_linked_visit_id || null;
    const groupVisitId = meta.group_visit_id || null;
    await Promise.all([
      groupVisitId && myVisitId && joinExistingGroupVisit(supabase, {
        groupVisitId,
        userId: user.id,
        visitId: myVisitId,
      }),
      groupVisitId && resolveGroupVisitTaggedNotif(supabase, {
        userId: user.id,
        groupVisitId,
      }),
    ].filter(Boolean));
    if (myVisitId) {
      fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
      // Tell FeedTab to refetch its co-diner enrichment for loaded posts.
      // RestRow / My Log refreshes via dinedWithMap above; FeedTab keeps its
      // own coDinersByKey state fed by the v2 RPC that wouldn't otherwise
      // see the flipped status until reload.
      setCoDinersRefreshKey((k) => k + 1);
    }
    // Refresh banner state from DB. Replaces a fragile name-based filter
    // that missed when meta.restaurant_name and the banner row's name
    // differed by case/whitespace, leaving the banner showing the now-
    // resolved tag. Source-of-truth is `fetch_pending_tags_for_user`,
    // which already excludes status != 'pending' rows.
    refreshDineTags();
    // Re-poll the bell count — `resolveGroupVisitTaggedNotif` above hard-
    // deleted the row, so the badge should decrement immediately rather
    // than waiting for the next focus/mount.
    refreshNotifCount();
    // Local meta stamp keeps the panel rendering "Tagged ✓" past-tense
    // until the user closes/reopens it; the row vanishes on next open
    // because the DB row is gone.
    setNotifications((prev) => prev.map((n) => (
      n.id === notif.id ? { ...n, meta: { ...(n.meta || {}), tagged_back: true } } : n
    )));
  }

  async function handleNotifSheetFollow(targetId) {
    if (!user?.id) return;
    setNotifSheetBusy(true);
    try {
      await followUser(supabase, user.id, targetId);
      const rel = await getRelation(supabase, user.id, targetId);
      setNotifSheetRelation(rel);
      refreshSocialCounts();
      refreshDineTags();
    } finally {
      setNotifSheetBusy(false);
    }
  }

  async function handleNotifSheetUnfollow(targetId) {
    if (!user?.id) return;
    setNotifSheetBusy(true);
    try {
      await unfollowUser(supabase, user.id, targetId);
      setNotifSheetProfile(null);
      refreshSocialCounts();
      refreshDineTags();
    } finally {
      setNotifSheetBusy(false);
    }
  }


  /** Friends sub-tab calls this when it mounts; we stamp the seen-at and
   *  immediately recount so the badge clears without needing to wait for the
   *  next refresh trigger. */
  const handleMarkFollowersSeen = useCallback(async () => {
    if (!user?.id) return;
    await markFollowersSeen(supabase, user.id);
    await refreshUnseenFollowers();
  }, [user?.id, refreshUnseenFollowers]);

  useEffect(() => { refreshUnseenFollowers(); }, [refreshUnseenFollowers]);
  /** Re-check both follower badge and notif count after any follow action. */
  const refreshSocialCounts = useCallback(async () => {
    await Promise.all([refreshUnseenFollowers(), refreshNotifCount()]);
  }, [refreshUnseenFollowers, refreshNotifCount]);

  useEffect(() => {
    setDineTags([]);
    setDineTagCount(0);
    setDineTagsReady(false);
    if (!user?.id) return;
    try {
      // Cache key bumped to v2 alongside the dine_with_tags → group_visit_members
      // consolidation (20260526). The cached shape carries member_id and
      // group_visit_id fields the legacy banner consumer didn't, so reusing
      // the old key would leave returning users with a banner that fails to
      // tag-back / dismiss until the next refresh.
      const raw = sessionStorage.getItem(`bite_dineTagsCache_v2_${user.id}`);
      if (raw) {
        const { tags, count } = JSON.parse(raw);
        setDineTags(tags || []);
        setDineTagCount(count || 0);
        setDineTagsReady(true);
      }
    } catch {}
  }, [user?.id]);

  const refreshDineTags = useCallback(async () => {
    if (!user?.id) { setDineTags([]); setDineTagCount(0); setDineTagsReady(true); return; }
    const [tags, count, followingIds, followerIds] = await Promise.all([
      fetchUnloggedDineTags(supabase, user.id),
      countUnloggedDineTags(supabase, user.id),
      fetchFollowingIds(supabase, user.id),
      fetchFollowerIds(supabase, user.id),
    ]);
    const dismissed = getTombstonedIds(user.id);
    const filteredTags = dismissed.size ? tags.filter((t) => !dismissed.has(t.id)) : tags;
    const adjustedCount = filteredTags.length < tags.length
      ? Math.max(0, count - (tags.length - filteredTags.length))
      : count;
    setDineTags(filteredTags);
    setDineTagCount(adjustedCount);
    setDineTagsReady(true);
    try { sessionStorage.setItem(`bite_dineTagsCache_v2_${user.id}`, JSON.stringify({ tags: filteredTags, count: adjustedCount })); } catch {}
    setTasteBudIds(followingIds);
    setMutualFollowCount([...followingIds].filter(id => followerIds.has(id)).length);
  }, [user?.id]);

  useEffect(() => { refreshDineTags(); }, [refreshDineTags]);

  const handleFollowChange = useCallback(() => {
    refreshSocialCounts();
    refreshDineTags();
  }, [refreshSocialCounts, refreshDineTags]);

  function dismissGuestOnboarding(openSignIn) {
    setShowGuestOnboarding(false);
    if (openSignIn) {
      guestReachedSignIn.current = true;
      setShowAuthModal(true);
    }
  }

  function completeOnboarding(navigateTo, prefillCity) {
    if (prefillCity) {
      lastCity.current = prefillCity;
      try { if (user?.id) localStorage.setItem(`bite_lastUsedCity_${user.id}`, prefillCity); } catch {}
    }
    setOnboardingDone(true);
    if (user?.id) {
      supabase.from("profiles").update({ has_completed_onboarding: true }).eq("id", user.id);
      try { localStorage.setItem(`bite_welcomeDismissed_${user.id}`, "1"); } catch {}
    }
    if (navigateTo === "/add" && prefillCity) {
      setAddFormKey(k => k + 1);
      setAddPrefill({ city: prefillCity });
    }
    refreshProfile();
    navigate(navigateTo || "/log");
  }

  function handleHomeCitySave(city) {
    lastCity.current = city;
    try { localStorage.setItem(`bite_lastUsedCity_${user.id}`, city); } catch {}
    supabase.from("profiles").update({ home_city: city }).eq("id", user.id)
      .then(({ error }) => { if (error) console.warn("[BITE] save home_city:", error.message); });
  }

  function dismissTasteBudsPrompt(navigateTo) {
    setShowTasteBudsPrompt(false);
    setTasteBudsDone(true);
    if (user?.id) supabase.from("profiles").update({ has_seen_taste_buds_prompt: true }).eq("id", user.id);
    // Only queue the badges card if the user actually has a first entry logged
    if (st.entries.length === 0 && cafes.length === 0) return;
    if (navigateTo) {
      pendingBadgesCard.current = navigateTo;
      try { if (user?.id) sessionStorage.setItem(`bite_pendingBadgesCard_${user.id}`, navigateTo); } catch {}
      navigate(navigateTo);
    } else {
      try { if (user?.id && !localStorage.getItem(`bite_badges_card_${user.id}`)) setShowBadgesCard(true); } catch { setShowBadgesCard(true); }
    }
  }

  // Redirect / → /log (signed-in) or /community/feed (guest).
  useEffect(() => {
    if (!authReady) return;
    if (pathname === "/") navigate(user ? "/log" : "/community/feed", { replace: true });
  }, [authReady, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // /community with no sub-path → /community/feed.
  // Legacy redirects keep old links and notification deep-paths working after
  // the Community IA reshuffle (Friends → People; Groups absorbed into People;
  // Global moved under Explore; Compare stays addressable, off the strip).
  useEffect(() => {
    if (pathname === "/community") {
      navigate("/community/feed", { replace: true });
      return;
    }
    if (pathname === "/community/friends" || pathname.startsWith("/community/friends/")) {
      const tail = pathname.slice("/community/friends".length);
      navigate("/community/people" + tail, { replace: true });
      return;
    }
    if (pathname === "/community/groups") {
      navigate("/community/people/groups", { replace: true });
      return;
    }
    if (pathname === "/community/global") {
      navigate("/community/explore/global", { replace: true });
      return;
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pathname.startsWith("/log")) lastLogPath.current = pathname;
    if (pendingBadgesCard.current !== null && !pathname.startsWith(pendingBadgesCard.current) && user?.id) {
      pendingBadgesCard.current = null;
      const uid = user.id;
      try { sessionStorage.removeItem(`bite_pendingBadgesCard_${uid}`); } catch {}
      // Fetch fresh following IDs so first-follow is accurate regardless of
      // whether refreshDineTags resolved before navigation.
      fetchFollowingIds(supabase, uid).then(ids => {
        setTasteBudIds(ids);
        try { if (!localStorage.getItem(`bite_badges_card_${uid}`)) setShowBadgesCard(true); } catch { setShowBadgesCard(true); }
      }).catch(() => {
        try { if (!localStorage.getItem(`bite_badges_card_${uid}`)) setShowBadgesCard(true); } catch { setShowBadgesCard(true); }
      });
    }
    if (pathname.startsWith("/taste")) lastTastePath.current = pathname;
    if (pathname !== "/add") {
      // Save draft if form has meaningful content
      if (formStateRef.current?.f?.name && user?.id) {
        try {
          localStorage.setItem(`bite_addRating_draft_${user.id}`, JSON.stringify(formStateRef.current));
        } catch {}
      }
      formStateRef.current = null;
      setAddPrefill(null);
      setAddInitialDineWith([]);
      setAddTagTaggerId(null);
      setAddGroupVisitId(null);
    } else {
      // Navigated TO /add — restore draft if no prefill is active
      if (user?.id && !addPrefill) {
        try {
          const raw = localStorage.getItem(`bite_addRating_draft_${user.id}`);
          if (raw) {
            const draft = JSON.parse(raw);
            if (draft?.f?.name) {
              setAddDraftData(draft);
              setAddType(draft.addType || "restaurant");
            }
          }
        } catch {}
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pendingDelete, setPendingDelete] = useState(null);
  const [editR, setEditR] = useState(null);
  const [editC, setEditC] = useState(null);
  const [editDineWith, setEditDineWith] = useState([]);
  const [addType, setAddType] = useState("restaurant");
  const [addSaveErr, setAddSaveErr] = useState(null);
  useEffect(() => { setAddSaveErr(null); }, [addType]);
  const [sortBy, setSortBy] = useState("bite");
  const [sortAsc, setSortAsc] = useState(false);
  const [tiers, setTiers] = useState(new Set());
  const [cityFilter, setCityFilter] = useState(new Set());
  const lastCity = useRef("");
  function persistLastCity(city) {
    if (!city) return;
    const normalized = resolveCity(city) || city;
    lastCity.current = normalized;
    if (!user?.id) return;
    try { localStorage.setItem(`bite_lastUsedCity_${user.id}`, normalized); } catch {}
  }
  const [search, setSearch] = useState("");
  const [contextRestaurant, setContextRestaurant] = useState(null); // { name, idx } for ±3 ranking view
  const [contextDrink, setContextDrink] = useState(null);
  const [contextSweet, setContextSweet] = useState(null);
  const [weights, setWeights] = useState(() => {
    try { const v = localStorage.getItem("bite_restaurantWeights_bootstrap"); if (v) return normalizeWeights(JSON.parse(v)); } catch {}
    return { ...RESTAURANT_WEIGHT_DEFAULTS };
  });
  const [drinkWeights, setDrinkWeights] = useState(() => {
    try { const v = localStorage.getItem("bite_drinkWeights_bootstrap"); if (v) return normalizeWeights(JSON.parse(v)); } catch {}
    return { ...CAFE_WEIGHT_DEFAULTS };
  });
  const [sweetWeights, setSweetWeights] = useState(() => {
    try { const v = localStorage.getItem("bite_sweetWeights_bootstrap"); if (v) return normalizeWeights(JSON.parse(v)); } catch {}
    return { ...CAFE_WEIGHT_DEFAULTS };
  });
  const questL = useMemo(
    () => new Set(st.entries.map((e) => (e.letter || e.cuisine?.[0])?.toUpperCase()).filter(Boolean)),
    [st.entries],
  );

  // Detect newly earned badges and queue a modal for each one.
  // Must be after questL (useMemo above) to avoid temporal dead zone.
  useEffect(() => {
    if (!user?.id) return;
    const badges = evalBadges(st.entries, cafes, weights, questL, tasteBudIds.size, mutualFollowCount);
    const key = `bite_seen_badges_${user.id}`;
    let seen;
    try {
      const stored = localStorage.getItem(key);
      seen = stored ? new Set(JSON.parse(stored)) : null;
    } catch { seen = null; }
    if (seen === null) {
      const allEarned = badges.filter(b => b.earned).map(b => b.id);
      try { localStorage.setItem(key, JSON.stringify(allEarned)); } catch {}
      return;
    }
    const ONBOARDING_BADGE_IDS = new Set(["first-bite", "first-follow"]);
    const newlyEarned = badges.filter(b => b.earned && !seen.has(b.id) && !ONBOARDING_BADGE_IDS.has(b.id));
    if (!newlyEarned.length) return;
    for (const b of newlyEarned) seen.add(b.id);
    try { localStorage.setItem(key, JSON.stringify([...seen])); } catch {}
    setEarnedBadgeQueue(prev => [...prev, ...newlyEarned]);
  }, [user?.id, st.entries, cafes, questL, weights, tasteBudIds.size, mutualFollowCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drain the queue one badge at a time.
  useEffect(() => {
    if (badgeModal || earnedBadgeQueue.length === 0) return;
    const [next, ...rest] = earnedBadgeQueue;
    setBadgeModal(next);
    setEarnedBadgeQueue(rest);
  }, [earnedBadgeQueue, badgeModal]);

  const [cafeSortBy, setCafeSortBy] = useState("bite");
  const [cafeSortAsc, setCafeSortAsc] = useState(false);
  const [cafeFilterMilk, setCafeFilterMilk] = useState("");
  const [cafeFilterBean, setCafeFilterBean] = useState("");
  const [cafeCityFilter, setCafeCityFilter] = useState(new Set());
  const [cafeSearch, setCafeSearch] = useState("");
  const [sweetsSearch, setSweetsSearch] = useState("");
  const [sweetsSortBy, setSweetsSortBy] = useState("bite");
  const [sweetsSortAsc, setSweetsSortAsc] = useState(false);
  const [sweetsTiers, setSweetsTiers] = useState(new Set());
  const [sweetsCityFilter, setSweetsCityFilter] = useState(new Set());
  const [guestSortBy, setGuestSortBy] = useState("bite");
  const [guestSortAsc, setGuestSortAsc] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [guestCafeSortBy, setGuestCafeSortBy] = useState("bite");
  const [guestCafeSortAsc, setGuestCafeSortAsc] = useState(false);
  const [guestCafeSearch, setGuestCafeSearch] = useState("");
  const [guestSweetsSortBy, setGuestSweetsSortBy] = useState("bite");
  const [guestSweetsSortAsc, setGuestSweetsSortAsc] = useState(false);
  const [guestSweetsSearch, setGuestSweetsSearch] = useState("");

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    async function load() {
      try {
        if (!user) {
          dispatch({ type: "LOAD", entries: [] });
          setCafes([]);
          setRestaurantPlaces([]);
          setCafePlaces([]);
          // Clear any stale cache left over from a prior signed-in session so
          // the "+ Want to go" button doesn't inherit another user's saves.
          setWantToGoRows(null, []);
        } else {
          if (import.meta.env.DEV) {
            console.log("[BITE] AuthContext user at load()", {
              id: user.id,
              email: user.email,
            });
          }
          dispatch({ type: "LOAD", entries: [] });
          setCafes([]);
          // Profile sync is owned by AuthContext; we just read visits here.
          // Shared `*_places` catalog is read in parallel for the PlacePicker
          // typeahead — RLS allows authenticated SELECT on all rows.
          const [entries, cafeRows, rPlaces, cPlaces, dwMap, wtgRows] = await Promise.all([
            fetchRestaurantVisitsJoined(supabase, user.id),
            fetchCafeVisitsJoined(supabase, user.id),
            fetchAllRestaurantPlaces(supabase),
            fetchAllCafePlaces(supabase),
            fetchDinedWithByEntry(supabase, user.id),
            listWantToGo(supabase, user.id),
          ]);
          if (import.meta.env.DEV) {
            console.log("[BITE] load() fetched rows", {
              restaurantEntryCount: entries.length,
              cafeRowCount: cafeRows.length,
              restaurantPlaceCount: rPlaces.length,
              cafePlaceCount: cPlaces.length,
              cancelled,
            });
          }
          if (cancelled) return;
          dispatch({ type: "LOAD", entries });
          setCafes(cafeRows);
          setRestaurantPlaces(rPlaces);
          setCafePlaces(cPlaces);
          setDinedWithMap(dwMap);
          // Seed the shared Want-to-Go cache so "+ Want to go" / "✓ saved"
          // buttons on feed posts + the stats sheet reflect DB truth on first
          // paint (not just after opening the Explore > Want to Go tab).
          setWantToGoRows(user.id, wtgRows);
          if (import.meta.env.DEV) {
            console.log("[BITE] reducer LOAD applied", { entriesLength: entries.length });
          }
        }

        if (user) {
          try {
            const rw = localStorage.getItem(`bite_restaurantWeights_${user.id}`);
            if (rw) {
              const parsed = normalizeWeights(JSON.parse(rw));
              setWeights(parsed);
              supabase.from("profiles").update({
                pref_weight_taste: parsed.taste,
                pref_weight_bpb:   parsed.bpb,
                pref_weight_wait:  parsed.wait,
              }).eq("id", user.id).then(({ error }) => { if (error) console.warn("[BITE] weight sync:", error); });
            }
          } catch (e) { console.error("restaurant weights load:", e); }
          try {
            const dw = localStorage.getItem(`bite_drinkWeights_${user.id}`);
            if (dw) setDrinkWeights(normalizeWeights(JSON.parse(dw)));
          } catch (e) { console.error("drink weights load:", e); }
          try {
            const sw = localStorage.getItem(`bite_sweetWeights_${user.id}`);
            if (sw) setSweetWeights(normalizeWeights(JSON.parse(sw)));
          } catch (e) { console.error("sweet weights load:", e); }
          try {
            const ts = localStorage.getItem(`bite_tasteHalfStep_${user.id}`);
            if (ts !== null) setTasteHalfStep(JSON.parse(ts));
          } catch (e) { console.error("taste step load:", e); }
        }

        const { data: sData, error: settingsErr } = await supabase.from("settings").select("*");
        if (settingsErr) console.warn("[BITE] settings:", settingsErr.message);
        if (cancelled) return;
        // questL is now auto-derived from entries (cuisine first letter), no load needed.
      } catch (err) {
        console.error("Supabase load error:", err);
      } finally {
        // Always clear loading shell (React StrictMode can cancel an in-flight load; the next run completes).
        setDbLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authReady, user?.id]);

  /** Each slider is raw 1–10; BITE uses relative mix (see `restaurantWeightRatios` in scoring). */
  function updW(k, v) {
    const nv = Math.round(Math.min(10, Math.max(1, +v)));
    const next = { ...weights, [k]: nv };
    setWeights(next);
    if (user?.id) {
      try { localStorage.setItem(`bite_restaurantWeights_${user.id}`, JSON.stringify(next)); localStorage.setItem("bite_restaurantWeights_bootstrap", JSON.stringify(next)); }
      catch (e) { console.error("restaurant weights save:", e); }
      supabase.from("profiles").update({
        pref_weight_taste: next.taste,
        pref_weight_bpb: next.bpb,
        pref_weight_wait: next.wait,
      }).eq("id", user.id).then(({ error }) => { if (error) console.warn("[BITE] weight sync:", error); });
    }
  }

  function resetWeights(defaults) {
    const next = { ...defaults };
    setWeights(next);
    if (user?.id) {
      try { localStorage.setItem(`bite_restaurantWeights_${user.id}`, JSON.stringify(next)); localStorage.setItem("bite_restaurantWeights_bootstrap", JSON.stringify(next)); }
      catch (e) { console.error("restaurant weights save:", e); }
      supabase.from("profiles").update({
        pref_weight_taste: next.taste,
        pref_weight_bpb: next.bpb,
        pref_weight_wait: next.wait,
      }).eq("id", user.id).then(({ error }) => { if (error) console.warn("[BITE] weight sync:", error); });
    }
  }

  function replaceRestaurantWeights(next) {
    const clamped = clampWeights(next);
    setWeights(clamped);
    if (user?.id) {
      try { localStorage.setItem(`bite_restaurantWeights_${user.id}`, JSON.stringify(clamped)); localStorage.setItem("bite_restaurantWeights_bootstrap", JSON.stringify(clamped)); }
      catch (e) { console.error("restaurant weights save:", e); }
      supabase.from("profiles").update({
        pref_weight_taste: clamped.taste,
        pref_weight_bpb: clamped.bpb,
        pref_weight_wait: clamped.wait,
      }).eq("id", user.id).then(({ error }) => { if (error) console.warn("[BITE] weight sync:", error); });
    }
  }

  function saveTasteStep(half) {
    setTasteHalfStep(half);
    if (user?.id) {
      try { localStorage.setItem(`bite_tasteHalfStep_${user.id}`, JSON.stringify(half)); }
      catch (e) { console.error("taste step save:", e); }
      supabase.from("profiles").update({ pref_taste_half_step: half }).eq("id", user.id).then(({ error }) => { if (error) console.warn("[BITE] weight sync:", error); });
    }
  }

  /** Drinks / sweets weights: same edit-then-Save pattern as restaurants (see PaletteView). */
  function clampWeights(next) {
    return {
      taste: Math.round(Math.min(10, Math.max(1, Number(next.taste) || 1))),
      bpb:   Math.round(Math.min(10, Math.max(1, Number(next.bpb)   || 1))),
      wait:  Math.round(Math.min(10, Math.max(1, Number(next.wait)  || 1))),
    };
  }
  function replaceDrinkWeights(next) {
    const clamped = clampWeights(next);
    setDrinkWeights(clamped);
    if (user?.id) {
      try { localStorage.setItem(`bite_drinkWeights_${user.id}`, JSON.stringify(clamped)); localStorage.setItem("bite_drinkWeights_bootstrap", JSON.stringify(clamped)); }
      catch (e) { console.error("drink weights save:", e); }
      supabase.from("profiles").update({ pref_weight_drink_taste: clamped.taste, pref_weight_drink_bpb: clamped.bpb, pref_weight_drink_wait: clamped.wait }).eq("id", user.id)
        .then(({ error }) => { if (error) console.warn("[BITE] drink weight sync:", error); });
    }
  }
  function replaceSweetWeights(next) {
    const clamped = clampWeights(next);
    setSweetWeights(clamped);
    if (user?.id) {
      try { localStorage.setItem(`bite_sweetWeights_${user.id}`, JSON.stringify(clamped)); localStorage.setItem("bite_sweetWeights_bootstrap", JSON.stringify(clamped)); }
      catch (e) { console.error("sweet weights save:", e); }
      supabase.from("profiles").update({ pref_weight_sweet_taste: clamped.taste, pref_weight_sweet_bpb: clamped.bpb, pref_weight_sweet_wait: clamped.wait }).eq("id", user.id)
        .then(({ error }) => { if (error) console.warn("[BITE] sweet weight sync:", error); });
    }
  }

  function toggleQ() {} // A-Z quest is now auto-derived from logged cuisines

  const sortedR = [...st.entries].sort((a,b)=>{
    let d=0;
    // For each field, d>0 means a should come FIRST in descending (default ↓) order
    // i.e. d = "a is better than b"
    if(sortBy==="bite") d=(calcBiteOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,weights,a.currency_code||"USD")??0)-(calcBiteOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,weights,b.currency_code||"USD")??0);
    else if(sortBy==="taste") d=a.taste-b.taste;
    else if(sortBy==="bpb") d=(toUSD(b.cost,b.currency_code||"USD")/b.portions)-(toUSD(a.cost,a.currency_code||"USD")/a.portions); // lower USD cost = better
    else if(sortBy==="wait") d=b.wait-a.wait; // lower wait = better
    else if(sortBy==="repeat") d=a.repeatability-b.repeatability;
    // sortAsc=false (↓) = best first (d descending), sortAsc=true (↑) = worst first
    return sortAsc?d:-d;
  });

  const restaurantCityCounts = useMemo(() => {
    const m = new Map();
    st.entries.forEach((e) => {
      const c = resolveCity(e.city || "") || "New York City";
      m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [st.entries]);
  const filtered = sortedR.filter(e=>{
    if(tiers.size>0&&!tiers.has(scoreLabel(calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights,e.currency_code||"USD"),t)))return false;
    if(cityFilter.size>0&&!cityFilter.has(resolveCity(e.city||"")||"New York City"))return false;
    if(search.trim()){const q=search.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.cuisine.toLowerCase().includes(q)||(e.city||'NYC').toLowerCase().includes(q)||(e.notes&&e.notes.toLowerCase().includes(q));}
    return true;
  });

  const DRINK_CATS = ["Coffee","Tea","Other"];
  const drinkCityCounts = useMemo(() => {
    const m = new Map();
    cafes.forEach((e) => {
      if (!DRINK_CATS.includes(e.category)) return;
      const c = resolveCity(e.city || "") || "New York City";
      m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafes]);
  const sortedDrinks = [...cafes].filter(e=>DRINK_CATS.includes(e.category)).sort((a,b)=>{
    let d=0;
    if(cafeSortBy==="bite") d=(calcCafeOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,drinkWeights,b.currency_code||"USD")??0)-(calcCafeOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,drinkWeights,a.currency_code||"USD")??0);
    else if(cafeSortBy==="taste") d=b.taste-a.taste;
    else if(cafeSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
    else if(cafeSortBy==="wait") d=a.wait-b.wait;
    else if(cafeSortBy==="repeat") d=b.repeatability-a.repeatability;
    return cafeSortAsc?-d:d;
  }).filter(e=>{
    if(cafeFilterMilk&&e.milkLevel!==cafeFilterMilk)return false;
    if(cafeFilterBean){const origins=Array.isArray(e.beanRegion)?e.beanRegion:(e.beanRegion?[e.beanRegion]:[]);if(!origins.some(o=>regionOf(o)===cafeFilterBean))return false;}
    if(cafeCityFilter.size>0&&!cafeCityFilter.has(resolveCity(e.city||"")||"New York City"))return false;
    if(cafeSearch.trim()){const q=cafeSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q)||(e.city||"New York City").toLowerCase().includes(q);}
    return true;
  });

  const sweetCityCounts = useMemo(() => {
    const m = new Map();
    cafes.forEach((e) => {
      if (e.category !== "Sweets") return;
      const c = resolveCity(e.city || "") || "New York City";
      m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [cafes]);

  /** Union of cities the user has ever entered across restaurant + cafe
   *  visits, so CityInput's autocomplete remembers user-typed cities that
   *  aren't in the canonical alias map. */
  const existingCities = useMemo(() => {
    const set = new Set();
    for (const e of st.entries) { const c = resolveCity((e?.city || "").trim()); if (c) set.add(c); }
    for (const e of cafes)      { const c = resolveCity((e?.city || "").trim()); if (c) set.add(c); }
    return [...set].sort();
  }, [st.entries, cafes]);
  const sortedSweets = [...cafes].filter(e=>e.category==="Sweets").sort((a,b)=>{
    let d=0;
    if(sweetsSortBy==="bite") d=(calcCafeOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,sweetWeights,b.currency_code||"USD")??0)-(calcCafeOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,sweetWeights,a.currency_code||"USD")??0);
    else if(sweetsSortBy==="taste") d=b.taste-a.taste;
    else if(sweetsSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
    else if(sweetsSortBy==="wait") d=a.wait-b.wait;
    else if(sweetsSortBy==="repeat") d=b.repeatability-a.repeatability;
    return sweetsSortAsc?-d:d;
  }).filter(e=>{
    if(sweetsTiers.size>0&&!sweetsTiers.has(scoreLabel(calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,sweetWeights,e.currency_code||"USD"),t)))return false;
    if(sweetsCityFilter.size>0&&!sweetsCityFilter.has(resolveCity(e.city||"")||"New York City"))return false;
    if(sweetsSearch.trim()){const q=sweetsSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q)||(e.city||"New York City").toLowerCase().includes(q);}
    return true;
  });

  /** Group-by-name + sort for each My Log tab. Pagination happens at the
   *  group level (one card = one place) so users see "20 places at a time",
   *  not "20 visits at a time". */
  const restaurantGroups = useMemo(() => {
    const groups = {};
    filtered.forEach((e) => { const k = e.name; if (!groups[k]) groups[k] = []; groups[k].push(e); });
    return Object.values(groups).map((grp) => {
      const e = grp[grp.length - 1];
      const biteVals = grp.map((x) => calcBiteOutOf10(x.taste, x.cost, x.portions, x.wait, x.useR, x.repeatability, weights, x.currency_code||"USD")).filter((v) => v != null);
      const avgBite = biteVals.length ? biteVals.reduce((a, b) => a + b, 0) / biteVals.length : 0;
      const avgTaste = grp.reduce((a, x) => a + x.taste, 0) / grp.length;
      const avgBpb = grp.reduce((a, x) => a + (x.cost / x.portions), 0) / grp.length;
      const avgWait = grp.reduce((a, x) => a + x.wait, 0) / grp.length;
      const avgRepeat = grp.reduce((a, x) => a + x.repeatability, 0) / grp.length;
      const visits = grp.length;
      const sortVal = sortBy === "taste" ? avgTaste
        : sortBy === "bpb" ? -avgBpb
        : sortBy === "wait" ? -avgWait
        : sortBy === "repeat" ? avgRepeat + (visits * 0.001)
        : avgBite;
      return { grp, e, sortVal };
    }).sort((a, b) => sortAsc ? a.sortVal - b.sortVal : b.sortVal - a.sortVal);
  }, [filtered, sortBy, sortAsc, weights]);

  // Full unfiltered rank list for the ±3 context feature (no search/tier/city filters).
  const restaurantGroupsAll = useMemo(() => {
    const groups = {};
    sortedR.forEach((e) => { const k = e.name; if (!groups[k]) groups[k] = []; groups[k].push(e); });
    return Object.values(groups).map((grp) => {
      const e = grp[grp.length - 1];
      const biteVals = grp.map((x) => calcBiteOutOf10(x.taste, x.cost, x.portions, x.wait, x.useR, x.repeatability, weights, x.currency_code||"USD")).filter((v) => v != null);
      const avgBite = biteVals.length ? biteVals.reduce((a, b) => a + b, 0) / biteVals.length : 0;
      const avgTaste = grp.reduce((a, x) => a + x.taste, 0) / grp.length;
      const avgBpb = grp.reduce((a, x) => a + (x.cost / x.portions), 0) / grp.length;
      const avgWait = grp.reduce((a, x) => a + x.wait, 0) / grp.length;
      const avgRepeat = grp.reduce((a, x) => a + x.repeatability, 0) / grp.length;
      const visits = grp.length;
      const sortVal = sortBy === "taste" ? avgTaste
        : sortBy === "bpb" ? -avgBpb
        : sortBy === "wait" ? -avgWait
        : sortBy === "repeat" ? avgRepeat + (visits * 0.001)
        : avgBite;
      return { grp, e, sortVal };
    }).sort((a, b) => sortAsc ? a.sortVal - b.sortVal : b.sortVal - a.sortVal);
  }, [sortedR, sortBy, sortAsc, weights]);

  const restaurantRankMap = useMemo(
    () => new Map(restaurantGroupsAll.map(({ e }, i) => [e.name, i + 1])),
    [restaurantGroupsAll],
  );

  const drinkGroupsAll = useMemo(() => {
    const drinks = cafes.filter(e => DRINK_CATS.includes(e.category));
    const groups = {};
    drinks.forEach(e => { const k = e.name; if (!groups[k]) groups[k] = []; groups[k].push(e); });
    const getSortVal = (grp) => {
      const avg = (fn) => grp.reduce((a, e) => a + fn(e), 0) / grp.length;
      if (cafeSortBy === "taste") return avg(e => e.taste);
      if (cafeSortBy === "bpb") return -avg(e => e.cost / e.portions);
      if (cafeSortBy === "wait") return -avg(e => e.wait);
      if (cafeSortBy === "repeat") return avg(e => e.repeatability) + (grp.length * 0.001);
      return avg(e => calcCafeOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, drinkWeights, e.currency_code||"USD") ?? 0);
    };
    return Object.entries(groups).sort((a, b) => cafeSortAsc ? getSortVal(a[1]) - getSortVal(b[1]) : getSortVal(b[1]) - getSortVal(a[1]));
  }, [cafes, cafeSortBy, cafeSortAsc, drinkWeights]);

  const drinkRankMap = useMemo(
    () => new Map(drinkGroupsAll.map(([name], i) => [name, i + 1])),
    [drinkGroupsAll],
  );

  const sweetGroupsAll = useMemo(() => {
    const sweets = cafes.filter(e => e.category === "Sweets");
    const groups = {};
    sweets.forEach(e => { const k = e.name; if (!groups[k]) groups[k] = []; groups[k].push(e); });
    const getSortVal = (grp) => {
      const avg = (fn) => grp.reduce((a, e) => a + fn(e), 0) / grp.length;
      if (sweetsSortBy === "taste") return avg(e => e.taste);
      if (sweetsSortBy === "bpb") return -avg(e => e.cost / e.portions);
      if (sweetsSortBy === "wait") return -avg(e => e.wait);
      if (sweetsSortBy === "repeat") return avg(e => e.repeatability) + (grp.length * 0.001);
      return avg(e => calcCafeOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, sweetWeights, e.currency_code||"USD") ?? 0);
    };
    return Object.entries(groups).sort((a, b) => sweetsSortAsc ? getSortVal(a[1]) - getSortVal(b[1]) : getSortVal(b[1]) - getSortVal(a[1]));
  }, [cafes, sweetsSortBy, sweetsSortAsc, sweetWeights]);

  const sweetRankMap = useMemo(
    () => new Map(sweetGroupsAll.map(([name], i) => [name, i + 1])),
    [sweetGroupsAll],
  );

  const myRestaurantPlaceIds = useMemo(
    () => new Set([
      ...st.entries.map((e) => e.placeId).filter(Boolean),
      ...cafes.map((e) => e.placeId).filter(Boolean),
    ]),
    [st.entries, cafes],
  );

  const drinkGroups = useMemo(() => {
    const groups = {};
    sortedDrinks.forEach((e) => { const k = e.name; if (!groups[k]) groups[k] = []; groups[k].push(e); });
    const getSortVal = (grp) => {
      const avg = (fn) => grp.reduce((a, e) => a + fn(e), 0) / grp.length;
      if (cafeSortBy === "taste") return avg((e) => e.taste);
      if (cafeSortBy === "bpb") return -avg((e) => e.cost / e.portions);
      if (cafeSortBy === "wait") return -avg((e) => e.wait);
      if (cafeSortBy === "repeat") return avg((e) => e.repeatability) + (grp.length * 0.001);
      return avg((e) => calcCafeOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, drinkWeights, e.currency_code||"USD") ?? 0);
    };
    return Object.entries(groups).sort((a, b) => cafeSortAsc ? getSortVal(a[1]) - getSortVal(b[1]) : getSortVal(b[1]) - getSortVal(a[1]));
  }, [sortedDrinks, cafeSortBy, cafeSortAsc, drinkWeights]);

  const sweetGroups = useMemo(() => {
    const groups = {};
    sortedSweets.forEach((e) => { const k = e.name; if (!groups[k]) groups[k] = []; groups[k].push(e); });
    const getSortVal = (grp) => {
      const avg = (fn) => grp.reduce((a, e) => a + fn(e), 0) / grp.length;
      if (sweetsSortBy === "taste") return avg((e) => e.taste);
      if (sweetsSortBy === "bpb") return -avg((e) => e.cost / e.portions);
      if (sweetsSortBy === "wait") return -avg((e) => e.wait);
      if (sweetsSortBy === "repeat") return avg((e) => e.repeatability) + (grp.length * 0.001);
      return avg((e) => calcCafeOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, sweetWeights, e.currency_code||"USD") ?? 0);
    };
    return Object.entries(groups).sort((a, b) => sweetsSortAsc ? getSortVal(a[1]) - getSortVal(b[1]) : getSortVal(b[1]) - getSortVal(a[1]));
  }, [sortedSweets, sweetsSortBy, sweetsSortAsc, sweetWeights]);

  /** Pagination tails. Reset on every sort/filter/search/tab change so the
   *  user lands at the top of the new results. */
  const restaurantGroupsPage = usePaginatedList(
    restaurantGroups,
    `${sortBy}|${sortAsc}|${[...cityFilter].sort().join(",")}|${search}|${[...tiers].join(",")}|${logTab}`,
  );
  const drinkGroupsPage = usePaginatedList(
    drinkGroups,
    `${cafeSortBy}|${cafeSortAsc}|${cafeFilterMilk}|${cafeFilterBean}|${[...cafeCityFilter].sort().join(",")}|${cafeSearch}|${logTab}`,
  );
  const sweetGroupsPage = usePaginatedList(
    sweetGroups,
    `${sweetsSortBy}|${sweetsSortAsc}|${[...sweetsTiers].join(",")}|${[...sweetsCityFilter].sort().join(",")}|${sweetsSearch}|${logTab}`,
  );

  const tierFilterRows = rating010FilterRows(t);
  const tabSt = (on) => ({padding:"7px 18px",borderRadius:20,border:"1.5px solid "+(on?"#F0997B":"rgba(255,255,255,0.1)"),background:on?"#3C1F13":"transparent",color:on?"#F0997B":"#888780",fontSize:13,fontWeight:on?500:400,cursor:"pointer"});

  function getDisplay(e) {
    if(sortBy==="taste"){const tv=e.taste,lbl=tasteLabel(tv,t),col=tasteColor(tv);return{val:tv.toFixed(1),label:lbl,color:col};}
    if(sortBy==="bpb"){const sym=CURRENCY_SYMBOLS[homeCurrency]||"$";const usdPP=toUSD(e.cost,e.currency_code||"USD")/e.portions;const pp=fromUSD(usdPP,homeCurrency);return{val:sym+pp.toFixed(2),label:t.perPortion,color:"#5B9BD5"};}
    if(sortBy==="wait") return{val:e.wait+" min",label:t.waitLabel,color:"#888780"};
    if(sortBy==="repeat") return{val:e.useR?("⭐".repeat(e.repeatability)||"✕"):t.off,label:e.useR?(e.repeatability===3?t.mustReturnLabel:e.repeatability===2?t.wouldSeekOutLabel:e.repeatability===1?t.ifOccasionCallsLabel:t.wouldntReturnLabel):"off",color:"#EF9F27"};
    const sc=calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights,e.currency_code||"USD");
    return{val:sc!=null?sc.toFixed(2):"—",label:scoreLabel(sc,t),color:scoreColor(sc)};
  }

  /** Keep the local PlacePicker catalog warm: any time `ensure*Place` resolves a
   *  placeId we don't yet know about (newly inserted, or matched via ilike to a
   *  row we hadn't loaded), append it so the dropdown reflects reality without
   *  a full refetch. When the row is already present, merge any **new** fields
   *  in (e.g. verified_* fields freshly populated by `places-resolve` arriving
   *  for a row we already had under a different lookup) — but never overwrite
   *  existing non-empty values, so user-typed fallbacks aren't clobbered by
   *  empty Google data. */
  function upsertPlace(setter, placeId, fields) {
    setter((cur) => {
      const idx = cur.findIndex((p) => p.id === placeId);
      if (idx === -1) return [...cur, { id: placeId, ...fields }];
      const existing = cur[idx];
      const merged = { ...existing };
      for (const [k, v] of Object.entries(fields || {})) {
        if (v == null || v === "") continue;
        if (merged[k] == null || merged[k] === "") merged[k] = v;
      }
      const next = cur.slice();
      next[idx] = merged;
      return next;
    });
  }

  async function insertCafeEntry(entry) {
    if (!user) return null;
    try {
      const placeId = await ensureCafePlace(supabase, {
        placeId: entry.placeId || null,
        name: entry.name,
        city: entry.city || "",
      });
      upsertPlace(setCafePlaces, placeId, {
        name: entry.name,
        city: entry.city || "",
      });
      const cafeWeights = entry.category === "Sweets" ? sweetWeights : drinkWeights;
      const { data, error } = await supabase
        .from("cafe_visits")
        .insert([cafeVisitInsertPayload(placeId, user.id, entry, cafeWeights)])
        .select(CAFE_VISIT_SELECT);
      if (error) console.error("cafe insert error:", error);
      const mapped = (data || []).map((row) => mapCafeVisitRow(row));
      setCafes((p) => [...p, ...mapped]);
      // Auto-remove from Want to Go now that the viewer has actually been.
      // Fire-and-forget; removeWantToGo no-ops if the row doesn't exist.
      if (mapped.length) removeWantToGo(supabase, user.id, { placeId, kind: "cafe" });
      return mapped[0] || null;
    } catch (err) {
      console.error("cafe insert threw:", err);
      return null;
    }
  }

  return (
    <LangContext.Provider value={{t,lang}}>
    <div style={{fontFamily:"var(--font-sans)",maxWidth:640,margin:"0 auto",padding:"1.25rem 1rem max(8rem, env(safe-area-inset-bottom)) 1rem",background:"#141413",minHeight:"100vh",color:"#F1EFE8",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap');
        input,select,textarea{background:#252523!important;color:#F1EFE8!important;border:1px solid rgba(255,255,255,0.2)!important;border-radius:8px;padding:9px 12px;font-size:16px!important;font-family:inherit!important;}
        input:focus,textarea:focus{border-color:#F0997B!important;outline:none;}
        input::placeholder,textarea::placeholder{color:#666663!important;font-size:13px!important;}
        input[type=range]{accent-color:#F0997B;padding:0;border:none!important;background:transparent!important;}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}
      `}</style>

      <div style={{marginBottom:"1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{ flexShrink: 0, position: "relative" }}>
            <MouthLogo />
          </div>
          <div>
            <h1 style={{fontSize:28,fontWeight:600,color:"#F0997B",margin:0,fontFamily:"'Fredoka',sans-serif"}}>BITE Score</h1>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {user && (
            <div ref={notifContainerRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={openNotifPanel}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", position: "relative", lineHeight: 0, color: "#F1EFE8" }}
                title="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {notifCount > 0 && (
                  <span style={{
                    position: "absolute", top: 0, right: 0,
                    minWidth: 16, height: 16, padding: "0 3px",
                    borderRadius: 8, background: "#E85A5A",
                    color: "#FFF", fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1, boxSizing: "border-box",
                    border: "1.5px solid #141413",
                  }}>
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                )}
              </button>
              {showNotifPanel && (
                <NotificationPanel
                  notifications={annotatedNotifications}
                  resolvedDineTagIds={resolvedDineTagIds}
                  loading={notifLoading}
                  onClose={() => setShowNotifPanel(false)}
                  onFollowBack={handleNotifFollowBack}
                  onRefetch={refetchNotifications}
                  onOpenProfile={handleOpenNotifProfile}
                  onDineTagTap={handleDineTagTap}
                  onDineTagBackTap={handleDineTagBackTap}
                  onFollowTap={handleFollowNotifTap}
                  onDineTagAcceptedTap={handleDineTagAcceptedTap}
                  onHeartTap={handleHeartTap}
                  onTagMutualBack={handleDineTagMutualBack}
                  onGroupVisitMutualBack={handleGroupVisitMutualBack}
                  onGroupVisitTaggedTap={handleGroupVisitTaggedTap}
                  onGroupVisitLoggedTap={handleGroupVisitLoggedTap}
                  onGroupVisitAllLoggedTap={handleGroupVisitAllLoggedTap}
                  sheetOpen={!!notifSheetProfile || !!heartSheetTarget || !!sameDinnerPending || !!pickVisitState || !!retroPromptState}
                  anchorPos={notifAnchorPos}
                  followingIds={notifFollowingIds}
                />
              )}
            </div>
          )}
          <button type="button" onClick={()=>user?setShowSelfSheet(true):setShowAuthModal(true)} style={{fontSize:11,fontWeight:500,padding:"5px 12px",borderRadius:20,border:"1.5px solid rgba(255,255,255,0.2)",background:user?"#3C1F13":"transparent",color:user?"#F0997B":"#888780",cursor:"pointer",letterSpacing:"0.03em",flexShrink:0,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={user?.email||t.signIn}>{user?(username||user.email?.split("@")[0]||t.account):t.signIn}</button>
        </div>
      </div>

      {!authReady && (
        <p style={{ fontSize: 14, color: "#888780", margin: "8px 0 0" }}>
          Connecting…
        </p>
      )}

      {authReady && (
      <>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:640,background:"#1A1A18",borderTop:"0.5px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-around",alignItems:"center",padding:"8px 0 max(8px,env(safe-area-inset-bottom))",zIndex:100}}>
        {[["log","/log","📋",t.myLog],["palette","/taste","😋",t.myTaste],["add","/add","➕",t.add],["community","/community/feed","🌐",t.communityTab],["faq","/faq","❓",t.faq]].map(([v,to,icon,label])=>{
          const badge = v==="community" && unseenFollowers > 0 ? unseenFollowers : 0;
          const active = v==="log"?pathname.startsWith("/log"):v==="community"?pathname.startsWith("/community"):v==="palette"?pathname.startsWith("/taste"):pathname===to;
          return (
            <button key={v} onClick={()=>{const dest=v==="log"?lastLogPath.current:v==="palette"?lastTastePath.current:to;navigate(dest);setEditR(null);setEditC(null);window.scrollTo({top:0,behavior:"instant"});}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 8px",minWidth:56}}>
              {v==="add"?(
                <div style={{position:"relative",marginTop:-8,marginBottom:2}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:"#F0997B",border:"2px solid #F0997B",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:22,lineHeight:1,color:"#141413"}}>➕</span>
                  </div>
                  {dineTagCount>0&&<span style={{position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:"#F0997B",border:"2px solid #1A1A18"}}/>}
                </div>
              ):(
                <span style={{fontSize:20,lineHeight:1,position:"relative",display:"inline-block"}}>
                  {icon}
                  {badge>0 && (
                    <span style={{position:"absolute",top:-4,right:-10,minWidth:16,height:16,padding:"0 4px",borderRadius:8,background:"#E85A5A",color:"#FFF",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxSizing:"border-box",border:"1.5px solid #1A1A18"}}>
                      {badge>99 ? "99+" : badge}
                    </span>
                  )}
                </span>
              )}
              <span style={{fontSize:10,color:active?"#F0997B":"#888780",fontWeight:active?500:400,transition:"color 0.15s"}}>{label}</span>
              {active&&v!=="add"&&<div style={{width:4,height:4,borderRadius:"50%",background:"#F0997B",marginTop:1}}/>}
            </button>
          );
        })}
      </div>

      {/* ── My Log ── */}
      {pathname.startsWith("/log")&&!editR&&!editC&&!user&&(
        <div>
          <div style={{ fontSize:11, color:"#888780", background:"rgba(255,255,255,0.04)",
            border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:7,
            padding:"5px 10px", marginBottom:12, display:"flex", alignItems:"center",
            justifyContent:"space-between", flexWrap:"wrap", gap:4 }}>
            <span>Preview — entries only last this session.</span>
            <button type="button" onClick={() => setShowAuthModal(true)}
              style={{ background:"none", border:"none", padding:0,
                color:"#F0997B", fontSize:11, cursor:"pointer", fontWeight:500 }}>
              Sign in to save
            </button>
          </div>
          <div style={{ marginBottom:8 }}>
            <CategoryTabs active={logTab}
              onChange={v => navigate(v === "restaurants" ? "/log" : "/log/" + v)} />
          </div>
          <div style={{ borderBottom:"0.5px solid rgba(255,255,255,0.08)", marginBottom:12 }} />
          {logTab === "restaurants" && (() => {
            const q = guestSearch.trim().toLowerCase();
            const filtered = q ? guestEntries.filter(e => e.name.toLowerCase().includes(q) || (e.city||"").toLowerCase().includes(q)) : guestEntries;
            const sorted = [...filtered].sort((a,b)=>{
              let d=0;
              if(guestSortBy==="bite") d=(calcBiteOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,weights,b.currency_code||"USD")??0)-(calcBiteOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,weights,a.currency_code||"USD")??0);
              else if(guestSortBy==="taste") d=b.taste-a.taste;
              else if(guestSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
              else if(guestSortBy==="wait") d=a.wait-b.wait;
              else if(guestSortBy==="repeat") d=b.repeatability-a.repeatability;
              return guestSortAsc?-d:d;
            });
            return (
              <>
                <SortFilterToolbar
                  viewBy={guestSortBy}
                  onViewBy={setGuestSortBy}
                  viewOptions={[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat",t.repeatability]]}
                  search={guestSearch}
                  onSearch={setGuestSearch}
                  sortAsc={guestSortAsc}
                  onToggleSortAsc={()=>setGuestSortAsc(a=>!a)}
                />
                {sorted.map(e => {
                  const sc = calcBiteOutOf10(e.taste, e.cost, e.portions, e.wait, e.useR, e.repeatability, weights, e.currency_code||"USD");
                  return (
                    <RestRow key={e.id} e={e}
                      display={{ val: sc!=null ? sc.toFixed(2) : "—", label: scoreLabel(sc,t), color: scoreColor(sc) }}
                      user={GUEST_USER} visits={1} group={[e]} weights={weights}
                      onEdit={entry => { setEditR(entry); setEditDineWith([]); window.scrollTo({top:0,behavior:"smooth"}); }}
                      onDelete={id => setGuestEntries(p => p.filter(x => x.id !== id))}
                    />
                  );
                })}
              </>
            );
          })()}
          {logTab === "drinks" && (() => {
            const drinks = guestCafes.filter(e => e.category !== "Sweets");
            const q = guestCafeSearch.trim().toLowerCase();
            const filtered = q ? drinks.filter(e => e.name.toLowerCase().includes(q) || e.order.toLowerCase().includes(q) || (e.city||"").toLowerCase().includes(q)) : drinks;
            const sorted = [...filtered].sort((a,b)=>{
              let d=0;
              if(guestCafeSortBy==="bite") d=(calcCafeOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,drinkWeights,b.currency_code||"USD")??0)-(calcCafeOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,drinkWeights,a.currency_code||"USD")??0);
              else if(guestCafeSortBy==="taste") d=b.taste-a.taste;
              else if(guestCafeSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
              else if(guestCafeSortBy==="wait") d=a.wait-b.wait;
              else if(guestCafeSortBy==="repeat") d=b.repeatability-a.repeatability;
              return guestCafeSortAsc?-d:d;
            });
            return (
              <>
                <SortFilterToolbar
                  viewBy={guestCafeSortBy}
                  onViewBy={setGuestCafeSortBy}
                  viewOptions={[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat",t.repeatability]]}
                  search={guestCafeSearch}
                  onSearch={setGuestCafeSearch}
                  sortAsc={guestCafeSortAsc}
                  onToggleSortAsc={()=>setGuestCafeSortAsc(a=>!a)}
                />
                {sorted.map(e => (
                  <CafeGroupRow key={e.id} group={[e]} cafeSortBy={guestCafeSortBy} weights={drinkWeights}
                    user={GUEST_USER}
                    onEdit={entry => { setEditC(entry); setEditDineWith([]); window.scrollTo({top:0,behavior:"smooth"}); }}
                    onDelete={id => setGuestCafes(p => p.filter(x => x.id !== id))}
                  />
                ))}
              </>
            );
          })()}
          {logTab === "sweets" && (() => {
            const sweets = guestCafes.filter(e => e.category === "Sweets");
            const q = guestSweetsSearch.trim().toLowerCase();
            const filtered = q ? sweets.filter(e => e.name.toLowerCase().includes(q) || e.order.toLowerCase().includes(q) || (e.city||"").toLowerCase().includes(q)) : sweets;
            const sorted = [...filtered].sort((a,b)=>{
              let d=0;
              if(guestSweetsSortBy==="bite") d=(calcCafeOutOf10(b.taste,b.cost,b.portions,b.wait,b.useR,b.repeatability,sweetWeights,b.currency_code||"USD")??0)-(calcCafeOutOf10(a.taste,a.cost,a.portions,a.wait,a.useR,a.repeatability,sweetWeights,a.currency_code||"USD")??0);
              else if(guestSweetsSortBy==="taste") d=b.taste-a.taste;
              else if(guestSweetsSortBy==="bpb") d=(a.cost/a.portions)-(b.cost/b.portions);
              else if(guestSweetsSortBy==="wait") d=a.wait-b.wait;
              else if(guestSweetsSortBy==="repeat") d=b.repeatability-a.repeatability;
              return guestSweetsSortAsc?-d:d;
            });
            return (
              <>
                <SortFilterToolbar
                  viewBy={guestSweetsSortBy}
                  onViewBy={setGuestSweetsSortBy}
                  viewOptions={[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat",t.repeatability]]}
                  search={guestSweetsSearch}
                  onSearch={setGuestSweetsSearch}
                  sortAsc={guestSweetsSortAsc}
                  onToggleSortAsc={()=>setGuestSweetsSortAsc(a=>!a)}
                />
                {sorted.map(e => (
                  <CafeGroupRow key={e.id} group={[e]} cafeSortBy={guestSweetsSortBy} weights={sweetWeights}
                    user={GUEST_USER}
                    onEdit={entry => { setEditC(entry); setEditDineWith([]); window.scrollTo({top:0,behavior:"smooth"}); }}
                    onDelete={id => setGuestCafes(p => p.filter(x => x.id !== id))}
                  />
                ))}
              </>
            );
          })()}
        </div>
      )}
      {pathname.startsWith("/log")&&!editR&&!editC&&user&&!dbLoaded&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
          {[1,2,3,4,5].map(i=>(
            <div key={i} style={{background:"#1E1E1C",borderRadius:10,height:62,opacity:0.4+i*0.08,animation:"pulse 1.2s ease-in-out infinite"}}/>
          ))}
        </div>
      )}
      {pathname.startsWith("/log")&&!editR&&!editC&&user&&dbLoaded&&(
        <div>
          <div style={{marginBottom:12}}>
            <div style={{marginBottom:8}}>
              <CategoryTabs active={logTab} onChange={(v) => navigate(v === "restaurants" ? "/log" : "/log/" + v)} />
            </div>
            {user&&<SwipeHint userId={user.id} hint={t.swipeHint}/>}
          </div>
          <div style={{borderBottom:"0.5px solid rgba(255,255,255,0.08)",marginBottom:12}}/>

          {logTab==="restaurants"&&(
            <div>
              <SortFilterToolbar
                viewBy={sortBy}
                onViewBy={setSortBy}
                viewOptions={[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat",t.repeatability]]}
                cityCounts={restaurantCityCounts}
                selectedCities={cityFilter}
                onCitiesChange={setCityFilter}
                search={search}
                onSearch={(v)=>{setSearch(v);setContextRestaurant(null);}}
                filterContent={
                  <>
                    <div style={{padding:"6px 10px",borderBottom:"0.5px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={S.sm}>{t.filterByTier}</span>
                      {tiers.size>0&&<button type="button" onClick={()=>setTiers(new Set())} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:0}}>{t.clear}</button>}
                    </div>
                    {tierFilterRows.map(([tier,col])=>{
                      const on=tiers.has(tier);
                      const cnt=sortedR.filter(e=>scoreLabel(calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights,e.currency_code||"USD"),t)===tier).length;
                      return(
                        <div key={tier} onClick={()=>setTiers(p=>{const n=new Set(p);on?n.delete(tier):n.add(tier);return n;})} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:"0.5px solid rgba(255,255,255,0.1)",cursor:"pointer",background:on?"rgba(255,255,255,0.03)":"transparent"}}>
                          <div style={{width:13,height:13,borderRadius:3,border:"1.5px solid "+(on?col:"rgba(255,255,255,0.1)"),background:on?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<span style={{color:"#141413",fontSize:9,fontWeight:700,lineHeight:1}}>✓</span>}</div>
                          <span style={{flex:1,fontSize:12,color:on?col:"#F1EFE8",fontWeight:on?500:400}}>{tier}</span>
                          <span style={S.sm}>{cnt}</span>
                        </div>
                      );
                    })}
                  </>
                }
                filterActive={tiers.size>0}
                sortAsc={sortAsc}
                onToggleSortAsc={()=>setSortAsc(a=>!a)}
              />
              {st.entries.length===0&&(
                <div style={{position:"relative",marginBottom:8}}>
                  <div style={{opacity:0.45,pointerEvents:"none"}}>
                    <RestRow
                      e={EXAMPLE_RESTAURANT}
                      display={getDisplay(EXAMPLE_RESTAURANT)}
                      user={user}
                      visits={1}
                      group={[EXAMPLE_RESTAURANT]}
                      weights={weights}
                      homeCurrency={homeCurrency}
                      dinedWithForEntry={()=>[]}
                      onEdit={()=>{}}
                      onDelete={()=>{}}
                    />
                  </div>
                  <div style={{position:"absolute",top:8,right:8,fontSize:10,fontWeight:700,letterSpacing:"0.08em",color:"#888780",textTransform:"uppercase",background:"#252523",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:6,padding:"2px 7px"}}>SAMPLE</div>
                </div>
              )}
              {filtered.length===0&&<p style={{color:"#888780",fontSize:14}}>{sortedR.length===0?t.noRestaurantsYet:t.noEntries}</p>}
              {contextRestaurant ? (
                <div>
                  <button type="button" onClick={()=>setContextRestaurant(null)} style={{fontSize:12,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:"4px 0 10px",display:"flex",alignItems:"center",gap:4}}>
                    ← Back to full list
                  </button>
                  {restaurantGroupsAll.slice(Math.max(0,contextRestaurant.idx-3),contextRestaurant.idx+4).map(({grp,e},i)=>{
                    const absRank=Math.max(1,contextRestaurant.idx-2)+i;
                    const isCenter=e.name===contextRestaurant.name;
                    const visits=grp.length;
                    const display=getDisplay(e);
                    return (
                      <div key={e.id} style={isCenter?{outline:"1.5px solid #F0997B",borderRadius:10,marginBottom:6}:{marginBottom:6}}>
                        <RestRow rank={absRank} e={e} display={display} user={user} visits={visits} group={grp} weights={weights} homeCurrency={homeCurrency} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]} viewerProfile={viewerProfile}
                          onEdit={v=>{const entry=v||e;setEditR(entry);setEditDineWith(dinedWithMap.get(entry.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}}
                          onDelete={id=>{
                            const did=id||e.id;
                            const row=st.entries.find(x=>x.id===did);
                            if(!canMutateVisit(row,user))return;
                            setPendingDelete({onConfirm:async()=>{
                              try{await supabase.from("restaurant_visits").delete().eq("id",did);}catch(err){console.error("restaurant delete threw:",err);}
                              posthog.capture("visit deleted", { kind: "restaurant", place_name: row?.name });
                              dispatch({type:"DEL",id:did});
                            }});
                          }}/>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {restaurantGroupsPage.visible.map(({grp,e},i)=>{
                    const visits=grp.length;
                    const display=getDisplay(e);
                    return (
                      <div key={e.id}>
                        <RestRow rank={restaurantRankMap.get(e.name) ?? i+1} e={e} display={display} user={user} visits={visits} group={grp} weights={weights} homeCurrency={homeCurrency} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]} viewerProfile={viewerProfile}
                          onEdit={v=>{const entry=v||e;setEditR(entry);setEditDineWith(dinedWithMap.get(entry.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}}
                          onDelete={id=>{
                            const did=id||e.id;
                            const row=st.entries.find(x=>x.id===did);
                            if(!canMutateVisit(row,user))return;
                            setPendingDelete({onConfirm:async()=>{
                              try{await supabase.from("restaurant_visits").delete().eq("id",did);}catch(err){console.error("restaurant delete threw:",err);}
                              posthog.capture("visit deleted", { kind: "restaurant", place_name: row?.name });
                              dispatch({type:"DEL",id:did});
                            }});
                          }}/>
                        {search.trim() && (
                          <button type="button" onClick={()=>{
                            const idx=restaurantGroupsAll.findIndex(g=>g.e.name===e.name);
                            if(idx>=0){setSearch("");setContextRestaurant({name:e.name,idx});}
                          }} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:"2px 0 6px 58px",display:"block"}}>
                            Show ±3 rankings around #{restaurantRankMap.get(e.name)}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              <ShowMoreButton
                remaining={restaurantGroupsPage.remaining}
                pageSize={restaurantGroupsPage.pageSize}
                onClick={restaurantGroupsPage.showMore}
              />
            </div>
          )}

          {logTab==="drinks"&&(
            <div>
              <SortFilterToolbar
                viewBy={cafeSortBy}
                onViewBy={setCafeSortBy}
                viewOptions={[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat",t.repeatability]]}
                cityCounts={drinkCityCounts}
                selectedCities={cafeCityFilter}
                onCitiesChange={setCafeCityFilter}
                search={cafeSearch}
                onSearch={(v)=>{setCafeSearch(v);setContextDrink(null);}}
                filterContent={
                  <div style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <span style={S.sm}>Filter</span>
                      {(cafeFilterMilk||cafeFilterBean)&&<button type="button" onClick={()=>{setCafeFilterMilk("");setCafeFilterBean("");}} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:0}}>{t.clear}</button>}
                    </div>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:11,color:"#888780",marginBottom:6}}>{t.milk}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {["None","Light","Medium","Heavy"].map(m=>(
                          <div key={m} onClick={()=>setCafeFilterMilk(cafeFilterMilk===m?"":m)} style={{padding:"4px 8px",borderRadius:12,cursor:"pointer",fontSize:11,background:cafeFilterMilk===m?"#3C1F13":"#141413",border:"1px solid "+(cafeFilterMilk===m?"#F0997B":"rgba(255,255,255,0.1)"),color:cafeFilterMilk===m?"#F0997B":"#888780"}}>{m}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#888780",marginBottom:6}}>{t.beanOrigin}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {BEAN_REGIONS.filter(b=>b!=="Other").map(b=>(
                          <div key={b} onClick={()=>setCafeFilterBean(cafeFilterBean===b?"":b)} style={{padding:"4px 8px",borderRadius:12,cursor:"pointer",fontSize:11,background:cafeFilterBean===b?"#3C1F13":"#141413",border:"1px solid "+(cafeFilterBean===b?"#F0997B":"rgba(255,255,255,0.1)"),color:cafeFilterBean===b?"#F0997B":"#888780"}}>{b}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                }
                filterActive={!!(cafeFilterMilk||cafeFilterBean)}
                sortAsc={cafeSortAsc}
                onToggleSortAsc={()=>setCafeSortAsc(a=>!a)}
              />
              {!sortedDrinks.length&&<p style={{color:"#888780",fontSize:14}}>{cafes.some(e=>DRINK_CATS.includes(e.category))?t.noEntries:t.noDrinks}</p>}
              {contextDrink ? (
                <div>
                  <button type="button" onClick={()=>setContextDrink(null)} style={{fontSize:12,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:"4px 0 10px",display:"flex",alignItems:"center",gap:4}}>← Back to full list</button>
                  {drinkGroupsAll.slice(Math.max(0,contextDrink.idx-3),contextDrink.idx+4).map(([name,grp],i)=>{
                    const absRank=Math.max(1,contextDrink.idx-2)+i;
                    const isCenter=name===contextDrink.name;
                    return(
                      <div key={name} style={isCenter?{outline:"1.5px solid #F0997B",borderRadius:10,marginBottom:6}:{marginBottom:6}}>
                        <CafeGroupRow rank={absRank} group={grp} cafeSortBy={cafeSortBy} weights={drinkWeights} user={user} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]} viewerProfile={viewerProfile} onEdit={e=>{setEditC(e);setEditDineWith(dinedWithMap.get(e.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={id=>{const row=cafes.find(x=>x.id===id);if(!canMutateVisit(row,user))return;setPendingDelete({onConfirm:async()=>{try{await supabase.from("cafe_visits").delete().eq("id",id);}catch(err){console.error("cafe delete threw:",err);}setCafes(p=>p.filter(x=>x.id!==id));}});}}/>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {drinkGroupsPage.visible.map(([name,grp],i)=>(
                    <div key={name}>
                      <CafeGroupRow rank={i+1} group={grp} cafeSortBy={cafeSortBy} weights={drinkWeights} user={user} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]} viewerProfile={viewerProfile} onEdit={e=>{setEditC(e);setEditDineWith(dinedWithMap.get(e.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={id=>{const row=cafes.find(x=>x.id===id);if(!canMutateVisit(row,user))return;setPendingDelete({onConfirm:async()=>{try{await supabase.from("cafe_visits").delete().eq("id",id);}catch(err){console.error("cafe delete threw:",err);}setCafes(p=>p.filter(x=>x.id!==id));}});}}/>
                      {cafeSearch.trim()&&(
                        <button type="button" onClick={()=>{const idx=drinkGroupsAll.findIndex(([n])=>n===name);if(idx>=0){setCafeSearch("");setContextDrink({name,idx});}}} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:"2px 0 6px 58px",display:"block"}}>
                          Show ±3 rankings around #{drinkRankMap.get(name)}
                        </button>
                      )}
                    </div>
                  ))}
                  <ShowMoreButton
                    remaining={drinkGroupsPage.remaining}
                    pageSize={drinkGroupsPage.pageSize}
                    onClick={drinkGroupsPage.showMore}
                  />
                </>
              )}
            </div>
          )}

          {logTab==="sweets"&&(
            <div>
              <SortFilterToolbar
                viewBy={sweetsSortBy}
                onViewBy={setSweetsSortBy}
                viewOptions={[["bite","BITE"],["taste",t.taste],["bpb",t.bangBuck],["wait",t.wait],["repeat",t.repeatability]]}
                cityCounts={sweetCityCounts}
                selectedCities={sweetsCityFilter}
                onCitiesChange={setSweetsCityFilter}
                search={sweetsSearch}
                onSearch={(v)=>{setSweetsSearch(v);setContextSweet(null);}}
                filterContent={
                  <>
                    <div style={{padding:"6px 10px",borderBottom:"0.5px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={S.sm}>{t.filterByTier}</span>
                      {sweetsTiers.size>0&&<button type="button" onClick={()=>setSweetsTiers(new Set())} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:0}}>{t.clear}</button>}
                    </div>
                    {tierFilterRows.map(([tier,col])=>{
                      const on=sweetsTiers.has(tier);
                      const cnt=cafes.filter(e=>e.category==="Sweets"&&scoreLabel(calcCafeOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,sweetWeights,e.currency_code||"USD"),t)===tier).length;
                      return(
                        <div key={tier} onClick={()=>setSweetsTiers(p=>{const n=new Set(p);on?n.delete(tier):n.add(tier);return n;})} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:"0.5px solid rgba(255,255,255,0.1)",cursor:"pointer",background:on?"rgba(255,255,255,0.03)":"transparent"}}>
                          <div style={{width:13,height:13,borderRadius:3,border:"1.5px solid "+(on?col:"rgba(255,255,255,0.1)"),background:on?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<span style={{color:"#141413",fontSize:9,fontWeight:700,lineHeight:1}}>✓</span>}</div>
                          <span style={{flex:1,fontSize:12,color:on?col:"#F1EFE8",fontWeight:on?500:400}}>{tier}</span>
                          <span style={S.sm}>{cnt}</span>
                        </div>
                      );
                    })}
                  </>
                }
                filterActive={sweetsTiers.size>0}
                sortAsc={sweetsSortAsc}
                onToggleSortAsc={()=>setSweetsSortAsc(a=>!a)}
              />
              {!sortedSweets.length&&<p style={{color:"#888780",fontSize:14}}>{cafes.some(e=>e.category==="Sweets")?t.noEntries:t.noSweets}</p>}
              {contextSweet ? (
                <div>
                  <button type="button" onClick={()=>setContextSweet(null)} style={{fontSize:12,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:"4px 0 10px",display:"flex",alignItems:"center",gap:4}}>← Back to full list</button>
                  {sweetGroupsAll.slice(Math.max(0,contextSweet.idx-3),contextSweet.idx+4).map(([name,grp],i)=>{
                    const absRank=Math.max(1,contextSweet.idx-2)+i;
                    const isCenter=name===contextSweet.name;
                    return(
                      <div key={name} style={isCenter?{outline:"1.5px solid #F0997B",borderRadius:10,marginBottom:6}:{marginBottom:6}}>
                        <CafeGroupRow rank={absRank} group={grp} cafeSortBy={sweetsSortBy} weights={sweetWeights} user={user} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]} viewerProfile={viewerProfile} onEdit={e=>{setEditC(e);setEditDineWith(dinedWithMap.get(e.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={id=>{const row=cafes.find(x=>x.id===id);if(!canMutateVisit(row,user))return;setPendingDelete({onConfirm:async()=>{try{await supabase.from("cafe_visits").delete().eq("id",id);}catch(err){console.error("cafe delete threw:",err);}setCafes(p=>p.filter(x=>x.id!==id));}});}}/>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {sweetGroupsPage.visible.map(([name,grp],i)=>(
                    <div key={name}>
                      <CafeGroupRow rank={i+1} group={grp} cafeSortBy={sweetsSortBy} weights={sweetWeights} user={user} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]} viewerProfile={viewerProfile} onEdit={e=>{setEditC(e);setEditDineWith(dinedWithMap.get(e.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={id=>{const row=cafes.find(x=>x.id===id);if(!canMutateVisit(row,user))return;setPendingDelete({onConfirm:async()=>{try{await supabase.from("cafe_visits").delete().eq("id",id);}catch(err){console.error("cafe delete threw:",err);}setCafes(p=>p.filter(x=>x.id!==id));}});}}/>
                      {sweetsSearch.trim()&&(
                        <button type="button" onClick={()=>{const idx=sweetGroupsAll.findIndex(([n])=>n===name);if(idx>=0){setSweetsSearch("");setContextSweet({name,idx});}}} style={{fontSize:11,color:"#F0997B",background:"none",border:"none",cursor:"pointer",padding:"2px 0 6px 58px",display:"block"}}>
                          Show ±3 rankings around #{sweetRankMap.get(name)}
                        </button>
                      )}
                    </div>
                  ))}
                  <ShowMoreButton
                    remaining={sweetGroupsPage.remaining}
                    pageSize={sweetGroupsPage.pageSize}
                    onClick={sweetGroupsPage.showMore}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {pathname.startsWith("/community")&&dbLoaded&&(
        <CommunityTab
          user={user}
          myEntries={st.entries}
          cafes={cafes}
          cafePlaces={cafePlaces}
          myRestaurantPlaceIds={myRestaurantPlaceIds}
          restaurantWeights={weights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
          unseenFollowers={unseenFollowers}
          onMarkFollowersSeen={handleMarkFollowersSeen}
          onFollowChange={handleFollowChange}
          externalUserLogTarget={extUserLogTarget}
          onExternalUserLogConsumed={() => setExtUserLogTarget(null)}
          externalCompareTarget={extCompareTarget}
          onExternalCompareConsumed={() => setExtCompareTarget(null)}
          externalFeedScrollTarget={feedScrollTarget}
          onExternalFeedScrollConsumed={() => setFeedScrollTarget(null)}
          coDinersRefreshKey={coDinersRefreshKey}
          onSignIn={() => setShowAuthModal(true)}
          myDisplayName={profile?.display_name || ""}
          guestTasteBud={!user ? GUEST_TASTE_BUD : null}
          guestTasteBudCompat={!user ? GUEST_TASTE_BUD_COMPAT : null}
        />
      )}

      {pathname.startsWith("/log")&&editR&&<RestForm initial={editR} initialDineWith={editDineWith} weights={weights} existingEntries={!user ? guestEntries : st.entries} existingCities={!user ? [...new Set(guestEntries.map(e=>e.city).filter(Boolean))] : existingCities} places={!user ? [] : restaurantPlaces}
        user={user} tasteBudIds={tasteBudIds}
        onPlaceCreated={(p)=>{ if (user) upsertPlace(setRestaurantPlaces, p.id, p); }}
        onSave={async e=>{
        if (!user) {
          setGuestEntries(p => p.map(x => x.id === editR.id ? { ...x, ...e } : x));
          setEditR(null); setEditDineWith([]);
          window.scrollTo({ top:0, behavior:"smooth" });
          return;
        }
        let resolvedPlaceId = e.placeId;
        if(canMutateVisit(e,user)) {
          try {
            resolvedPlaceId = await ensureRestaurantPlace(supabase, {
              placeId: e.placeId || null,
              name: e.name,
              cuisine: e.cuisine,
              cuisine2: e.cuisine2 || "",
              isFusion: e.isFusion || false,
              city: e.city || "",
            });
            upsertPlace(setRestaurantPlaces, resolvedPlaceId, {
              name: e.name,
              city: e.city || "",
              cuisine: e.cuisine || "",
              cuisine2: e.cuisine2 || "",
              isFusion: !!e.isFusion,
            });
            const { error } = await supabase
              .from("restaurant_visits")
              .update(restaurantVisitUpdatePayload(resolvedPlaceId, e))
              .eq("id", e.id);
            if (error) console.error("restaurant update error:", error);
          } catch (err) {
            console.error("restaurant update threw:", err);
          }
        }
        dispatch({ type: "UPD", e: { ...e, placeId: resolvedPlaceId, ownerId: e.ownerId ?? user?.id ?? null } });
        const prevRestIds = new Set((editDineWith || []).map((p) => p.id));
        const newRestIds = new Set((e.dineWith || []).map((p) => p.id));
        const removedRestIds = [...prevRestIds].filter((id) => !newRestIds.has(id));
        const newlyTaggedRest = (e.dineWith || []).filter((p) => !prevRestIds.has(p.id)).map((p) => p.id);
        // Sync group_visit_members to match the new dine-with picker. The
        // helper handles: visit-date propagation (any editor), creator-only
        // member adds/removes, un-expire-on-creator-add, full variant
        // detection (standard/auto_linked/pick_visit), bell-notif cleanup
        // for removed members, and auto-create when no group exists yet.
        // See groupVisitsApi.js → syncGroupVisitMembersOnEdit for the spec.
        if (e.id && (removedRestIds.length || newlyTaggedRest.length || e.visitedAt)) {
          await syncGroupVisitMembersOnEdit(supabase, {
            kind: "restaurant",
            entryId: e.id,
            editorId: user.id,
            placeId: resolvedPlaceId,
            visitedAt: e.visitedAt,
            addedUserIds: newlyTaggedRest,
            removedUserIds: removedRestIds,
          });
          fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
          setCoDinersRefreshKey((k) => k + 1);
        }
        setEditR(null); setEditDineWith([]);
      }} onCancel={()=>{setEditR(null);setEditDineWith([]);window.scrollTo({top:0,behavior:"smooth"});}} tasteStep={tasteHalfStep?0.5:0.1} onTasteStepChange={saveTasteStep}/>}
      {pathname.startsWith("/log")&&editC&&<CafeForm initial={editC} initialDineWith={editDineWith} weights={editC?.category==="Sweets"?sweetWeights:drinkWeights}
        user={user} tasteBudIds={tasteBudIds}
        onPlaceCreated={(p)=>{ if (user) upsertPlace(setCafePlaces, p.id, p); }}
        existingCafes={!user ? guestCafes : cafes} existingCities={!user ? [...new Set(guestCafes.map(e=>e.city).filter(Boolean))] : existingCities} places={!user ? [] : cafePlaces}
        onSave={async e=>{
        if (!user) {
          setGuestCafes(p => p.map(x => x.id === editC.id ? { ...x, ...e } : x));
          setEditC(null); setEditDineWith([]);
          window.scrollTo({ top:0, behavior:"smooth" });
          return;
        }
        if (e.city) persistLastCity(e.city);
        let resolvedPlaceId = e.placeId;
        if(canMutateVisit(e,user)) {
          try {
            resolvedPlaceId = await ensureCafePlace(supabase, {
              placeId: e.placeId || null,
              name: e.name,
              city: e.city || "",
            });
            upsertPlace(setCafePlaces, resolvedPlaceId, {
              name: e.name,
              city: e.city || "",
            });
            const { error } = await supabase
              .from("cafe_visits")
              .update(cafeVisitUpdatePayload(resolvedPlaceId, e))
              .eq("id", e.id);
            if (error) console.error("cafe update error:", error, "id:", e.id);
          } catch (err) {
            console.error("cafe update threw:", err);
          }
        }
        setCafes(p=>p.map(x=>x.id===e.id?{...e,id:x.id,placeId:resolvedPlaceId??x.placeId,ownerId:e.ownerId??user?.id??x.ownerId}:x));
        const prevCafeIds = new Set((editDineWith || []).map((p) => p.id));
        const newCafeIds = new Set((e.dineWith || []).map((p) => p.id));
        const removedCafeIds = [...prevCafeIds].filter((id) => !newCafeIds.has(id));
        const newlyTaggedCafe = (e.dineWith || []).filter((p) => !prevCafeIds.has(p.id)).map((p) => p.id);
        if (e.id && (removedCafeIds.length || newlyTaggedCafe.length || e.visitedAt)) {
          await syncGroupVisitMembersOnEdit(supabase, {
            kind: "cafe",
            entryId: e.id,
            editorId: user.id,
            placeId: resolvedPlaceId,
            visitedAt: e.visitedAt,
            addedUserIds: newlyTaggedCafe,
            removedUserIds: removedCafeIds,
          });
          fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
          setCoDinersRefreshKey((k) => k + 1);
        }
        setEditC(null); setEditDineWith([]);
      }}
      onSaveAndContinue={async e=>{
        if (e.city) persistLastCity(e.city);
        let resolvedPlaceId = e.placeId;
        if(canMutateVisit(e,user)) {
          try {
            resolvedPlaceId = await ensureCafePlace(supabase, { placeId: e.placeId||null, name: e.name, city: e.city||"" });
            upsertPlace(setCafePlaces, resolvedPlaceId, { name: e.name, city: e.city||"" });
            const { error } = await supabase.from("cafe_visits").update(cafeVisitUpdatePayload(resolvedPlaceId, e)).eq("id", e.id);
            if (error) console.error("cafe update error:", error, "id:", e.id);
          } catch (err) { console.error("cafe update threw:", err); }
        }
        setCafes(p=>p.map(x=>x.id===e.id?{...e,id:x.id,placeId:resolvedPlaceId??x.placeId,ownerId:e.ownerId??user?.id??x.ownerId}:x));
        const prevIds = new Set((editDineWith||[]).map(p=>p.id));
        const newIds = new Set((e.dineWith||[]).map(p=>p.id));
        const removedIds = [...prevIds].filter((id) => !newIds.has(id));
        const newlyTagged = (e.dineWith||[]).filter(p=>!prevIds.has(p.id)).map((p) => p.id);
        if (e.id && (removedIds.length || newlyTagged.length || e.visitedAt)) {
          await syncGroupVisitMembersOnEdit(supabase, {
            kind: "cafe",
            entryId: e.id,
            editorId: user.id,
            placeId: resolvedPlaceId,
            visitedAt: e.visitedAt,
            addedUserIds: newlyTagged,
            removedUserIds: removedIds,
          });
          fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
          setCoDinersRefreshKey((k) => k + 1);
        }
        setEditC(null); setEditDineWith([]);
        setAddPrefill({ name: e.name, city: e.city||"", placeId: resolvedPlaceId||null, category: e.category });
        setAddType("cafe");
        navigate("/add");
      }}
      onCancel={()=>{setEditC(null);setEditDineWith([]);window.scrollTo({top:0,behavior:"smooth"});}} tasteStep={tasteHalfStep?0.5:0.1} onTasteStepChange={saveTasteStep}/>}

      {/* ── Add Rating ── */}
      {pathname==="/add"&&!user&&(
        <GuestPreview message="Sign in to add your rating" onSignIn={() => setShowAuthModal(true)}>
          <RestForm
            initial={{...INIT_REST, city:"New York City"}}
            weights={weights}
            existingEntries={[]}
            existingCities={[]}
            places={[]}
            onPlaceCreated={()=>{}}
            onSave={()=>{}}
            onCancel={()=>{}}
            tasteStep={0.1}
          />
        </GuestPreview>
      )}
      {pathname==="/add"&&user&&(
        <div>
          {dineTagsReady&&<DineTagsBanner
            tags={dineTags}
            entries={st.entries}
            cafes={cafes}
            userId={user.id}
            onDismiss={(tagId)=>{
              tombstoneTag(user.id, tagId);
              setDineTags(prev=>prev.filter(t=>t.id!==tagId));
              setDineTagCount(prev=>Math.max(0,prev-1));
              try {
                const raw = sessionStorage.getItem(`bite_dineTagsCache_v2_${user.id}`);
                if (raw) {
                  const cached = JSON.parse(raw);
                  cached.tags = (cached.tags||[]).filter(t=>t.id!==tagId);
                  cached.count = Math.max(0,(cached.count||1)-1);
                  sessionStorage.setItem(`bite_dineTagsCache_v2_${user.id}`, JSON.stringify(cached));
                }
              } catch {}
              // Defensive re-pull from DB so the banner reflects truth even
              // when the local-state filter misses (e.g. tag.id mismatch
              // from stale state, or duplicate group_visits at the same
              // place created by the 20260526 backfill). Skipped/logged
              // member rows are excluded by fetch_pending_tags_for_user, so
              // a fresh fetch always shows the correct remaining queue.
              // Re-poll the bell count so the badge decrements without
              // waiting for the next focus/mount cycle.
              refreshNotifCount();
            }}
            onAddType={(type, tag) => {
              // v2 banner rows always carry group_visit_id — route through
              // applyGroupVisitPrefill so the dined-with picker is seeded
              // from the full group_visit_members list (creator + every
              // other tagged friend) and addGroupVisitId is set so the save
              // handler joins the existing group instead of creating a
              // duplicate. Falling through to applyDineTagPrefill is kept
              // for any pre-Phase-2 banner state still held in cache; that
              // path can't seed co-diners (entry_id is null for unlogged
              // tagged users) but won't crash.
              if (tag?.group_visit_id) {
                applyGroupVisitPrefill(tag.group_visit_id, {
                  kind: tag.entry_type || "restaurant",
                  restaurant_name: tag.restaurant_name || "",
                  visited_at: tag.visited_at || null,
                });
                return;
              }
              if (tag) {
                applyDineTagPrefill({
                  restaurantName: tag.restaurant_name,
                  city: tag.city,
                  cuisine: tag.cuisine,
                  taggerId: tag.tagger_id,
                  entryId: tag.entry_id,
                  taggerProfile: tag.taggerProfile,
                  entryType: tag.entry_type || type,
                  visitedAt: tag.visited_at,
                });
              } else {
                setAddType(type);
              }
            }}
          />}
          {addSaveErr&&<div style={{background:"#3C1F13",border:"1px solid #F0997B",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#F0997B"}}>{addSaveErr}</div>}
          {addType==="restaurant"
            ?<RestForm key={addFormKey} initial={{...INIT_REST,city:lastCity.current||profile?.home_city||"",...(addPrefill||(addDraftData?.addType==="restaurant"?addDraftData.f:null)||{})}} initialDineWith={addInitialDineWith.length?addInitialDineWith:(addDraftData?.addType==="restaurant"&&!addPrefill?addDraftData.dineWith||[]:[])} weights={weights} existingEntries={st.entries} existingCities={existingCities} places={restaurantPlaces}
                onPlaceCreated={(p)=>upsertPlace(setRestaurantPlaces, p.id, p)}
                onFormChange={(s)=>{formStateRef.current=s;}}
                user={user}
                tasteBudIds={tasteBudIds}
                onSave={async e=>{
                  setAddPrefill(null);
                  setAddInitialDineWith([]);
                  const sourceTaggerId = addTagTaggerId;
                  setAddTagTaggerId(null);
                  if (e.city) persistLastCity(e.city);
                  if (!user) return;
                  setAddSaveErr(null);
                  try {
                    const placeId = await ensureRestaurantPlace(supabase, {
                      placeId: e.placeId || null,
                      name: e.name,
                      cuisine: e.cuisine,
                      cuisine2: e.cuisine2 || "",
                      isFusion: e.isFusion || false,
                      city: e.city || "",
                    });
                    upsertPlace(setRestaurantPlaces, placeId, {
                      name: e.name,
                      city: e.city || "",
                      cuisine: e.cuisine || "",
                      cuisine2: e.cuisine2 || "",
                      isFusion: !!e.isFusion,
                    });
                    const { data, error } = await supabase
                      .from("restaurant_visits")
                      .insert([restaurantVisitInsertPayload(placeId, user.id, e, weights)])
                      .select(RESTAURANT_VISIT_SELECT)
                      .single();
                    if (error) {
                      console.error("restaurant insert error:", error);
                      setAddSaveErr(error.message || "Save failed — check console");
                      return;
                    }
                    if (data) {
                      const isFirstEntry = st.entries.length === 0 && cafes.length === 0;
                      dispatch({ type: "ADD", e: mapRestaurantVisitRow(data) });
                      if (isFirstEntry && !tasteBudsDone) setShowTasteBudsPrompt(true);
                      if (user?.id) { try { localStorage.removeItem(`bite_addRating_draft_${user.id}`); } catch {} }
                      setAddDraftData(null);
                      // Auto-remove from Want to Go now that the viewer has actually been.
                      // Fire-and-forget; removeWantToGo no-ops if the row doesn't exist.
                      removeWantToGo(supabase, user.id, { placeId, kind: "rest" });
                      // ── Group visits ────────────────────────────────────────
                      // group_visit_members is now the sole "dined with" record
                      // post-Phase-3 of the dine_with_tags deprecation. Feed
                      // co-diner pills + /add banner + LogTab badge all read
                      // from group_visit_members via the v2 RPCs (see
                      // groupVisitsApi.js). createGroupVisit handles all the
                      // necessary inserts (parent + members + group_visit_tagged
                      // notifs); runGroupVisitsForSave dispatches between
                      // joining a candidate group, creating a new one, or
                      // joining an existing source group via the notif tap.
                      //
                      // Pass the UNFILTERED dineWith (excluding self only) so
                      // the candidate search and createGroupVisit include the
                      // sourceTaggerId — that's what makes the loop-closure
                      // (B logs after A tagged B → A's group_visit auto-resolves
                      // and fans out group_visit_all_logged) work via the
                      // Postgres trigger instead of an explicit reciprocal write.
                      const sourceGroupVisitId = addGroupVisitId;
                      setAddGroupVisitId(null);
                      const groupVisitTaggedIds = (e.dineWith || [])
                        .map(p => p.id)
                        .filter(id => id && id !== user.id);
                      await runGroupVisitsForSave({
                        kind: "restaurant",
                        sourceGroupVisitId,
                        creatorVisitId: data.id,
                        placeId,
                        restaurantName: e.name,
                        visitedAt: data.visited_at,
                        taggedIds: groupVisitTaggedIds,
                      });
                      await runPostSaveGroupVisitBackfill({
                        kind: "restaurant",
                        placeId,
                        visitedAt: data.visited_at,
                        visitId: data.id,
                      });
                      // Refresh the local dinedWithMap so the "dined with" pill
                      // on the new entry's RestRow + feed card reflects the
                      // group_visit_members rows just inserted.
                      fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
                      refreshDineTags();
                      formStateRef.current = null;
                      posthog.capture("restaurant visit logged", {
                        place_name: e.name,
                        cuisine: e.cuisine,
                        city: e.city,
                        taste_score: e.taste,
                        dine_with_count: (e.dineWith || []).length,
                      });
                      navigate("/log");
                    }
                  } catch (err) {
                    console.error("restaurant insert threw:", err);
                    posthog.captureException(err);
                    setAddSaveErr(err?.message || "Save failed — check console");
                  }
                }}
                onCancel={()=>{formStateRef.current=null;setAddPrefill(null);setAddInitialDineWith([]);setAddTagTaggerId(null);navigate("/log");}}
                tasteStep={tasteHalfStep?0.5:0.1} onTasteStepChange={saveTasteStep}
                addType={addType} setAddType={setAddType}
              />
            :<CafeForm key={addFormKey} initial={{...INIT_CAFE,city:lastCity.current||profile?.home_city||"",...(addPrefill||(addDraftData?.addType==="cafe"?addDraftData.f:null)||{})}} initialDineWith={addInitialDineWith.length?addInitialDineWith:(addDraftData?.addType==="cafe"&&!addPrefill?addDraftData.dineWith||[]:[])} weights={drinkWeights}
                onPlaceCreated={(p)=>upsertPlace(setCafePlaces, p.id, p)}
                onFormChange={(s)=>{formStateRef.current=s;}}
                user={user}
                tasteBudIds={tasteBudIds}
                onSave={async e=>{
                  setAddPrefill(null);
                  setAddInitialDineWith([]);
                  const sourceTaggerId = addTagTaggerId;
                  setAddTagTaggerId(null);
                  if (user?.id) { try { localStorage.removeItem(`bite_addRating_draft_${user.id}`); } catch {} }
                  setAddDraftData(null);
                  if (e.city) persistLastCity(e.city);
                  const isFirstCafeEntry = st.entries.length === 0 && cafes.length === 0;
                  const inserted = await insertCafeEntry(e);
                  if (inserted && isFirstCafeEntry && !tasteBudsDone) setShowTasteBudsPrompt(true);
                  // ── Group visits (cafes) ────────────────────────────────────
                  // group_visit_members is now the sole "dined with" record
                  // post-Phase-3 of the dine_with_tags deprecation. See the
                  // restaurant onSave block above for the rationale; same
                  // dispatch shape, just kind='cafe'.
                  const sourceGroupVisitId = addGroupVisitId;
                  setAddGroupVisitId(null);
                  if (inserted?.id) {
                    const groupVisitTaggedIds = (e.dineWith || [])
                      .map(p => p.id)
                      .filter(id => id && id !== user.id);
                    await runGroupVisitsForSave({
                      kind: "cafe",
                      sourceGroupVisitId,
                      creatorVisitId: inserted.id,
                      placeId: inserted.placeId,
                      restaurantName: e.name,
                      visitedAt: inserted.visitedAt,
                      taggedIds: groupVisitTaggedIds,
                    });
                    await runPostSaveGroupVisitBackfill({
                      kind: "cafe",
                      placeId: inserted.placeId,
                      visitedAt: inserted.visitedAt,
                      visitId: inserted.id,
                    });
                    // Refresh the local dinedWithMap so the "dined with" pill
                    // on the new entry's CafeRow + feed card reflects the
                    // group_visit_members rows just inserted.
                    fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
                  }
                  refreshDineTags();
                  formStateRef.current = null;
                  if (inserted?.id) {
                    posthog.capture("cafe visit logged", {
                      place_name: e.name,
                      category: e.category,
                      city: e.city,
                      taste_score: e.taste,
                      dine_with_count: (e.dineWith || []).length,
                    });
                  }
                  navigate(e.category==="Sweets"?"/log/sweets":"/log/drinks");
                }}
                onSaveAndContinue={async e=>{
                  setAddPrefill(null);
                  setAddInitialDineWith([]);
                  if (e.city) persistLastCity(e.city);
                  const inserted = await insertCafeEntry(e);
                  // Tag persistence: post-Phase-3 of the dine_with_tags
                  // deprecation, group_visit_members is the sole "dined with"
                  // record. Save+Continue used to write to dine_with_tags
                  // only; we now run the same group_visits dispatch as the
                  // parent onSave so each tagged friend gets their member row
                  // + group_visit_tagged notif.
                  if (inserted?.id) {
                    const groupVisitTaggedIds = (e.dineWith || [])
                      .map(p => p.id)
                      .filter(id => id && id !== user.id);
                    if (groupVisitTaggedIds.length) {
                      await runGroupVisitsForSave({
                        kind: "cafe",
                        sourceGroupVisitId: null,
                        creatorVisitId: inserted.id,
                        placeId: inserted.placeId,
                        restaurantName: e.name,
                        visitedAt: inserted.visitedAt,
                        taggedIds: groupVisitTaggedIds,
                      });
                      await runPostSaveGroupVisitBackfill({
                        kind: "cafe",
                        placeId: inserted.placeId,
                        visitedAt: inserted.visitedAt,
                        visitId: inserted.id,
                      });
                      fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
                    }
                  }
                  formStateRef.current = null;
                  if (user?.id) { try { localStorage.removeItem(`bite_addRating_draft_${user.id}`); } catch {} }
                  setAddDraftData(null);
                  setAddFormKey(k => k + 1);
                  window.scrollTo({top:0,behavior:"smooth"});
                }}
                onCancel={()=>{formStateRef.current=null;setAddPrefill(null);setAddInitialDineWith([]);setAddTagTaggerId(null);navigate("/log");}}
                addType={addType} setAddType={setAddType}
                existingCafes={cafes}
                existingCities={existingCities}
                places={cafePlaces}
                tasteStep={tasteHalfStep?0.5:0.1} onTasteStepChange={saveTasteStep}
              />
          }
        </div>
      )}

      {pathname.startsWith("/taste")&&showSuggest&&!user&&(
        <GuestPreview message="Sign in to discover new cuisines based on your taste" onSignIn={() => setShowAuthModal(true)}>
          <SuggestView entries={GUEST_PALETTE_ENTRIES} weights={weights} onBack={()=>{}}/>
        </GuestPreview>
      )}
      {pathname.startsWith("/taste")&&showSuggest&&user&&<SuggestView entries={st.entries} weights={weights} onBack={()=>setShowSuggest(false)}/>}
      {pathname.startsWith("/taste")&&!showSuggest&&!user&&(
        <PaletteView
          entries={guestEntries}
          cafes={guestCafes}
          weights={weights}
          replaceRestaurantWeights={replaceRestaurantWeights}
          drinkWeights={drinkWeights}
          replaceDrinkWeights={replaceDrinkWeights}
          sweetWeights={sweetWeights}
          replaceSweetWeights={replaceSweetWeights}
          questL={new Set()}
          toggleQ={() => {}}
          onOpenSuggest={() => {}}
        />
      )}
      {pathname.startsWith("/taste")&&!showSuggest&&user&&(
        <PaletteView
          entries={st.entries}
          cafes={cafes}
          weights={weights}
          replaceRestaurantWeights={replaceRestaurantWeights}
          drinkWeights={drinkWeights}
          replaceDrinkWeights={replaceDrinkWeights}
          sweetWeights={sweetWeights}
          replaceSweetWeights={replaceSweetWeights}
          questL={questL}
          toggleQ={toggleQ}
          onOpenSuggest={()=>setShowSuggest(true)}
          homeCurrency={homeCurrency}
        />
      )}

      {/* ── FAQ ── */}
      {pathname==="/faq"&&<FaqView/>}

      </>
      )}

      <AuthModal open={showAuthModal} onClose={()=>setShowAuthModal(false)} />
      <ResetPasswordModal />
      {pendingDelete && (
        <ConfirmSheet
          onConfirm={async()=>{setPendingDelete(null);await pendingDelete.onConfirm();}}
          onCancel={()=>setPendingDelete(null)}
        />
      )}
    </div>
    {!user && showGuestOnboarding && authReady && (
      <OnboardingModal
        restaurantWeights={weights}
        onWeightSave={replaceRestaurantWeights}
        onComplete={(action) => dismissGuestOnboarding(action === "signin")}
        isGuest
      />
    )}
    {user && onboardingDone === false && (
      <OnboardingModal
        restaurantWeights={weights}
        onWeightSave={replaceRestaurantWeights}
        onComplete={completeOnboarding}
        onHomeCitySave={handleHomeCitySave}
      />
    )}
    {badgeModal && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 501, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <div style={{ background: "#1E1E1C", borderRadius: 16, padding: "28px 24px 24px", maxWidth: 360, width: "100%", border: "0.5px solid rgba(255,255,255,0.12)", boxSizing: "border-box", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <BadgeSVG emoji={badgeModal.emoji} earned color={badgeModal.color} border={badgeModal.color} bg={badgeModal.bgColor} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: badgeModal.color, marginBottom: 6 }}>Badge Earned</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1EFE8", margin: "0 0 8px", lineHeight: 1.3 }}>{badgeModal.name}</h2>
          <p style={{ fontSize: 13, color: "#C4C2BA", margin: "0 0 24px", lineHeight: 1.6 }}>{badgeModal.earnedDesc}</p>
          <button
            type="button"
            onClick={() => setBadgeModal(null)}
            style={{ width: "100%", padding: 12, background: badgeModal.color, color: "#141413", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Awesome! 🎉
          </button>
        </div>
      </div>
    )}
    {showBadgesCard && (() => {
      const ONBOARDING_BADGE_IDS = ["first-bite", "first-follow"];
      const cardBadges = evalBadges(st.entries, cafes, weights, questL, tasteBudIds.size, mutualFollowCount)
        .filter(b => ONBOARDING_BADGE_IDS.includes(b.id) && b.earned);
      const dismissCard = (andOpen) => {
        setShowBadgesCard(false);
        try { if (user?.id) localStorage.setItem(`bite_badges_card_${user.id}`, "1"); } catch {}
        if (andOpen) setShowSelfSheet(true);
      };
      if (cardBadges.length === 0) { dismissCard(false); return null; }
      return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ background: "#1E1E1C", borderRadius: 16, padding: "28px 24px 24px", maxWidth: 380, width: "100%", border: "0.5px solid rgba(255,255,255,0.12)", boxSizing: "border-box", maxHeight: "85vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1EFE8", margin: "0 0 18px", textAlign: "center", lineHeight: 1.3 }}>
              Congrats on earning your<br />first badges!
            </h2>
            {cardBadges.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 20 }}>
                {cardBadges.map(b => (
                  <div key={b.id} style={{ textAlign: "center", width: 64 }}>
                    <BadgeSVG emoji={b.emoji} earned color={b.color} border={b.color} bg={b.bgColor} />
                    <div style={{ fontSize: 9, color: "#C4C2BA", marginTop: 4, lineHeight: 1.3, wordBreak: "break-word" }}>{b.name}</div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 13, color: "#C4C2BA", margin: "0 0 6px", textAlign: "center", lineHeight: 1.6 }}>
              Tap your profile to see other badges<br />you can earn to get points!
            </p>
            <p style={{ fontSize: 11, color: "#888780", margin: "0 0 20px", textAlign: "center", fontStyle: "italic" }}>
              Points will be redeemable (coming soon)
            </p>
            <button
              type="button"
              onClick={() => dismissCard(true)}
              style={{ width: "100%", padding: 12, background: "#F0997B", color: "#141413", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}
            >
              See my badges →
            </button>
            <button
              type="button"
              onClick={() => dismissCard(false)}
              style={{ display: "block", width: "100%", textAlign: "center", fontSize: 12, color: "#888780", background: "none", border: "none", cursor: "pointer", padding: "6px 0" }}
            >
              Maybe later
            </button>
          </div>
        </div>
      );
    })()}
    {showTasteBudsPrompt && (
      <TasteBudsPromptSheet
        onFindFriends={() => dismissTasteBudsPrompt("/community/people/discover")}
        onDismiss={() => dismissTasteBudsPrompt()}
      />
    )}
    {notifSheetProfile && (
      <MiniProfileSheet
        profile={notifSheetProfile}
        relation={notifSheetRelation}
        busy={notifSheetBusy}
        onClose={() => setNotifSheetProfile(null)}
        onFollow={handleNotifSheetFollow}
        onUnfollow={handleNotifSheetUnfollow}
        onViewLog={(profile) => {
          setNotifSheetProfile(null);
          setShowNotifPanel(false);
          setExtUserLogTarget(profile);
          navigate("/community/people");
        }}
        onCompareWith={(profile) => {
          if (!profile?.username) return;
          setNotifSheetProfile(null);
          setShowNotifPanel(false);
          setExtCompareTarget(profile);
          navigate(`/community/compare/${profile.username}`);
        }}
        t={t}
      />
    )}
    {showSelfSheet && profile && (
      <MiniProfileSheet
        profile={{
          ...profile,
          pref_weight_taste: weights?.taste,
          pref_weight_bpb:   weights?.bpb,
          pref_weight_wait:  weights?.wait,
        }}
        relation="self"
        cachedVisits={st.entries}
        questL={questL}
        toggleQ={toggleQ}
        selfCafes={cafes}
        onClose={() => setShowSelfSheet(false)}
        onWeightTap={() => { setShowSelfSheet(false); navigate("/taste"); }}
        onEditProfile={() => { setShowSelfSheet(false); setShowAuthModal(true); }}
        onSignOut={async () => { setShowSelfSheet(false); await supabase.auth.signOut(); }}
        followingCount={tasteBudIds.size}
        tasteBudCount={mutualFollowCount}
        t={t}
      />
    )}
    {heartSheetTarget && (
      <FeedPostSheet
        postId={heartSheetTarget.postId}
        postType={heartSheetTarget.postType}
        viewerId={user?.id}
        restaurantWeights={weights}
        drinkWeights={drinkWeights}
        sweetWeights={sweetWeights}
        onClose={() => setHeartSheetTarget(null)}
      />
    )}
    {sameDinnerPending && (
      <SameDinnerSheet
        creatorUsername={sameDinnerPending.candidate.creatorProfile?.username}
        restaurantName={sameDinnerPending.restaurantName}
        visitedAt={sameDinnerPending.candidate.visitedAt}
        onYes={async () => {
          const pending = sameDinnerPending;
          setSameDinnerPending(null);
          await joinExistingGroupVisit(supabase, {
            groupVisitId: pending.candidate.id,
            userId: user.id,
            visitId: pending.creatorVisitId,
          });
        }}
        onNo={async () => {
          const pending = sameDinnerPending;
          setSameDinnerPending(null);
          await createGroupVisitForSave({
            kind: pending.kind,
            creatorVisitId: pending.creatorVisitId,
            placeId: pending.placeId,
            restaurantName: pending.restaurantName,
            visitedAt: pending.visitedAt,
            taggedIds: pending.taggedIds,
          });
        }}
      />
    )}
    {pickVisitState && (
      <PickVisitSheet
        creatorUsername={pickVisitState.creatorUsername}
        restaurantName={pickVisitState.restaurantName}
        visits={pickVisitState.visits}
        onCancel={() => setPickVisitState(null)}
        onPick={async (visitId) => {
          const state = pickVisitState;
          setPickVisitState(null);
          await joinExistingGroupVisit(supabase, {
            groupVisitId: state.groupVisitId,
            userId: user.id,
            visitId,
          });
          const pickedKind = state.kind || "restaurant";
          setFeedScrollTarget({
            postId: visitId,
            postType: pickedKind,
            kind: entryTypeToKind(pickedKind),
          });
          navigate("/community/feed");
        }}
      />
    )}
    {retroPromptState && (
      <RetroAttachSheet
        creatorUsername={retroPromptState.creatorUsername}
        creatorDisplayName={retroPromptState.creatorDisplayName}
        restaurantName={retroPromptState.restaurantName}
        visitedAt={retroPromptState.visitedAt}
        onNo={() => setRetroPromptState(null)}
        onYes={async () => {
          const state = retroPromptState;
          setRetroPromptState(null);
          // Attach the new visit_id onto the expired group's member row.
          // We intentionally don't un-expire the parent or fan out
          // `group_visit_all_logged` — everyone else was marked 'skipped'
          // by the day-7 sweep days ago, so resuscitating the group would
          // misrepresent reality. The attach is enough for co-diner
          // rendering on the newly-logged entry.
          await joinExistingGroupVisit(supabase, {
            groupVisitId: state.groupVisitId,
            userId: user.id,
            visitId: state.visitId,
          });
          fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
        }}
      />
    )}
    </LangContext.Provider>
  );
}
