import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../config/supabaseClient.js";
import { accountUsesOauthOnly, fetchEmailForUsername, suggestAvailableUsernames, updateOwnProfile, validateUsername } from "../utils/profileApi.js";
import { listFollows } from "../utils/followsApi.js";
import { computeFoodStats, fetchRestaurantVisitsForUser } from "../utils/visitPlacesApi.js";
import { FoodStatsBlock } from "./FoodStatsBlock.jsx";

/** Always the tab’s origin so local dev and Vercel previews return here; must be listed in Supabase → Auth → URL configuration → Redirect URLs. */
const redirectBase = () => window.location.origin.replace(/\/$/, "");

/** Local dev disables Google because OAuth needs extra Google Cloud Console / Supabase redirect URI setup. Production keeps it on unless explicitly hidden. */
const hideGoogleAuth =
  import.meta.env.DEV || import.meta.env.VITE_HIDE_GOOGLE_AUTH === "true";

function formatPasswordSignInError(e, t) {
  const msg = e?.message || t.authErrorGeneric;
  if (/invalid login credentials/i.test(msg)) return `${msg} — ${t.authInvalidLogin}`;
  return msg;
}

function formatPasswordSignUpError(e, t) {
  const msg = e?.message || t.authErrorGeneric;
  if (/already registered|already been registered|user already exists/i.test(msg)) return `${msg} — ${t.authTrySignInInstead}`;
  return msg;
}

