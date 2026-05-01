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
import { reducer } from "./state/logReducer.js";
import {
  calcBiteOutOf10,
  calcCafeOutOf10,
  scoreColor,
  scoreLabel,
  tasteColor,
  tasteLabel,
} from "./utils/scoring.js";
import { rating010FilterRows } from "./constants/ratingTiers0to10.js";
import { BEAN_REGIONS, regionOf } from "./constants/coffeeConstants.js";
import { S } from "./styles/sharedStyles.js";
import { MouthLogo } from "./components/MouthLogo.jsx";
import { InfoBubble } from "./components/InfoBubble.jsx";
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
import { countUnseenFollowers, markFollowersSeen, followUser, unfollowUser, getRelation, fetchFollowingIds } from "./utils/followsApi.js";
import { MiniProfileSheet } from "./components/community/MiniProfileSheet.jsx";
import { countUnreadNotifications, fetchUnreadNotifications, markNotificationsRead } from "./utils/notificationsApi.js";
import { usePaginatedList } from "./components/usePaginatedList.js";
import { ShowMoreButton } from "./components/ShowMoreButton.jsx";
import { NotificationPanel } from "./components/NotificationPanel.jsx";
import { FeedPostSheet } from "./components/community/FeedPostSheet.jsx";
import { insertDineTag, fetchUnloggedDineTags, countUnloggedDineTags, dismissDineTag, fetchCoDiners, fetchDinedWithByEntry } from "./utils/dineWithApi.js";
import { DineTagsBanner } from "./components/DineTagsBanner.jsx";
import { getCurrencyForCity, toUSD, fromUSD, CURRENCY_SYMBOLS } from "./utils/currency.js";
import { CityInput, resolveCity } from "./components/CityInput.jsx";
import { CategoryTabs } from "./components/CategoryTabs.jsx";
import { ConfirmSheet } from "./components/ConfirmSheet.jsx";
const GUEST_PALETTE_ENTRIES = [
  {id:"gp1",name:"Lilia",             cuisine:"Italian",        letter:"I",city:"NYC",taste:9.2,cost:120,portions:2,wait:20,repeatability:3,useR:true,notes:""},
  {id:"gp2",name:"Don Angie",         cuisine:"Italian",        letter:"I",city:"NYC",taste:8.8,cost:95, portions:2,wait:15,repeatability:3,useR:true,notes:""},
  {id:"gp3",name:"Lucali",            cuisine:"Italian",        letter:"I",city:"NYC",taste:9.5,cost:55, portions:2,wait:45,repeatability:3,useR:true,notes:""},
  {id:"gp4",name:"Ugly Bagel",        cuisine:"American",       letter:"A",city:"NYC",taste:8.5,cost:22, portions:1,wait:10,repeatability:2,useR:true,notes:""},
  {id:"gp5",name:"Superiority Burger",cuisine:"American",       letter:"A",city:"NYC",taste:8.1,cost:18, portions:1,wait:12,repeatability:2,useR:true,notes:""},
  {id:"gp6",name:"Raku",              cuisine:"Japanese",       letter:"J",city:"NYC",taste:8.7,cost:75, portions:1,wait:25,repeatability:3,useR:true,notes:""},
  {id:"gp7",name:"Xi'an Famous",      cuisine:"Chinese",        letter:"C",city:"NYC",taste:8.2,cost:28, portions:1,wait:8, repeatability:2,useR:true,notes:""},
  {id:"gp8",name:"Sammy's Halal",     cuisine:"Middle Eastern", letter:"M",city:"NYC",taste:7.8,cost:14, portions:1,wait:5, repeatability:2,useR:true,notes:""},
];

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

/** Drops optional paragraphs from welcome body (DB or defaults): play-mode aside; sign-in/cloud disclaimer (EN+ZH) so languages stay aligned when overrides differ. */
function omitPlayWelcomeAside(body) {
  if (!body) return body;
  const drop = (p) =>
    p.includes("Play around! Nothing saves permanently") ||
    p.includes("Sign in to sync your ratings to the cloud") ||
    p.includes("登入後，你的評分會同步到雲端");
  return body.split("\n\n").filter((p) => !drop(p)).join("\n\n");
}

