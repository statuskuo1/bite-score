import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../config/supabaseClient.js";
import { accountUsesOauthOnly, fetchEmailForUsername, suggestAvailableUsernames, updateOwnProfile, validateUsername } from "../utils/profileApi.js";
import { listFollows } from "../utils/followsApi.js";
import { computeFoodStats, fetchRestaurantVisitsForUser } from "../utils/visitPlacesApi.js";
import { FoodStatsBlock } from "./FoodStatsBlock.jsx";

const redirectBase = () => window.location.origin.replace(/\/$/, "");

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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export function AuthModal({ open, onClose }) {
  const { t } = useLang();
  const { user, session, username, profile, refreshProfile } = useAuth();

  // Auth form state
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendOk, setResendOk] = useState(false);

  // Profile editor state
  const [usernameDraft, setUsernameDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const usernameInputRef = useRef(null);

  const [editMode, setEditMode] = useState(false);
  const [socialCounts, setSocialCounts] = useState({ followers: 0, following: 0, tasteBuds: 0 });
  const [foodStats, setFoodStats] = useState({ restaurants: 0, cuisines: 0, cities: 0, regions: 0 });

  // Derived display states
  const googleUsernameStep = !!(session && user && profile !== null && !profile?.username);
  const showProfileView = !!(session && user && profile?.username);

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

  useEffect(() => {
    if (!open || !user) return;
    setUsernameDraft(profile?.username ?? username ?? "");
    setDisplayNameDraft(profile?.display_name ?? "");
    setSaveError(null);
    setSaveOk(false);
    setSuggestions([]);
    setEditMode(false);
  }, [open, user?.id, profile?.username, profile?.display_name, username]);

  // Reset auth form when modal opens or mode switches
  useEffect(() => {
    if (!open) return;
    setErr("");
    setResetSent(false);
    setPassword("");
    setConfirmPassword("");
  }, [open, isCreateMode]);

  useEffect(() => {
    if (!saveOk) return;
    const id = setTimeout(() => setSaveOk(false), 1800);
    return () => clearTimeout(id);
  }, [saveOk]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

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

  const usernameInlineErr = (() => {
    if (saveError === "username_taken") return t.profileUsernameTaken;
    if (saveError === "invalid_username") return t.profileUsernameInvalid;
    if (usernameTrim.length > 0 && !usernameLooksValid) return t.profileUsernameInvalid;
    return null;
  })();

  // Google username step: username draft is always valid & non-empty
  const googleUsernameTrim = usernameDraft.trim();
  const googleUsernameValid = useMemo(
    () => validateUsername(googleUsernameTrim) === null && googleUsernameTrim.length > 0,
    [googleUsernameTrim]
  );

  if (!open) return null;

  function switchMode(createMode) {
    setIsCreateMode(createMode);
    setErr("");
    setResetSent(false);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  async function signGoogle() {
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${redirectBase()}/`,
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
    if (!trimmed) { setErr(t.authEmailRequired); return; }
    if (!password) { setErr(t.authPasswordRequired); return; }
    setBusy(true);
    try {
      const resolved = await resolveIdentifierToEmail(trimmed);
      if (!resolved) { setErr(t.authInvalidLogin); return; }
      const { error } = await supabase.auth.signInWithPassword({ email: resolved, password });
      if (error) throw error;
      setPassword("");
      onClose();
    } catch (e) {
      console.error(e);
      if (/invalid login credentials/i.test(e?.message || "")) {
        const oauthOnly = await accountUsesOauthOnly(supabase, trimmed);
        if (oauthOnly) { setErr(t.authUseGoogleInstead); return; }
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
    if (!trimmed) { setErr(t.authEmailRequired); return; }
    if (!trimmed.includes("@")) { setErr(t.authSignUpEmailRequired); return; }
    if (!password) { setErr(t.authPasswordRequired); return; }
    if (password !== confirmPassword) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: { emailRedirectTo: `${redirectBase()}/` },
      });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      if (data?.session) { onClose(); return; }
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
    if (!trimmed) { setErr(t.authEmailRequired); return; }
    setBusy(true);
    try {
      const resolved = await resolveIdentifierToEmail(trimmed);
      if (!resolved) { setErr(t.authInvalidLogin); return; }
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

  async function saveGoogleUsername() {
    if (!user || !googleUsernameValid) return;
    setErr("");
    setSaveError(null);
    setSaveBusy(true);
    try {
      const res = await updateOwnProfile(supabase, user.id, {
        username: googleUsernameTrim,
        displayName: profile?.display_name || "",
      });
      if (!res.ok) {
        if (res.code === "network") setErr(t.profileSavingErr);
        else setSaveError(res.code);
        if (res.code === "username_taken") {
          suggestAvailableUsernames(supabase, googleUsernameTrim)
            .then((list) => setSuggestions(list))
            .catch(() => setSuggestions([]));
        }
        return;
      }
      await refreshProfile();
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
      setConfirmPassword("");
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
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    marginBottom: 10,
    fontSize: 14,
  };
  const labelStyle = { fontSize: 11, color: "#888780", display: "block", marginBottom: 4 };

  function GoogleBtn({ label }) {
    return (
      <button
        type="button"
        disabled={busy || hideGoogleAuth}
        onClick={signGoogle}
        title={hideGoogleAuth ? t.authLocalDevHint : undefined}
        style={{
          ...btn,
          background: hideGoogleAuth ? "#2a2a28" : "#FFFFFF",
          color: hideGoogleAuth ? "#6b6b68" : "#141413",
          border: "none",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: busy || hideGoogleAuth ? "not-allowed" : "pointer",
          opacity: hideGoogleAuth ? 0.6 : 1,
        }}
      >
        {!hideGoogleAuth && <GoogleIcon />}
        {label || t.authGoogle}
      </button>
    );
  }

  function OrDivider() {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px" }}>
        <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.12)" }} />
        <span style={{ fontSize: 11, color: "#666663" }}>{t.authOr}</span>
        <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.12)" }} />
      </div>
    );
  }

  function BiteLogo() {
    return (
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 4 }}>🍽</div>
        <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, fontWeight: 600, color: "#F0997B", lineHeight: 1 }}>BITE Score</div>
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
        overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={panel}>

        {/* ── Close button ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: 22, color: "#888780", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}
          >×</button>
        </div>

        {/* ── Google username step (new OAuth users) ── */}
        {googleUsernameStep ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>👋</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8", marginBottom: 4 }}>Pick your username</div>
              <div style={{ fontSize: 13, color: "#888780", lineHeight: 1.5 }}>This is how others find and follow you.</div>
            </div>
            <label style={labelStyle}>{t.profileUsernameLabel}</label>
            <input
              ref={usernameInputRef}
              type="text"
              autoComplete="off"
              autoFocus
              value={usernameDraft}
              onChange={(e) => { setUsernameDraft(e.target.value.toLowerCase()); setSaveError(null); setSuggestions([]); }}
              maxLength={30}
              placeholder="yourhandle"
              style={{
                ...inputStyle,
                borderColor: (usernameInlineErr || saveError === "username_taken") ? "#A32D2D" : undefined,
              }}
            />
            <div style={{ fontSize: 10, color: (usernameInlineErr || saveError === "username_taken") ? "#A32D2D" : "#666663", marginBottom: 10, lineHeight: 1.4 }}>
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
            <button
              type="button"
              disabled={saveBusy || !googleUsernameValid}
              onClick={saveGoogleUsername}
              style={{
                ...btn, marginBottom: 0,
                background: googleUsernameValid ? "#F0997B" : "#5A4A43",
                color: googleUsernameValid ? "#141413" : "#AFA8A3",
                cursor: saveBusy ? "wait" : (googleUsernameValid ? "pointer" : "not-allowed"),
                opacity: googleUsernameValid ? 1 : 0.85,
              }}
            >
              {saveBusy ? "…" : "Continue"}
            </button>
          </div>

        ) : showProfileView ? (
          /* ── Profile view ── */
          <div>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "0.5px solid rgba(255,255,255,0.12)", marginBottom: 8 }}
                />
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "#3C1F13", color: "#F0997B",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 600, lineHeight: 1, marginBottom: 8,
                }}>
                  {((profile?.display_name || usernameTrim || username || user?.email || "?")).charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 600, color: "#F1EFE8", lineHeight: 1.2 }}>
                {profile?.display_name || username || user?.email?.split("@")[0] || "—"}
              </div>
              <div style={{ fontSize: 13, color: "#C4C2BA", marginTop: 3 }}>@{username || "—"}</div>
            </div>

            {!editMode ? (
              <>
                <div style={{ textAlign: "center", fontSize: 13, color: "#C4C2BA", marginBottom: 14 }}>
                  <span>{socialCounts.followers} followers</span>
                  <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
                  <span>{socialCounts.following} following</span>
                  <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
                  <span>{socialCounts.tasteBuds} taste buds</span>
                </div>
                <FoodStatsBlock stats={foodStats} style={{ marginBottom: 14 }} />
                {saveOk && (
                  <p style={{ fontSize: 12, color: "#97C459", margin: "0 0 8px", textAlign: "center" }}>{t.profileSaved}</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setEditMode(true)}
                    style={{ ...btn, flex: 1, marginBottom: 0, background: "#3C1F13", color: "#F0997B", border: "none" }}>
                    Edit profile
                  </button>
                  <button type="button" disabled={busy} onClick={signOut}
                    style={{ ...btn, flex: 1, marginBottom: 0, background: "transparent", color: "#C4C2BA", border: "0.5px solid rgba(255,255,255,0.2)" }}>
                    {t.signOut}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: "#141413", borderRadius: 10, padding: "12px", marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#C4C2BA", display: "block", marginBottom: 4 }}>{t.profileUsernameLabel}</label>
                  <input
                    ref={usernameInputRef}
                    type="text"
                    autoComplete="off"
                    value={usernameDraft}
                    onChange={(e) => { setUsernameDraft(e.target.value.toLowerCase()); setSaveError(null); setSaveOk(false); setSuggestions([]); }}
                    maxLength={30}
                    style={{ width: "100%", boxSizing: "border-box", marginBottom: 3, fontSize: 13, padding: "6px 10px", borderColor: usernameInlineErr ? "#A32D2D" : undefined }}
                  />
                  <div style={{ fontSize: 10, color: usernameInlineErr ? "#A32D2D" : "#666663", marginBottom: saveError === "username_taken" && suggestions.length > 0 ? 5 : 10, lineHeight: 1.4 }}>
                    {usernameInlineErr || t.profileUsernameHelp}
                  </div>
                  {saveError === "username_taken" && suggestions.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: "#888780" }}>{t.profileUsernameSuggest}</span>
                      {suggestions.map((s) => (
                        <button key={s} type="button"
                          onClick={() => { setUsernameDraft(s); setSaveError(null); setSuggestions([]); usernameInputRef.current?.focus(); }}
                          style={{ padding: "3px 8px", borderRadius: 14, fontSize: 11, background: "#3C1F13", color: "#F0997B", border: "1px solid rgba(240,153,123,0.4)", cursor: "pointer" }}>
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
                  <div style={{ fontSize: 13, color: "#F1EFE8", wordBreak: "break-all" }}>{user?.email || "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button"
                    onClick={() => { setEditMode(false); setSaveError(null); setSuggestions([]); setUsernameDraft(profile?.username ?? username ?? ""); setDisplayNameDraft(profile?.display_name ?? ""); }}
                    style={{ ...btn, flex: 1, marginBottom: 0, background: "transparent", color: "#C4C2BA", border: "0.5px solid rgba(255,255,255,0.2)" }}>
                    Cancel
                  </button>
                  <button type="button" disabled={busy || saveBusy || !canSave} onClick={saveProfile}
                    style={{ ...btn, flex: 1, marginBottom: 0, background: canSave ? "#F0997B" : "#5A4A43", color: canSave ? "#141413" : "#AFA8A3", cursor: (busy || saveBusy) ? "wait" : (canSave ? "pointer" : "not-allowed"), opacity: canSave ? 1 : 0.85 }}>
                    {saveBusy ? "…" : t.profileSave}
                  </button>
                </div>
              </>
            )}
          </div>

        ) : pendingVerificationEmail ? (
          /* ── Verification pending ── */
          <div>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📬</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8", marginBottom: 8 }}>{t.authVerifySentTitle}</div>
            </div>
            <p style={{ fontSize: 13, color: "#C4C2BA", margin: "0 0 16px", lineHeight: 1.55 }}>
              {t.authVerifySentBody.replace("{email}", pendingVerificationEmail)}
            </p>
            <button
              type="button"
              disabled={busy || resendCooldown > 0}
              onClick={resendVerification}
              style={{ ...btn, background: resendCooldown > 0 ? "#5A4A43" : "#F0997B", color: resendCooldown > 0 ? "#AFA8A3" : "#141413", cursor: busy ? "wait" : (resendCooldown > 0 ? "not-allowed" : "pointer"), opacity: resendCooldown > 0 ? 0.85 : 1 }}
            >
              {resendCooldown > 0 ? t.authVerifyResendCooldown.replace("{sec}", String(resendCooldown)) : t.authVerifyResend}
            </button>
            {resendOk && <p style={{ fontSize: 12, color: "#97C459", margin: "0 0 10px", textAlign: "center" }}>{t.authVerifyResent}</p>}
            <button type="button" disabled={busy} onClick={changeEmailFromVerification}
              style={{ ...btn, background: "transparent", color: "#C4C2BA", border: "0.5px solid rgba(255,255,255,0.2)" }}>
              {t.authVerifyChangeEmail}
            </button>
          </div>

        ) : isCreateMode ? (
          /* ── Create account ── */
          <div>
            <BiteLogo />
            <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8", textAlign: "center", marginBottom: 16 }}>Create your account</div>
            <GoogleBtn label="Sign up with Google" />
            <OrDivider />
            <label style={labelStyle}>{t.profileUsernameLabel}</label>
            <input
              type="text"
              autoComplete="username"
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value.toLowerCase())}
              placeholder="yourhandle"
              maxLength={30}
              style={inputStyle}
            />
            <div style={{ fontSize: 10, color: "#666663", marginTop: -6, marginBottom: 10, lineHeight: 1.4 }}>
              {t.profileUsernameHelp}
            </div>
            <label style={labelStyle}>{t.authEmailLabel}</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
            <label style={labelStyle}>{t.authPasswordLabel}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <label style={labelStyle}>Confirm password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signUpWithPassword()}
              style={{ ...inputStyle, marginBottom: 14 }}
            />
            <button type="button" disabled={busy} onClick={signUpWithPassword}
              style={{ ...btn, background: "#F0997B", color: "#141413" }}>
              {busy ? "…" : t.authSignUpPassword}
            </button>
            <div style={{ textAlign: "center", marginTop: 2 }}>
              <span style={{ fontSize: 13, color: "#888780" }}>Already have an account? </span>
              <button type="button" onClick={() => switchMode(false)}
                style={{ fontSize: 13, color: "#F0997B", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>
                Sign in
              </button>
            </div>
          </div>

        ) : (
          /* ── Sign in (default) ── */
          <div>
            <BiteLogo />
            <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8", textAlign: "center", marginBottom: 16 }}>Sign in to BITE</div>
            <GoogleBtn />
            <OrDivider />
            <label style={labelStyle}>{t.authEmailOrUsernameLabel}</label>
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.authEmailOrUsernamePlaceholder}
              style={inputStyle}
            />
            <label style={labelStyle}>{t.authPasswordLabel}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signInWithPassword()}
              style={{ ...inputStyle, marginBottom: 14 }}
            />
            <button type="button" disabled={busy} onClick={signInWithPassword}
              style={{ ...btn, background: "#F0997B", color: "#141413" }}>
              {busy ? "…" : t.authSignInPassword}
            </button>
            <div style={{ textAlign: "center", marginTop: 2 }}>
              <span style={{ fontSize: 13, color: "#888780" }}>Don't have an account? </span>
              <button type="button" onClick={() => switchMode(true)}
                style={{ fontSize: 13, color: "#F0997B", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>
                Create one
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button type="button" disabled={busy} onClick={requestPasswordReset}
                style={{ fontSize: 12, color: "#5B9BD5", background: "none", border: "none", cursor: busy ? "wait" : "pointer", padding: 0 }}>
                {t.authForgotPassword}
              </button>
            </div>
            {resetSent && (
              <p style={{ fontSize: 12, color: "#97C459", margin: "8px 0 0", textAlign: "center", lineHeight: 1.5 }}>{t.authResetEmailSent}</p>
            )}
          </div>
        )}

        {err && <p style={{ fontSize: 12, color: "#A32D2D", margin: "10px 0 0" }}>{err}</p>}
        {hideGoogleAuth && !showProfileView && !googleUsernameStep && (
          <p style={{ fontSize: 11, color: "#666663", margin: "8px 0 0", lineHeight: 1.45 }}>{t.authLocalDevHint}</p>
        )}
      </div>
    </div>
  );
}