export function AuthModal({ open, onClose }) {
  const { t } = useLang();
  const { user, session, username, profile, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resetSent, setResetSent] = useState(false);
  /** Email address awaiting verification after sign-up; renders the "Check your email" panel when set. */
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null);
  /** Seconds remaining before the user may request another verification email; 0 means "available". */
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendOk, setResendOk] = useState(false);

  /** Profile editor state. Drafts are seeded from the current profile when the modal opens. */
  const [usernameDraft, setUsernameDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  /** "username_taken" | "invalid_username" | "network" | null */
  const [saveError, setSaveError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);
  /** Available alternatives shown as chips when saveError === "username_taken". */
  const [suggestions, setSuggestions] = useState([]);
  const usernameInputRef = useRef(null);

  const [editMode, setEditMode] = useState(false);
  const [socialCounts, setSocialCounts] = useState({ followers: 0, following: 0, tasteBuds: 0 });
  const [foodStats, setFoodStats] = useState({ restaurants: 0, cuisines: 0, cities: 0, regions: 0 });

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    Promise.all([
      listFollows(supabase, user.id),
      fetchRestaurantVisitsForUser(supabase, user.id),
    ]).then(([follows, visits]) => {
      if (cancelled) return;
      setSocialCounts({
        followers: follows.followers.length,
        following: follows.following.length,
        tasteBuds: follows.tasteBuds.length,
      });
      setFoodStats(computeFoodStats(visits));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, user?.id]);

  /** Seed drafts from the live profile every time the modal opens or the profile changes. */
  useEffect(() => {
    if (!open || !user) return;
    setUsernameDraft(profile?.username ?? username ?? "");
    setDisplayNameDraft(profile?.display_name ?? "");
    setSaveError(null);
    setSaveOk(false);
    setSuggestions([]);
    setEditMode(false);
  }, [open, user?.id, profile?.username, profile?.display_name, username]);

  /** Auto-clear the "Saved" indicator after a short window. */
  useEffect(() => {
    if (!saveOk) return;
    const id = setTimeout(() => setSaveOk(false), 1800);
    return () => clearTimeout(id);
  }, [saveOk]);

  /** Tick the resend cooldown down to zero so the Resend button re-enables. */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  /** Auto-clear the "Resent" confirmation after a short window. */
  useEffect(() => {
    if (!resendOk) return;
    const id = setTimeout(() => setResendOk(false), 2400);
    return () => clearTimeout(id);
  }, [resendOk]);

  const usernameTrim = usernameDraft.trim();
  const displayNameTrim = displayNameDraft.trim();
  const usernameLooksValid = useMemo(
    () => validateUsername(usernameTrim) === null,
    [usernameTrim]
  );
  const isDirty =
    usernameTrim !== (profile?.username ?? "").trim() ||
    displayNameTrim !== (profile?.display_name ?? "").trim();
  const canSave = !!user && usernameLooksValid && isDirty && !saveBusy;

  /** Surface taken/invalid inline on the username field; network errors go to the shared err line. */
  const usernameInlineErr = (() => {
    if (saveError === "username_taken") return t.profileUsernameTaken;
    if (saveError === "invalid_username") return t.profileUsernameInvalid;
    if (usernameTrim.length > 0 && !usernameLooksValid) return t.profileUsernameInvalid;
    return null;
  })();

  if (!open) return null;

  async function signGoogle() {
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${redirectBase()}/`,
          /** Ask Google to show the account picker so users can switch after logout. */
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      setErr(e.message || t.authErrorGeneric);
      setBusy(false);
    }
  }

  /**
   * Resolve a sign-in / reset identifier to an email address. Inputs containing
   * `@` pass through as-is; bare usernames go through the `email_for_username`
   * RPC. Returns null when a username can't be resolved so callers can surface
   * the standard wrong-credentials error without leaking which half failed.
   */
  async function resolveIdentifierToEmail(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.includes("@")) return trimmed;
    return await fetchEmailForUsername(supabase, trimmed);
  }

  async function signInWithPassword() {
    setErr("");
    setResetSent(false);
    const trimmed = email.trim();
    if (!trimmed) {
      setErr(t.authEmailRequired);
      return;
    }
    if (!password) {
      setErr(t.authPasswordRequired);
      return;
    }
    setBusy(true);
    try {
      const resolved = await resolveIdentifierToEmail(trimmed);
      if (!resolved) {
        setErr(t.authInvalidLogin);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: resolved,
        password,
      });
      if (error) throw error;
      setPassword("");
      onClose();
    } catch (e) {
      console.error(e);
      /** Supabase returns the same "Invalid login credentials" for wrong-password and no-password (Google-only)
       *  accounts. Probe via RPC so we can show a friendly "use Google" hint instead of the generic message. */
      if (/invalid login credentials/i.test(e?.message || "")) {
        const oauthOnly = await accountUsesOauthOnly(supabase, trimmed);
        if (oauthOnly) {
          setErr(t.authUseGoogleInstead);
          return;
        }
      }
      setErr(formatPasswordSignInError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function signUpWithPassword() {
    setErr("");
    setResetSent(false);
    const trimmed = email.trim();
    if (!trimmed) {
      setErr(t.authEmailRequired);
      return;
    }
    /** Sign-in accepts username, but sign-up always needs a real email so Supabase can deliver the confirmation. */
    if (!trimmed.includes("@")) {
      setErr(t.authSignUpEmailRequired);
      return;
    }
    if (!password) {
      setErr(t.authPasswordRequired);
      return;
    }
    setBusy(true);
    try {
      /** With email confirmations on, Supabase returns `data.session === null` and emails a confirm link. */
      const { data, error } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: { emailRedirectTo: `${redirectBase()}/` },
      });
      if (error) throw error;
      setPassword("");
      if (data?.session) {
        onClose();
        return;
      }
      /** Confirmations on: keep modal open and show the "Check your email" panel.
       *  Note: Supabase also returns 200 + null session for already-registered emails (anti-enumeration);
       *  treating both cases identically is intentional. */
      setPendingVerificationEmail(trimmed);
      setResendCooldown(30);
      setResendOk(false);
    } catch (e) {
      console.error(e);
      setErr(formatPasswordSignUpError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!pendingVerificationEmail || resendCooldown > 0) return;
    setErr("");
    setResendOk(false);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingVerificationEmail,
        options: { emailRedirectTo: `${redirectBase()}/` },
      });
      if (error) throw error;
      setResendOk(true);
      setResendCooldown(30);
    } catch (e) {
      console.error(e);
      setErr(e.message || t.authErrorGeneric);
    } finally {
      setBusy(false);
    }
  }

  function changeEmailFromVerification() {
    setPendingVerificationEmail(null);
    setResendCooldown(0);
    setResendOk(false);
    setErr("");
  }

  async function requestPasswordReset() {
    setErr("");
    setResetSent(false);
    const trimmed = email.trim();
    if (!trimmed) {
      setErr(t.authEmailRequired);
      return;
    }
    setBusy(true);
    try {
      const resolved = await resolveIdentifierToEmail(trimmed);
      if (!resolved) {
        /** Mirror sign-in: don't surface "username not found" — show generic invalid-login text so we don't enumerate. */
        setErr(t.authInvalidLogin);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(resolved, {
        redirectTo: `${redirectBase()}/`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (e) {
      console.error(e);
      setErr(e.message || t.authErrorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!user || !canSave) return;
    setErr("");
    setSaveError(null);
    setSaveOk(false);
    setSaveBusy(true);
    try {
      const res = await updateOwnProfile(supabase, user.id, {
        username: usernameTrim,
        displayName: displayNameTrim,
      });
      if (!res.ok) {
        if (res.code === "network") setErr(t.profileSavingErr);
        else setSaveError(res.code);
        if (res.code === "username_taken") {
          suggestAvailableUsernames(supabase, usernameTrim)
            .then((list) => setSuggestions(list))
            .catch(() => setSuggestions([]));
        }
        return;
      }
      await refreshProfile();
      setSaveOk(true);
      setSuggestions([]);
      setEditMode(false);
    } catch (e) {
      console.error(e);
      setErr(t.profileSavingErr);
    } finally {
      setSaveBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setErr("");
    try {
      await supabase.auth.signOut();
      setEmail("");
      setPassword("");
      setResetSent(false);
      onClose();
    } catch (e) {
      console.error(e);
      setErr(e.message || t.authErrorGeneric);
    } finally {
      setBusy(false);
    }
  }

  const panel = {
    background: "#1E1E1C",
    borderRadius: 16,
    padding: "1.35rem",
    maxWidth: 360,
    width: "100%",
    border: "0.5px solid rgba(255,255,255,0.15)",
    boxSizing: "border-box",
  };
  const btn = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    cursor: busy ? "wait" : "pointer",
    border: "none",
    marginBottom: 10,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ display: "flex", justifyContent: session ? "flex-end" : "space-between", alignItems: "center", marginBottom: session ? 8 : 14 }}>
          {!session && (
            <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8" }}>
              {pendingVerificationEmail ? t.authVerifySentTitle : t.authTitle}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: 22, color: "#888780", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {session && user ? (
          <div>
            {/* ── Centered avatar + name (both states) ── */}
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{
                    width: 56, height: 56, borderRadius: "50%",
                    objectFit: "cover",
                    border: "0.5px solid rgba(255,255,255,0.12)",
                    marginBottom: 8,
                  }}
                />
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "#3C1F13", color: "#F0997B",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 600, lineHeight: 1,
                  marginBottom: 8,
                }}>
                  {((profile?.display_name || usernameTrim || username || user.email || "?")).charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8", lineHeight: 1.2 }}>
                {profile?.display_name || username || user.email?.split("@")[0] || "—"}
              </div>
              <div style={{ fontSize: 13, color: "#C4C2BA", marginTop: 3 }}>
                @{username || "—"}
              </div>
            </div>

            {!editMode ? (
              <>
                {/* ── Social stats ── */}
                <div style={{ textAlign: "center", fontSize: 13, color: "#C4C2BA", marginBottom: 14 }}>
                  <span>{socialCounts.followers} followers</span>
                  <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
                  <span>{socialCounts.following} following</span>
                  <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
                  <span>{socialCounts.tasteBuds} taste buds</span>
                </div>

                {/* ── Food stats ── */}
                <FoodStatsBlock stats={foodStats} style={{ marginBottom: 14 }} />

                {/* ── Default action buttons ── */}
                {saveOk && (
                  <p style={{ fontSize: 12, color: "#97C459", margin: "0 0 8px", textAlign: "center" }}>{t.profileSaved}</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    style={{ ...btn, flex: 1, marginBottom: 0, background: "#3C1F13", color: "#F0997B", border: "none" }}
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={signOut}
                    style={{ ...btn, flex: 1, marginBottom: 0, background: "transparent", color: "#C4C2BA", border: "0.5px solid rgba(255,255,255,0.2)" }}
                  >
                    {t.signOut}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ── Edit form ── */}
                <div style={{ background: "#141413", borderRadius: 10, padding: "12px", marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#C4C2BA", display: "block", marginBottom: 4 }}>{t.profileUsernameLabel}</label>
                  <input
                    ref={usernameInputRef}
                    type="text"
                    autoComplete="off"
                    value={usernameDraft}
                    onChange={(e) => { setUsernameDraft(e.target.value.toLowerCase()); setSaveError(null); setSaveOk(false); setSuggestions([]); }}
                    maxLength={30}
                    style={{
                      width: "100%", boxSizing: "border-box", marginBottom: 3,
                      fontSize: 13, padding: "6px 10px",
                      borderColor: usernameInlineErr ? "#A32D2D" : undefined,
                    }}
                  />
                  <div style={{ fontSize: 10, color: usernameInlineErr ? "#A32D2D" : "#666663", marginBottom: saveError === "username_taken" && suggestions.length > 0 ? 5 : 10, lineHeight: 1.4 }}>
                    {usernameInlineErr || t.profileUsernameHelp}
                  </div>
                  {saveError === "username_taken" && suggestions.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: "#888780" }}>{t.profileUsernameSuggest}</span>
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setUsernameDraft(s); setSaveError(null); setSuggestions([]); usernameInputRef.current?.focus(); }}
                          style={{ padding: "3px 8px", borderRadius: 14, fontSize: 11, background: "#3C1F13", color: "#F0997B", border: "1px solid rgba(240,153,123,0.4)", cursor: "pointer" }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <label style={{ fontSize: 11, color: "#C4C2BA", display: "block", marginBottom: 4 }}>{t.profileDisplayNameLabel}</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={displayNameDraft}
                    onChange={(e) => { setDisplayNameDraft(e.target.value); setSaveOk(false); }}
                    maxLength={120}
                    style={{ width: "100%", boxSizing: "border-box", marginBottom: 3, fontSize: 13, padding: "6px 10px" }}
                  />
                  <div style={{ fontSize: 10, color: "#666663", marginBottom: 10, lineHeight: 1.4 }}>{t.profileDisplayNameHelp}</div>

                  <label style={{ fontSize: 11, color: "#C4C2BA", display: "block", marginBottom: 3 }}>{t.profileEmailLabel}</label>
                  <div style={{ fontSize: 13, color: "#F1EFE8", wordBreak: "break-all" }}>{user.email || "—"}</div>
                </div>

                {/* ── Edit action buttons ── */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setEditMode(false); setSaveError(null); setSuggestions([]); setUsernameDraft(profile?.username ?? username ?? ""); setDisplayNameDraft(profile?.display_name ?? ""); }}
                    style={{ ...btn, flex: 1, marginBottom: 0, background: "transparent", color: "#C4C2BA", border: "0.5px solid rgba(255,255,255,0.2)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy || saveBusy || !canSave}
                    onClick={saveProfile}
                    style={{
                      ...btn, flex: 1, marginBottom: 0,
                      background: canSave ? "#F0997B" : "#5A4A43",
                      color: canSave ? "#141413" : "#AFA8A3",
                      cursor: (busy || saveBusy) ? "wait" : (canSave ? "pointer" : "not-allowed"),
                      opacity: canSave ? 1 : 0.85,
                    }}
                  >
                    {saveBusy ? "…" : t.profileSave}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : pendingVerificationEmail ? (
          <div>
            <p style={{ fontSize: 13, color: "#C4C2BA", margin: "0 0 16px", lineHeight: 1.55 }}>
              {t.authVerifySentBody.replace("{email}", pendingVerificationEmail)}
            </p>
            <button
              type="button"
              disabled={busy || resendCooldown > 0}
              onClick={resendVerification}
              style={{
                ...btn,
                background: resendCooldown > 0 ? "#5A4A43" : "#F0997B",
                color: resendCooldown > 0 ? "#AFA8A3" : "#141413",
                cursor: busy ? "wait" : (resendCooldown > 0 ? "not-allowed" : "pointer"),
                opacity: resendCooldown > 0 ? 0.85 : 1,
              }}
            >
              {resendCooldown > 0
                ? t.authVerifyResendCooldown.replace("{sec}", String(resendCooldown))
                : t.authVerifyResend}
            </button>
            {resendOk && (
              <p style={{ fontSize: 12, color: "#97C459", margin: "0 0 10px", textAlign: "center" }}>{t.authVerifyResent}</p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={changeEmailFromVerification}
              style={{ ...btn, background: "transparent", color: "#C4C2BA", border: "0.5px solid rgba(255,255,255,0.2)" }}
            >
              {t.authVerifyChangeEmail}
            </button>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>{t.authEmailOrUsernameLabel}</label>
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.authEmailOrUsernamePlaceholder}
              style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, fontSize: 14 }}
            />
            <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>{t.authPasswordLabel}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", marginBottom: 12, fontSize: 14 }}
            />
            <button type="button" disabled={busy} onClick={signInWithPassword} style={{ ...btn, background: "#F0997B", color: "#141413" }}>
              {t.authSignInPassword}
            </button>
            <button type="button" disabled={busy} onClick={signUpWithPassword} style={{ ...btn, background: "transparent", color: "#C4C2BA", border: "0.5px solid rgba(255,255,255,0.2)" }}>
              {t.authSignUpPassword}
            </button>
            <div style={{ textAlign: "right", marginBottom: 10 }}>
              <button
                type="button"
                disabled={busy}
                onClick={requestPasswordReset}
                style={{
                  background: "none",
                  border: "none",
                  color: "#888780",
                  fontSize: 12,
                  cursor: busy ? "wait" : "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                {t.authForgotPassword}
              </button>
            </div>
            {resetSent ? (
              <p style={{ fontSize: 12, color: "#97C459", margin: "0 0 10px", lineHeight: 1.5 }}>{t.authResetEmailSent}</p>
            ) : null}
            <div style={{ textAlign: "center", fontSize: 11, color: "#666663", margin: "4px 0 12px" }}>{t.authOr}</div>
            <button
              type="button"
              disabled={busy || hideGoogleAuth}
              onClick={signGoogle}
              title={hideGoogleAuth ? t.authLocalDevHint : undefined}
              style={{
                ...btn,
                background: hideGoogleAuth ? "#1c1c1b" : "#252523",
                color: hideGoogleAuth ? "#6b6b68" : "#F1EFE8",
                border: "0.5px solid rgba(255,255,255,0.12)",
                cursor: busy || hideGoogleAuth ? "not-allowed" : "pointer",
                opacity: hideGoogleAuth ? 0.72 : 1,
              }}
            >
              {t.authGoogle}
            </button>
            {hideGoogleAuth ? (
              <p style={{ fontSize: 11, color: "#888780", margin: "10px 0 0", lineHeight: 1.45 }}>{t.authLocalDevHint}</p>
            ) : null}
          </div>
        )}

        {err ? <p style={{ fontSize: 12, color: "#A32D2D", margin: "8px 0 0" }}>{err}</p> : null}
      </div>
    </div>
  );
}