export default function App() {
  const { user, authReady, username, profile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [st, dispatch] = useReducer(reducer, { entries: [] });

  // ── URL-derived view state ────────────────────────────────────────────────
  const logTab = pathname === "/log/drinks" ? "drinks" : pathname === "/log/sweets" ? "sweets" : "restaurants";
  const [showSuggest, setShowSuggest] = useState(false);
  const [cafes, setCafes] = useState([]);
  /** Shared cross-user catalog for PlacePicker. Loaded once on auth boot. */
  const [restaurantPlaces, setRestaurantPlaces] = useState([]);
  const [cafePlaces, setCafePlaces] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeOverride, setWelcomeOverride] = useState({});
  const [welcomeCity, setWelcomeCity] = useState("");
  /** Unseen-followers count drives the red badge on the Community tab in the
   *  bottom nav. Refreshed on auth + after every follow/unfollow action; the
   *  Friends sub-tab additionally calls markFollowersSeen on mount to clear it. */
  const [unseenFollowers, setUnseenFollowers] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifAnchorPos, setNotifAnchorPos] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifFollowingIds, setNotifFollowingIds] = useState(() => new Set());
  // Re-type dine_tag → dine_tag_mutual when the current user already has a logged entry
  // for that restaurant. This handles the case where A tags B but B already logged the
  // place (no reverse dine_with_tags row exists yet, so insertDineTag can't detect it).
  const annotatedNotifications = useMemo(() => {
    if (!notifications.length) return notifications;
    return notifications.map((n) => {
      if (n.type !== "dine_tag") return n;
      const name = (n.meta?.restaurant_name || "").trim().toLowerCase();
      if (!name) return n;
      const found =
        (st.entries || []).some((e) => (e.name || "").trim().toLowerCase() === name) ||
        (cafes || []).some((e) => (e.name || "").trim().toLowerCase() === name);
      return found ? { ...n, type: "dine_tag_mutual" } : n;
    });
  }, [notifications, st.entries, cafes]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifContainerRef = useRef(null);
  const [notifSheetProfile, setNotifSheetProfile] = useState(null);
  const [notifSheetRelation, setNotifSheetRelation] = useState("none");
  const [notifSheetBusy, setNotifSheetBusy] = useState(false);
  /** Tap-target for heart-reaction notifications. When set, FeedPostSheet
   *  mounts and renders the hearted post as a single read-only card. */
  const [heartSheetTarget, setHeartSheetTarget] = useState(null);
  const [dineTags, setDineTags] = useState([]);
  const [dineTagCount, setDineTagCount] = useState(0);
  const [dineTagsReady, setDineTagsReady] = useState(false);
  const [dinedWithMap, setDinedWithMap] = useState(new Map());
  const [addPrefill, setAddPrefill] = useState(null);
  const [addInitialDineWith, setAddInitialDineWith] = useState([]);
  const [addFormKey, setAddFormKey] = useState(0);
  const [addTagTaggerId, setAddTagTaggerId] = useState(null);
  const formStateRef = useRef(null);
  const [addDraftData, setAddDraftData] = useState(null);
  const [tasteBudIds, setTasteBudIds] = useState(() => new Set());
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [extUserLogTarget, setExtUserLogTarget] = useState(null);
  const [extCompareTarget, setExtCompareTarget] = useState(null);
  const lastLogPath = useRef("/log");
  const lastTastePath = useRef("/taste");
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
    if (!user?.id) { lastCity.current = ""; return; }
    try {
      lastCity.current = localStorage.getItem(`bite_lastUsedCity_${user.id}`) || "";
    } catch { lastCity.current = ""; }
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
    return res;
  }

  async function refetchNotifications() {
    if (!user?.id) return;
    try {
      // Wait for the Postgres trigger to fire before fetching.
      await new Promise((r) => setTimeout(r, 700));
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

  async function applyDineTagPrefill({ restaurantName, city, cuisine, taggerId, entryId, taggerProfile, entryType = "restaurant" }) {
    const resolvedCity = resolveCity(city || "");
    let prefill;
    let coDiners;
    if (entryType === "cafe") {
      coDiners = await fetchCoDiners(supabase, { taggerId, entryId, excludeUserId: user?.id });
      prefill = {
        name: restaurantName || "",
        ...(resolvedCity ? { city: resolvedCity } : {}),
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
        cuisine: resolvedCuisine,
        cuisine2: place?.cuisine2 || "",
        isFusion: !!place?.is_fusion,
        letter: (resolvedCuisine[0] || "").toUpperCase(),
      };
    }
    setAddPrefill(prefill);
    // Tagger + co-diners, deduplicated, current user excluded (fetchCoDiners already handles that).
    const all = [...(taggerProfile ? [taggerProfile] : []), ...coDiners];
    const seen = new Set();
    setAddInitialDineWith(all.filter(p => p?.id && !seen.has(p.id) && seen.add(p.id)));
    setAddTagTaggerId(taggerId || null);
    setAddDraftData(null);
    setAddFormKey(k => k + 1);
    setAddType(entryType === "cafe" ? "cafe" : "restaurant");
    navigate("/add");
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
    // Always look up the dine_with_tags row directly — old notifications may
    // be missing city/cuisine/entry_id in meta. Tagged user can see their own
    // rows (RLS: tagged_id = auth.uid()).
    let q = supabase
      .from("dine_with_tags")
      .select("city, cuisine, entry_id, entry_type")
      .eq("tagged_id", user.id)
      .eq("tagger_id", notif.from_user_id);
    const lookupQ = meta.entry_id
      ? q.eq("entry_id", meta.entry_id)
      : q.ilike("restaurant_name", meta.restaurant_name || "")
          .lte("created_at", notif.created_at)
          .order("created_at", { ascending: false });
    lookupQ.limit(1).maybeSingle().then(({ data: tag }) => {
      applyDineTagPrefill({
        restaurantName: meta.restaurant_name,
        city: tag?.city || meta.city,
        cuisine: tag?.cuisine || meta.cuisine,
        taggerId: notif.from_user_id,
        entryId: tag?.entry_id || meta.entry_id || null,
        taggerProfile: notif.fromProfile,
        entryType: tag?.entry_type || meta.entry_type || "restaurant",
      });
    });
  }

  async function handleDineTagMutualBack(notif) {
    if (!user?.id) return;
    const fromUserId = notif.from_user_id;
    const restaurantName = notif.meta?.restaurant_name || "";
    const [{ data: incomingTag }, { data: outgoingTag }] = await Promise.all([
      supabase.from("dine_with_tags").select("id").eq("tagger_id", fromUserId).eq("tagged_id", user.id).ilike("restaurant_name", restaurantName).eq("dismissed", false).maybeSingle(),
      supabase.from("dine_with_tags").select("id").eq("tagger_id", user.id).eq("tagged_id", fromUserId).ilike("restaurant_name", restaurantName).maybeSingle(),
    ]);
    await Promise.all([
      incomingTag && dismissDineTag(supabase, incomingTag.id),
      outgoingTag && dismissDineTag(supabase, outgoingTag.id),
      supabase.from("notifications").insert({
        user_id: fromUserId, from_user_id: user.id,
        type: "dine_tag_back",
        meta: { restaurant_name: restaurantName, city: notif.meta?.city || "" },
      }),
    ].filter(Boolean));
    setDineTags((prev) => prev.filter((t) => t.tagger_id !== fromUserId || (t.restaurant_name || "").toLowerCase() !== restaurantName.toLowerCase()));
    fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
  }

  async function handleNotifSheetFollow(targetId) {
    if (!user?.id) return;
    setNotifSheetBusy(true);
    try {
      await followUser(supabase, user.id, targetId);
      const rel = await getRelation(supabase, user.id, targetId);
      setNotifSheetRelation(rel);
      refreshSocialCounts();
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
      const raw = sessionStorage.getItem(`bite_dineTagsCache_${user.id}`);
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
    const [tags, count, followingIds] = await Promise.all([
      fetchUnloggedDineTags(supabase, user.id),
      countUnloggedDineTags(supabase, user.id),
      fetchFollowingIds(supabase, user.id),
    ]);
    setDineTags(tags);
    setDineTagCount(count);
    setDineTagsReady(true);
    try { sessionStorage.setItem(`bite_dineTagsCache_${user.id}`, JSON.stringify({ tags, count })); } catch {}
    setTasteBudIds(followingIds);
  }, [user?.id]);

  useEffect(() => { refreshDineTags(); }, [refreshDineTags]);

  /** Bundled `translations.js` by default. Supabase `welcome_*` only when hosting sets `VITE_WELCOME_USE_SUPABASE=true` (opt-in). */
  const welcomeUseDbCopy = import.meta.env.VITE_WELCOME_USE_SUPABASE === 'true';
  const welcomeTitleDisplay = (welcomeUseDbCopy && welcomeOverride[lang+"_title"]) || t.welcome1;
  const welcomeBodyDisplay = omitPlayWelcomeAside((welcomeUseDbCopy && welcomeOverride[lang+"_body"]) || t.welcome2);

  useEffect(() => {
    if (!authReady || !user?.id) return;
    try {
      const dismissed = localStorage.getItem(`bite_welcomeDismissed_${user.id}`);
      setShowWelcome(!dismissed);
    } catch (e) { /* ignore */ }
  }, [authReady, user?.id]);



  function dismissWelcome() {
    setShowWelcome(false);
    if (user?.id) {
      try { localStorage.setItem(`bite_welcomeDismissed_${user.id}`, "1"); }
      catch (e) { console.error("welcome dismissed save:", e); }
      const inferredCurrency = getCurrencyForCity(welcomeCity) || "USD";
      setHomeCurrency(inferredCurrency);
      const patch = { home_currency: inferredCurrency };
      if (welcomeCity.trim()) patch.home_city = welcomeCity.trim();
      supabase.from("profiles").update(patch).eq("id", user.id);
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
    lastCity.current = city;
    if (!user?.id) return;
    try { localStorage.setItem(`bite_lastUsedCity_${user.id}`, city); } catch {}
  }
  const [search, setSearch] = useState("");
  const [weights, setWeights] = useState({taste:50,bpb:40,wait:10});
  const restaurantWeightsSum = weights.taste + weights.bpb + weights.wait;
  const canProceedWelcome = restaurantWeightsSum === 100;
  const [drinkWeights, setDrinkWeights] = useState({taste:70,bpb:20,wait:10});
  const [sweetWeights, setSweetWeights] = useState({taste:70,bpb:20,wait:10});
  const [questL, setQuestL] = useState(new Set());
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
          const [entries, cafeRows, rPlaces, cPlaces, dwMap] = await Promise.all([
            fetchRestaurantVisitsJoined(supabase, user.id),
            fetchCafeVisitsJoined(supabase, user.id),
            fetchAllRestaurantPlaces(supabase),
            fetchAllCafePlaces(supabase),
            fetchDinedWithByEntry(supabase, user.id),
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
          if (import.meta.env.DEV) {
            console.log("[BITE] reducer LOAD applied", { entriesLength: entries.length });
          }
        }

        if (user) {
          try {
            const rw = localStorage.getItem(`bite_restaurantWeights_${user.id}`);
            if (rw) setWeights(JSON.parse(rw));
          } catch (e) { console.error("restaurant weights load:", e); }
          try {
            const dw = localStorage.getItem(`bite_drinkWeights_${user.id}`);
            if (dw) setDrinkWeights(JSON.parse(dw));
          } catch (e) { console.error("drink weights load:", e); }
          try {
            const sw = localStorage.getItem(`bite_sweetWeights_${user.id}`);
            if (sw) setSweetWeights(JSON.parse(sw));
          } catch (e) { console.error("sweet weights load:", e); }
        }

        const { data: sData, error: settingsErr } = await supabase.from("settings").select("*");
        if (settingsErr) console.warn("[BITE] settings:", settingsErr.message);
        if (cancelled) return;
        if (sData) {
          let questHandled = false;
          if (user) {
            try {
              const raw = localStorage.getItem(`bite_questLetters_${user.id}`);
              if (raw) {
                setQuestL(new Set(JSON.parse(raw)));
                questHandled = true;
              }
            } catch (e) {
              console.error("quest letters localStorage:", e);
            }
          }
          if (!questHandled) {
            const ql = sData.find((s) => s.key === "questLetters");
            if (ql) setQuestL(new Set(JSON.parse(ql.value)));
          }
          const wo = {};
          sData.filter((s) => s.key.startsWith("welcome_")).forEach((s) => {
            wo[s.key.replace("welcome_", "")] = s.value;
          });
          if (Object.keys(wo).length > 0) setWelcomeOverride(wo);
        }
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

  /** Each slider 0–100; BITE uses relative mix (see `restaurantWeightRatios` in scoring). */
  function updW(k, v) {
    const nv = Math.round(Math.min(100, Math.max(0, +v)));
    const next = { ...weights, [k]: nv };
    setWeights(next);
    if (user?.id) {
      try { localStorage.setItem(`bite_restaurantWeights_${user.id}`, JSON.stringify(next)); }
      catch (e) { console.error("restaurant weights save:", e); }
    }
  }

  function resetWeights(defaults) {
    const next = { ...defaults };
    setWeights(next);
    if (user?.id) {
      try { localStorage.setItem(`bite_restaurantWeights_${user.id}`, JSON.stringify(next)); }
      catch (e) { console.error("restaurant weights save:", e); }
    }
  }

  function replaceRestaurantWeights(next) {
    const clamped = {
      taste: Math.round(Math.min(100, Math.max(0, Number(next.taste) || 0))),
      bpb: Math.round(Math.min(100, Math.max(0, Number(next.bpb) || 0))),
      wait: Math.round(Math.min(100, Math.max(0, Number(next.wait) || 0))),
    };
    setWeights(clamped);
    if (user?.id) {
      try { localStorage.setItem(`bite_restaurantWeights_${user.id}`, JSON.stringify(clamped)); }
      catch (e) { console.error("restaurant weights save:", e); }
    }
  }

  /** Drinks / sweets weights: same edit-then-Save pattern as restaurants (see PaletteView). */
  function clampWeights(next) {
    return {
      taste: Math.round(Math.min(100, Math.max(0, Number(next.taste) || 0))),
      bpb:   Math.round(Math.min(100, Math.max(0, Number(next.bpb)   || 0))),
      wait:  Math.round(Math.min(100, Math.max(0, Number(next.wait)  || 0))),
    };
  }
  function replaceDrinkWeights(next) {
    const clamped = clampWeights(next);
    setDrinkWeights(clamped);
    if (user?.id) {
      try { localStorage.setItem(`bite_drinkWeights_${user.id}`, JSON.stringify(clamped)); }
      catch (e) { console.error("drink weights save:", e); }
    }
  }
  function replaceSweetWeights(next) {
    const clamped = clampWeights(next);
    setSweetWeights(clamped);
    if (user?.id) {
      try { localStorage.setItem(`bite_sweetWeights_${user.id}`, JSON.stringify(clamped)); }
      catch (e) { console.error("sweet weights save:", e); }
    }
  }

  function toggleQ(l) {
    const letterCovered = new Set(st.entries.map((e) => (e.letter || e.cuisine?.[0])?.toUpperCase()));
    if (!letterCovered.has(l) || !user) return;
    const next = new Set(questL);
    next.has(l) ? next.delete(l) : next.add(l);
    setQuestL(next);
    try {
      localStorage.setItem(`bite_questLetters_${user.id}`, JSON.stringify([...next]));
    } catch (err) {
      console.error("quest letters save:", err);
    }
  }

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
      const c = resolveCity(e.city || "") || "NYC";
      m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [st.entries]);
  const filtered = sortedR.filter(e=>{
    if(tiers.size>0&&!tiers.has(scoreLabel(calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights,e.currency_code||"USD"),t)))return false;
    if(cityFilter.size>0&&!cityFilter.has(resolveCity(e.city||"")||"NYC"))return false;
    if(search.trim()){const q=search.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.cuisine.toLowerCase().includes(q)||(e.city||'NYC').toLowerCase().includes(q)||(e.notes&&e.notes.toLowerCase().includes(q));}
    return true;
  });

  const DRINK_CATS = ["Coffee","Tea","Other"];
  const drinkCityCounts = useMemo(() => {
    const m = new Map();
    cafes.forEach((e) => {
      if (!DRINK_CATS.includes(e.category)) return;
      const c = resolveCity(e.city || "") || "NYC";
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
    if(cafeCityFilter.size>0&&!cafeCityFilter.has(resolveCity(e.city||"")||"NYC"))return false;
    if(cafeSearch.trim()){const q=cafeSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q)||(e.city||"NYC").toLowerCase().includes(q);}
    return true;
  });

  const sweetCityCounts = useMemo(() => {
    const m = new Map();
    cafes.forEach((e) => {
      if (e.category !== "Sweets") return;
      const c = resolveCity(e.city || "") || "NYC";
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
    if(sweetsCityFilter.size>0&&!sweetsCityFilter.has(resolveCity(e.city||"")||"NYC"))return false;
    if(sweetsSearch.trim()){const q=sweetsSearch.trim().toLowerCase();return e.name.toLowerCase().includes(q)||e.order.toLowerCase().includes(q)||(e.city||"NYC").toLowerCase().includes(q);}
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
      const { data, error } = await supabase
        .from("cafe_visits")
        .insert([cafeVisitInsertPayload(placeId, user.id, entry)])
        .select(CAFE_VISIT_SELECT);
      if (error) console.error("cafe insert error:", error);
      const mapped = (data || []).map((row) => mapCafeVisitRow(row));
      setCafes((p) => [...p, ...mapped]);
      return mapped[0] || null;
    } catch (err) {
      console.error("cafe insert threw:", err);
      return null;
    }
  }

  return (
    <LangContext.Provider value={{t,lang}}>
    <div style={{fontFamily:"var(--font-sans)",maxWidth:640,margin:"0 auto",padding:user?"1.25rem 1rem max(8rem, env(safe-area-inset-bottom)) 1rem":"1.25rem 1rem 2rem 1rem",background:"#141413",minHeight:"100vh",color:"#F1EFE8",overflowX:"hidden"}}>
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
                  loading={notifLoading}
                  onClose={() => setShowNotifPanel(false)}
                  onFollowBack={handleNotifFollowBack}
                  onRefetch={refetchNotifications}
                  onOpenProfile={handleOpenNotifProfile}
                  onDineTagTap={handleDineTagTap}
                  onHeartTap={handleHeartTap}
                  onTagMutualBack={handleDineTagMutualBack}
                  sheetOpen={!!notifSheetProfile || !!heartSheetTarget}
                  anchorPos={notifAnchorPos}
                  followingIds={notifFollowingIds}
                />
              )}
            </div>
          )}
          <button type="button" onClick={()=>setShowAuthModal(true)} style={{fontSize:11,fontWeight:500,padding:"5px 12px",borderRadius:20,border:"1.5px solid rgba(255,255,255,0.2)",background:user?"#3C1F13":"transparent",color:user?"#F0997B":"#888780",cursor:"pointer",letterSpacing:"0.03em",flexShrink:0,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={user?.email||t.signIn}>{user?(username||user.email?.split("@")[0]||t.account):t.signIn}</button>
        </div>
      </div>

      {!authReady && (
        <p style={{ fontSize: 14, color: "#888780", margin: "8px 0 0" }}>
          Connecting…
        </p>
      )}

      {authReady && showWelcome && dbLoaded && (
        <div onClick={()=>dismissWelcome()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1E1E1C",borderRadius:16,padding:"1.5rem",maxWidth:360,width:"100%",border:"0.5px solid rgba(255,255,255,0.15)"}}>
            <div style={{fontSize:24,marginBottom:12,textAlign:"center",cursor:"default",userSelect:"none"}}>👋</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16}}>
              <p style={{fontSize:16,fontWeight:600,color:"#F1EFE8",margin:0,lineHeight:1.5,textAlign:"center"}}>{welcomeTitleDisplay}</p>
              <InfoBubble content={welcomeBodyDisplay.split("\n\n")[0]||""}/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:13,color:"#C4C2BA",marginBottom:6,fontWeight:500}}>Location</div>
              <CityInput value={welcomeCity} onChange={setWelcomeCity} existingCities={existingCities}/>
              {(()=>{const cc=getCurrencyForCity(welcomeCity);const sym=CURRENCY_SYMBOLS[cc]||cc;return(<div style={{fontSize:12,color:"#666663",marginTop:6}}>{welcomeCity.trim()?`Currency: ${sym} ${cc}`:"Currency: $ USD (default)"}</div>);})()}
            </div>
            <div style={{borderTop:"0.5px solid rgba(255,255,255,0.08)",paddingTop:14,marginBottom:14}}>
              <WeightSliders weights={weights} labels={[[t.taste,"taste"],[t.bangBuck,"bpb"],[t.wait,"wait"]]} onUpdate={updW} onReset={resetWeights} defaults={{taste:50,bpb:40,wait:10}} careHeadingPx={15}/>
              <div style={{fontSize:12,color:canProceedWelcome?"#97C459":"#EF9F27",textAlign:"center",marginTop:8}}>
                {t.weightsTotal}: {restaurantWeightsSum}/100
              </div>
              {!canProceedWelcome&&(
                <div style={{fontSize:11,color:"#F1EFE8",textAlign:"center",marginTop:4}}>
                  {t.weightsSumTo100}
                </div>
              )}
            </div>
            {welcomeBodyDisplay.split("\n\n").slice(1).map((para,i)=>(
              <p key={i} style={{fontSize:13,color:"#F1EFE8",margin:"0 0 12px",lineHeight:1.7,textAlign:"center",whiteSpace:"pre-line"}}>{para}</p>
            ))}
            <button type="button" disabled={!canProceedWelcome} onClick={dismissWelcome} style={{width:"100%",padding:"12px",background:canProceedWelcome?"#F0997B":"#5A4A43",color:canProceedWelcome?"#141413":"#AFA8A3",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:canProceedWelcome?"pointer":"not-allowed",opacity:canProceedWelcome?1:0.85}}>{t.welcomeBtn}</button>
          </div>
        </div>
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
        <GuestPreview message="Sign in to start logging your own restaurant ratings" onSignIn={() => setShowAuthModal(true)}>
          <div>
            <div style={{marginBottom:8}}>
              <CategoryTabs active="restaurants" onChange={() => {}} />
            </div>
            <div style={{borderBottom:"0.5px solid rgba(255,255,255,0.08)",marginBottom:12}}/>
            {GUEST_PALETTE_ENTRIES.map(e=>{
              const sc=calcBiteOutOf10(e.taste,e.cost,e.portions,e.wait,e.useR,e.repeatability,weights,e.currency_code||"USD");
              return(
                <RestRow key={e.id} e={e} display={{val:sc!=null?sc.toFixed(2):"—",label:scoreLabel(sc,t),color:scoreColor(sc)}} user={null} weights={weights}/>
              );
            })}
          </div>
        </GuestPreview>
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
            {user&&<p style={{fontSize:12,color:"#888780",margin:0}}>{t.swipeHint}</p>}
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
                onSearch={setSearch}
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
              {filtered.length===0&&<p style={{color:"#888780",fontSize:14}}>{sortedR.length===0?t.noRestaurantsYet:t.noEntries}</p>}
              {restaurantGroupsPage.visible.map(({grp,e})=>{
                const visits=grp.length;
                const display=getDisplay(e);
                return (
                  <RestRow key={e.id} e={e} display={display} user={user} visits={visits} group={grp} weights={weights} homeCurrency={homeCurrency} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]}
                    onEdit={v=>{const entry=v||e;setEditR(entry);setEditDineWith(dinedWithMap.get(entry.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}}
                    onDelete={id=>{
                      const did=id||e.id;
                      const row=st.entries.find(x=>x.id===did);
                      if(!canMutateVisit(row,user))return;
                      setPendingDelete({onConfirm:async()=>{
                        try{await supabase.from("restaurant_visits").delete().eq("id",did);}catch(err){console.error("restaurant delete threw:",err);}
                        dispatch({type:"DEL",id:did});
                      }});
                    }}/>
                );
              })}
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
                onSearch={setCafeSearch}
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
              {drinkGroupsPage.visible.map(([name,grp])=>(
                <CafeGroupRow key={name} group={grp} cafeSortBy={cafeSortBy} weights={drinkWeights} user={user} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]} onEdit={e=>{setEditC(e);setEditDineWith(dinedWithMap.get(e.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={id=>{
                      const row=cafes.find(x=>x.id===id);
                      if(!canMutateVisit(row,user))return;
                      setPendingDelete({onConfirm:async()=>{
                        try{await supabase.from("cafe_visits").delete().eq("id",id);}catch(err){console.error("cafe delete threw:",err);}
                        setCafes(p=>p.filter(x=>x.id!==id));
                      }});
                    }}/>
              ))}
              <ShowMoreButton
                remaining={drinkGroupsPage.remaining}
                pageSize={drinkGroupsPage.pageSize}
                onClick={drinkGroupsPage.showMore}
              />
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
                onSearch={setSweetsSearch}
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
              {sweetGroupsPage.visible.map(([name,grp])=>(
                <CafeGroupRow key={name} group={grp} cafeSortBy={sweetsSortBy} weights={sweetWeights} user={user} dinedWithForEntry={(id)=>dinedWithMap.get(id)||[]} onEdit={e=>{setEditC(e);setEditDineWith(dinedWithMap.get(e.id)||[]);window.scrollTo({top:0,behavior:"smooth"});}} onDelete={id=>{
                      const row=cafes.find(x=>x.id===id);
                      if(!canMutateVisit(row,user))return;
                      setPendingDelete({onConfirm:async()=>{
                        try{await supabase.from("cafe_visits").delete().eq("id",id);}catch(err){console.error("cafe delete threw:",err);}
                        setCafes(p=>p.filter(x=>x.id!==id));
                      }});
                    }}/>
              ))}
              <ShowMoreButton
                remaining={sweetGroupsPage.remaining}
                pageSize={sweetGroupsPage.pageSize}
                onClick={sweetGroupsPage.showMore}
              />
            </div>
          )}
        </div>
      )}

      {pathname.startsWith("/community")&&dbLoaded&&(
        <CommunityTab
          user={user}
          restaurantWeights={weights}
          drinkWeights={drinkWeights}
          sweetWeights={sweetWeights}
          unseenFollowers={unseenFollowers}
          onMarkFollowersSeen={handleMarkFollowersSeen}
          onFollowChange={refreshSocialCounts}
          externalUserLogTarget={extUserLogTarget}
          onExternalUserLogConsumed={() => setExtUserLogTarget(null)}
          externalCompareTarget={extCompareTarget}
          onExternalCompareConsumed={() => setExtCompareTarget(null)}
          onSignIn={() => setShowAuthModal(true)}
        />
      )}

      {pathname.startsWith("/log")&&editR&&<RestForm initial={editR} initialDineWith={editDineWith} weights={weights} existingEntries={st.entries} existingCities={existingCities} places={restaurantPlaces}
        user={user} tasteBudIds={tasteBudIds}
        onPlaceCreated={(p)=>upsertPlace(setRestaurantPlaces, p.id, p)}
        onSave={async e=>{
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
        const newlyTaggedRest = (e.dineWith || []).filter((p) => !prevRestIds.has(p.id));
        if (removedRestIds.length && e.id) {
          // Untagging during edit: explicitly delete the rows. Notifications stay
          // (IG / Strava convention — once delivered, notifications aren't recalled).
          const { error: delErr } = await supabase.from("dine_with_tags").delete()
            .eq("tagger_id", user.id).eq("entry_id", e.id).in("tagged_id", removedRestIds);
          if (delErr) console.warn("[BITE] edit untag delete (rest):", delErr.message);
        }
        if (newlyTaggedRest.length && e.id) {
          await Promise.all(newlyTaggedRest.map((p) => insertDineTag(supabase, {
            taggerId: user.id, taggedId: p.id, entryId: e.id,
            entryType: "restaurant", restaurantName: e.name, city: e.city || "", cuisine: e.cuisine || "",
          })));
        }
        if (removedRestIds.length || newlyTaggedRest.length) {
          fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
        }
        setEditR(null); setEditDineWith([]);
      }} onCancel={()=>{setEditR(null);setEditDineWith([]);window.scrollTo({top:0,behavior:"smooth"});}}/>}
      {pathname.startsWith("/log")&&editC&&<CafeForm initial={editC} initialDineWith={editDineWith} weights={editC?.category==="Sweets"?sweetWeights:drinkWeights}
        user={user} tasteBudIds={tasteBudIds}
        onPlaceCreated={(p)=>upsertPlace(setCafePlaces, p.id, p)}
        onSave={async e=>{
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
        const newlyTaggedCafe = (e.dineWith || []).filter((p) => !prevCafeIds.has(p.id));
        if (removedCafeIds.length && e.id) {
          const { error: delErr } = await supabase.from("dine_with_tags").delete()
            .eq("tagger_id", user.id).eq("entry_id", e.id).in("tagged_id", removedCafeIds);
          if (delErr) console.warn("[BITE] edit untag delete (cafe):", delErr.message);
        }
        if (newlyTaggedCafe.length && e.id) {
          await Promise.all(newlyTaggedCafe.map((p) => insertDineTag(supabase, {
            taggerId: user.id, taggedId: p.id, entryId: e.id,
            entryType: "cafe", restaurantName: e.name, city: e.city || "", cuisine: e.category || "",
          })));
        }
        if (removedCafeIds.length || newlyTaggedCafe.length) {
          fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
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
        const newlyTagged = (e.dineWith||[]).filter(p=>!prevIds.has(p.id));
        if (removedIds.length && e.id) {
          const { error: delErr } = await supabase.from("dine_with_tags").delete()
            .eq("tagger_id", user.id).eq("entry_id", e.id).in("tagged_id", removedIds);
          if (delErr) console.warn("[BITE] edit untag delete (cafe save+continue):", delErr.message);
        }
        if (newlyTagged.length && e.id) {
          await Promise.all(newlyTagged.map(p=>insertDineTag(supabase,{taggerId:user.id,taggedId:p.id,entryId:e.id,entryType:"cafe",restaurantName:e.name,city:e.city||"",cuisine:e.category||""})));
        }
        if (removedIds.length || newlyTagged.length) {
          fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
        }
        setEditC(null); setEditDineWith([]);
        setAddPrefill({ name: e.name, city: e.city||"", placeId: resolvedPlaceId||null, category: e.category });
        setAddType("cafe");
        navigate("/add");
      }}
      onCancel={()=>{setEditC(null);setEditDineWith([]);window.scrollTo({top:0,behavior:"smooth"});}} existingCafes={cafes} existingCities={existingCities} places={cafePlaces}/>}

      {/* ── Add Rating ── */}
      {pathname==="/add"&&!user&&(
        <GuestPreview message="Sign in to start logging your own ratings" onSignIn={() => setShowAuthModal(true)}>
          <RestForm
            initial={{...INIT_REST, city:"NYC"}}
            weights={weights}
            existingEntries={[]}
            existingCities={[]}
            places={[]}
            onPlaceCreated={()=>{}}
            onSave={()=>{}}
            onCancel={()=>{}}
            addType="restaurant"
            setAddType={()=>{}}
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
              setDineTags(prev=>prev.filter(t=>t.id!==tagId));
              setDineTagCount(prev=>Math.max(0,prev-1));
              try {
                const raw = sessionStorage.getItem(`bite_dineTagsCache_${user.id}`);
                if (raw) {
                  const cached = JSON.parse(raw);
                  cached.tags = (cached.tags||[]).filter(t=>t.id!==tagId);
                  cached.count = Math.max(0,(cached.count||1)-1);
                  sessionStorage.setItem(`bite_dineTagsCache_${user.id}`, JSON.stringify(cached));
                }
              } catch {}
            }}
            onAddType={(type, tag) => {
              if (tag) {
                applyDineTagPrefill({
                  restaurantName: tag.restaurant_name,
                  city: tag.city,
                  cuisine: tag.cuisine,
                  taggerId: tag.tagger_id,
                  entryId: tag.entry_id,
                  taggerProfile: tag.taggerProfile,
                  entryType: tag.entry_type || type,
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
                      .insert([restaurantVisitInsertPayload(placeId, user.id, e)])
                      .select(RESTAURANT_VISIT_SELECT)
                      .single();
                    if (error) {
                      console.error("restaurant insert error:", error);
                      setAddSaveErr(error.message || "Save failed — check console");
                      return;
                    }
                    if (data) {
                      dispatch({ type: "ADD", e: mapRestaurantVisitRow(data) });
                      if (user?.id) { try { localStorage.removeItem(`bite_addRating_draft_${user.id}`); } catch {} }
                      setAddDraftData(null);
                      const toTag = (e.dineWith || []).filter(p => p.id !== sourceTaggerId);
                      if (toTag.length) {
                        await Promise.all(toTag.map(p=>insertDineTag(supabase,{
                          taggerId: user.id,
                          taggedId: p.id,
                          entryId: data.id,
                          entryType: "restaurant",
                          restaurantName: e.name,
                          city: e.city||"",
                          cuisine: e.cuisine||"",
                        })));
                        fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
                      }
                      if (sourceTaggerId) {
                        await Promise.all([
                          supabase.from("dine_with_tags").upsert({
                            tagger_id: user.id, tagged_id: sourceTaggerId,
                            entry_id: data.id, entry_type: "restaurant",
                            restaurant_name: e.name, city: e.city||"", cuisine: e.cuisine||"",
                            dismissed: true,
                          }, { onConflict: "entry_id,tagger_id,tagged_id", ignoreDuplicates: true }),
                          supabase.from("notifications").insert({
                            user_id: sourceTaggerId, from_user_id: user.id,
                            type: "dine_tag_accepted",
                            meta: { restaurant_name: e.name, entry_type: "restaurant", city: e.city||"" },
                          }),
                        ]);
                        fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
                      }
                      formStateRef.current = null;
                      navigate("/log");
                    }
                  } catch (err) {
                    console.error("restaurant insert threw:", err);
                    setAddSaveErr(err?.message || "Save failed — check console");
                  }
                }}
                onCancel={()=>{formStateRef.current=null;setAddPrefill(null);setAddInitialDineWith([]);setAddTagTaggerId(null);navigate("/log");}}
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
                  const inserted = await insertCafeEntry(e);
                  const toTag = (e.dineWith || []).filter(p => p.id !== sourceTaggerId);
                  if (toTag.length && inserted?.id) {
                    try {
                      await Promise.all(toTag.map(p=>insertDineTag(supabase,{
                        taggerId: user.id,
                        taggedId: p.id,
                        entryId: inserted.id,
                        entryType: "cafe",
                        restaurantName: e.name,
                        city: e.city||"",
                        cuisine: e.category||"",
                      })));
                      fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
                    } catch (tagErr) {
                      console.error("dine tag insert error:", tagErr);
                    }
                  }
                  if (sourceTaggerId && inserted?.id) {
                    await Promise.all([
                      supabase.from("dine_with_tags").upsert({
                        tagger_id: user.id, tagged_id: sourceTaggerId,
                        entry_id: inserted.id, entry_type: "cafe",
                        restaurant_name: e.name, city: e.city||"", cuisine: e.category||"",
                        dismissed: true,
                      }, { onConflict: "entry_id,tagger_id,tagged_id", ignoreDuplicates: true }),
                      supabase.from("notifications").insert({
                        user_id: sourceTaggerId, from_user_id: user.id,
                        type: "dine_tag_accepted",
                        meta: { restaurant_name: e.name, entry_type: "cafe", city: e.city||"" },
                      }),
                    ]);
                    fetchDinedWithByEntry(supabase, user.id).then(setDinedWithMap);
                  }
                  formStateRef.current = null;
                  navigate(e.category==="Sweets"?"/log/sweets":"/log/drinks");
                }}
                onSaveAndContinue={async e=>{
                  setAddPrefill(null);
                  setAddInitialDineWith([]);
                  if (e.city) persistLastCity(e.city);
                  const inserted = await insertCafeEntry(e);
                  const toTag = (e.dineWith || []).filter(p => p.id !== addTagTaggerId);
                  if (toTag.length && inserted?.id) {
                    try {
                      await Promise.all(toTag.map(p=>insertDineTag(supabase,{
                        taggerId: user.id,
                        taggedId: p.id,
                        entryId: inserted.id,
                        entryType: "cafe",
                        restaurantName: e.name,
                        city: e.city||"",
                        cuisine: e.category||"",
                      })));
                    } catch (tagErr) {
                      console.error("dine tag insert error:", tagErr);
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
        <GuestPreview message="Sign in to see your personal taste profile" onSignIn={() => setShowAuthModal(true)}>
          <PaletteView
            entries={GUEST_PALETTE_ENTRIES}
            cafes={[]}
            weights={weights}
            replaceRestaurantWeights={()=>{}}
            drinkWeights={drinkWeights}
            replaceDrinkWeights={()=>{}}
            sweetWeights={sweetWeights}
            replaceSweetWeights={()=>{}}
            questL={new Set()}
            toggleQ={()=>{}}
            onOpenSuggest={()=>{}}
          />
        </GuestPreview>
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
          setNotifSheetProfile(null);
          setShowNotifPanel(false);
          setExtCompareTarget(profile);
          navigate("/community/compare");
        }}
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
    </LangContext.Provider>
  );
}
