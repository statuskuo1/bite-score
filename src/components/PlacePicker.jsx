import { useEffect, useMemo, useRef, useState } from "react";
import { S } from "../styles/sharedStyles.js";
import { supabase } from "../config/supabaseClient.js";
import { newSessionToken, resolveGooglePlace, searchGooglePlaces } from "../utils/googlePlacesApi.js";

/**
 * Shared-catalog name picker for restaurants/cafés. Suggestions come from the
 * cross-user `*_places` table; once the typed query has no exact catalog
 * match we additionally surface Google Autocomplete predictions (gated by an
 * Edge Function with a monthly budget guardrail — see
 * docs/decisions/2026-04-28-google-places-verified-fields.md).
 *
 * Picking a Google prediction calls `places-resolve` which inserts a row into
 * `*_places` with `google_place_id` + `verified_*` fields. The new row is
 * piped back through `onPlaceCreated` so the parent can hot-merge it into its
 * shared `places` state, and then we `pick(row)` like any catalog match.
 *
 * Editing the input after a pick clears `selectedPlaceId`; that contract is
 * unchanged.
 */
export function PlacePicker({
  value,
  selectedPlaceId,
  places,
  onChange,
  onPlaceCreated,
  placeholder,
  /** "restaurant" (default) or "cafe" — drives Google primaryType filter and
   *  which `*_places` table the resolve function writes to. */
  kind = "restaurant",
  /** Optional free-text city the form already collected (e.g. "Chicago",
   *  "Tokyo"). Forwarded to Google Text Search so predictions are biased to
   *  the user's stated location instead of the browser IP. Empty string is
   *  treated as "no hint" and we fall back to Google's IP-based bias. */
  cityHint = "",
}) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);

  const q = value.trim().toLowerCase();
  const all = Array.isArray(places) ? places : [];

  /** Dedupe by id (defensive — caller may merge multiple sources later). */
  const byId = new Map();
  for (const p of all) {
    if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
  }
  const dedup = [...byId.values()];

  /** Display fields prefer the Google-verified version when present so the
   *  picker stays consistent with what the form will autopopulate. */
  function displayName(p) { return p.verifiedName || p.name || ""; }
  function displayCity(p) { return p.verifiedCity || p.city || ""; }

  const filtered = q.length > 0
    ? dedup
        .filter((p) => displayName(p) && displayName(p).toLowerCase().includes(q))
        .sort((a, b) => {
          const an = displayName(a).toLowerCase();
          const bn = displayName(b).toLowerCase();
          const aStarts = an.startsWith(q) ? 0 : 1;
          const bStarts = bn.startsWith(q) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return an.localeCompare(bn);
        })
        .slice(0, 30)
    : [];

  const exactMatch = q.length > 0 && filtered.some((p) => displayName(p).toLowerCase() === q);

  // ---- Google autocomplete fallback ----------------------------------------

  /** One session token spans many keystrokes + the eventual Place Details
   *  call. Rotated after a successful resolve so billing stays bundled. */
  const sessionTokenRef = useRef(newSessionToken());
  /** Once the hard cap fires for this page load we stop calling Google
   *  entirely — `places-search` is rate-limited but we don't want every
   *  keystroke to round-trip to Supabase just to be told "still capped". */
  const cappedRef = useRef(false);
  const [googlePredictions, setGooglePredictions] = useState([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  /** Suppress Google IDs that already match a row in our catalog (by
   *  `googlePlaceId`) — those should appear as catalog hits, not Google ones.
   *  Filtered at RENDER time, not inside the fetch effect, so this doesn't
   *  destabilize the effect deps (`dedup` is a fresh array every render, so
   *  including `knownGoogleIds` in the effect deps would invalidate on every
   *  parent render and re-fire the debounced fetch — see flicker repro). */
  const knownGoogleIds = useMemo(() => {
    const set = new Set();
    for (const p of dedup) {
      if (p.googlePlaceId) set.add(p.googlePlaceId);
    }
    return set;
  }, [dedup]);

  useEffect(() => {
    /** Skip Google when:
     *  - typed text is too short / empty
     *  - the typed text exactly matches a catalog row (no need)
     *  - we already know we're capped for this page load */
    const minLen = /[　-鿿가-힯぀-ヿ]/.test(q) ? 1 : 3;
    if (q.length < minLen || exactMatch || cappedRef.current) {
      setGooglePredictions([]);
      setGoogleLoading(false);
      return;
    }
    /** AbortController on every render: if the user keeps typing (q changes),
     *  the cleanup fires `ac.abort()` and Google drops the in-flight request,
     *  so stale responses can't overwrite newer ones and we don't burn
     *  quota on calls we no longer care about. The 300ms debounce still
     *  gates how often we hit the network in the first place. */
    const ac = new AbortController();
    setGoogleLoading(true);
    const handle = setTimeout(async () => {
      const { predictions, capped, aborted } = await searchGooglePlaces(supabase, {
        kind,
        query: q,
        cityHint,
        sessionToken: sessionTokenRef.current,
        signal: ac.signal,
      });
      if (ac.signal.aborted || aborted) return;
      if (capped) cappedRef.current = true;
      setGooglePredictions(predictions || []);
      setGoogleLoading(false);
    }, 300);
    return () => {
      ac.abort();
      clearTimeout(handle);
    };
  }, [q, kind, exactMatch, cityHint]);

  /** Apply the catalog-dedup filter at render time so post-resolve catalog
   *  growth (via `onPlaceCreated` → parent `places` update) hides the just-
   *  resolved Google row from the predictions list without re-fetching. */
  const visibleGooglePredictions = useMemo(
    () => googlePredictions.filter((p) => !knownGoogleIds.has(p.placeId)),
    [googlePredictions, knownGoogleIds],
  );

  // ---- Outside-click + handlers --------------------------------------------

  useEffect(() => {
    function h(e) {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleType(next) {
    /** Clear pinned placeId whenever the typed text drifts from the picked name. */
    const stillMatches = selectedPlaceId
      && dedup.some((p) => p.id === selectedPlaceId && displayName(p) === next);
    onChange({
      name: next,
      placeId: stillMatches ? selectedPlaceId : null,
      city: null,
    });
    setShow(true);
  }

  function pick(place) {
    /** Pass place-level fields through directly, not just `placeId` — a Google
     *  resolve just synthesized this row and the parent's `places` catalog
     *  state hasn't re-rendered yet, so a `places.find(...)` lookup would miss.
     *  Forms should prefer these picker-provided values and fall back to
     *  `places.find(...)` for catalog hits where the row already exists. */
    onChange({
      name: displayName(place),
      placeId: place.id,
      city: displayCity(place),
      cuisine: place.verifiedCuisine || place.cuisine || "",
      cuisine2: place.cuisine2 || "",
      isFusion: !!place.isFusion,
      googlePlaceId: place.googlePlaceId || "",
    });
    setShow(false);
  }

  async function pickGoogle(prediction) {
    setResolvingId(prediction.placeId);
    /** Pass the full prediction through — it carries the details payload from
     *  Text Search so the resolve step can upsert without a second Google
     *  call. */
    const resolved = await resolveGooglePlace(supabase, {
      kind,
      googlePlaceId: prediction.placeId,
      prediction,
      sessionToken: sessionTokenRef.current,
      fallback: { name: prediction.primaryText, city: prediction.secondaryText },
    });
    setResolvingId(null);
    /** Rotate the session token (no-op for Text Search; harmless to keep). */
    sessionTokenRef.current = newSessionToken();
    if (!resolved) {
      /** Hard fallback: keep the typed text, let the user save manually. */
      onChange({ name: prediction.primaryText, placeId: null, city: null });
      setShow(false);
      return;
    }
    if (typeof onPlaceCreated === "function") {
      onPlaceCreated(resolved);
    }
    pick(resolved);
  }

  function addNew() {
    onChange({ name: value.trim(), placeId: null, city: null });
    setShow(false);
  }

  /** Show the Add-new line only when Google has nothing to offer. If Google is
   *  loading we wait — otherwise users would see "Add new" flash before the
   *  predictions arrive. If we're capped we show Add-new immediately so the
   *  user is never stuck. */
  const googleHasResults = visibleGooglePredictions.length > 0;
  const showAddNew = q.length > 0
    && !exactMatch
    && !googleLoading
    && !googleHasResults;

  const dropdownVisible = show
    && (filtered.length > 0 || googleHasResults || googleLoading || showAddNew);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={value}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => setShow(true)}
          placeholder={placeholder || "e.g. Birch Coffee"}
          style={{ ...S.wb, paddingRight: value ? 28 : undefined }}
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange({ name: "", placeId: null, city: null });
              setShow(false);
            }}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "#888780", fontSize: 18, lineHeight: 1, padding: 0,
              display: "flex", alignItems: "center",
            }}
          >×</button>
        )}
      </div>
      {dropdownVisible && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#1E1E1C",
            border: "0.5px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            zIndex: 100,
            maxHeight: 260,
            overflowY: "auto",
            marginTop: 4,
          }}
        >
          {filtered.map((p) => {
            const isPicked = selectedPlaceId === p.id;
            return (
              <div
                key={p.id}
                onMouseDown={() => pick(p)}
                style={rowStyle(isPicked)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2C2C2A")}
                onMouseLeave={(e) => (e.currentTarget.style.background = isPicked ? "#2C2C2A" : "transparent")}
              >
                <span style={ellipsis}>{displayName(p)}</span>
                {displayCity(p) && (
                  <span style={cityChip}>📍 {displayCity(p)}</span>
                )}
              </div>
            );
          })}

          {(googleHasResults || googleLoading) && (
            <div style={sectionHeader}>
              <span>via Google</span>
              {googleLoading && <span style={{ opacity: 0.5 }}>…</span>}
            </div>
          )}
          {visibleGooglePredictions.map((g) => {
            const isResolving = resolvingId === g.placeId;
            return (
              <div
                key={`g-${g.placeId}`}
                onMouseDown={(e) => { e.preventDefault(); if (!isResolving) pickGoogle(g); }}
                style={{
                  ...rowStyle(false),
                  opacity: isResolving ? 0.55 : 1,
                  cursor: isResolving ? "progress" : "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2C2C2A")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={ellipsis}>{g.primaryText}</span>
                {(g.secondaryText || isResolving) && (
                  <span style={cityChip}>{isResolving ? "resolving…" : g.secondaryText}</span>
                )}
              </div>
            );
          })}

          {showAddNew && (
            <div
              onMouseDown={addNew}
              style={{
                padding: "8px 12px",
                fontSize: 13,
                color: "#F0997B",
                cursor: "pointer",
                borderTop: filtered.length > 0 ? "0.5px solid rgba(255,255,255,0.08)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2C2C2A")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              + Add new: "{value.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" };
const cityChip = { fontSize: 11, color: "#888780", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" };

function rowStyle(isPicked) {
  return {
    padding: "8px 12px",
    fontSize: 13,
    color: "#F1EFE8",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    background: isPicked ? "#2C2C2A" : "transparent",
  };
}

const sectionHeader = {
  padding: "6px 12px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#888780",
  background: "#171716",
  borderTop: "0.5px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between",
};
