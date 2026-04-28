import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../config/supabaseClient.js";
import { suggestAvailableUsernames, updateOwnProfile, validateUsername } from "../utils/profileApi.js";

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

  /** Seed drafts from the live profile every time the modal opens or the profile changes. */
  useEffect(() => {
    if (!open || !user) return;
    setUsernameDraft(profile?.username ?? username ?? "");
    setDisplayNameDraft(profile?.display_name ?? "");
    setSaveError(null);
    setSaveOk(false);
    setSuggestions([]);
  }, [open, user?.id, profile?.username, profile?.display_name, username]);

  /** Auto-clear the "Saved" indicator after a short window. */
  useEffect(() => {
    if (!saveOk) return;
    const id = setTimeout(() => setSaveOk(false), 1800);
    return () => clearTimeout(id);
  }, [saveOk]);

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
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) throw error;
      setPassword("");
      onClose();
    } catch (e) {
      console.error(e);
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
    if (!password) {
      setErr(t.authPasswordRequired);
      return;
    }
    setBusy(true);
    try {
      /** `emailRedirectTo` is a no-op when project disables confirmations (default), but kept for projects that turn it on. */
      const { error } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: { emailRedirectTo: `${redirectBase()}/` },
      });
      if (error) throw error;
      setPassword("");
      onClose();
    } catch (e) {
      console.error(e);
      setErr(formatPasswordSignUpError(e, t));
    } finally {
      setBusy(false);
    }
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
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8" }}>{session ? t.profileTitle : t.authTitle}</div>
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
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{
                    width: 48, height: 48, borderRadius: "50%",
                    objectFit: "cover", flexShrink: 0,
                    border: "0.5px solid rgba(255,255,255,0.12)",
                  }}
                />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                  background: "#3C1F13", color: "#F0997B",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 600, lineHeight: 1,
                }}>
                  {(usernameTrim || username || user.email || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#F1EFE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {username || user.email?.split("@")[0] || user.id}
                </div>
                {user.email && (
                  <div style={{ fontSize: 11, color: "#888780", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>
                )}
              </div>
            </div>

            <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>{t.profileUsernameLabel}</label>
            <input
              ref={usernameInputRef}
              type="text"
              autoComplete="off"
              value={usernameDraft}
              onChange={(e) => { setUsernameDraft(e.target.value.toLowerCase()); setSaveError(null); setSaveOk(false); setSuggestions([]); }}
              maxLength={30}
              style={{
                width: "100%", boxSizing: "border-box", marginBottom: 4, fontSize: 14,
                borderColor: usernameInlineErr ? "#A32D2D" : undefined,
              }}
            />
            <div style={{ fontSize: 11, color: usernameInlineErr ? "#A32D2D" : "#666663", marginBottom: saveError === "username_taken" && suggestions.length > 0 ? 6 : 12, lineHeight: 1.4 }}>
              {usernameInlineErr || t.profileUsernameHelp}
            </div>
            {saveError === "username_taken" && suggestions.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#888780" }}>{t.profileUsernameSuggest}</span>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setUsernameDraft(s);
                      setSaveError(null);
                      setSuggestions([]);
                      usernameInputRef.current?.focus();
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      fontSize: 12,
                      background: "#3C1F13",
                      color: "#F0997B",
                      border: "1px solid rgba(240,153,123,0.4)",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>{t.profileDisplayNameLabel}</label>
            <input
              type="text"
              autoComplete="off"
              value={displayNameDraft}
              onChange={(e) => { setDisplayNameDraft(e.target.value); setSaveOk(false); }}
              maxLength={120}
              style={{ width: "100%", boxSizing: "border-box", marginBottom: 4, fontSize: 14 }}
            />
            <div style={{ fontSize: 11, color: "#666663", marginBottom: 14, lineHeight: 1.4 }}>{t.profileDisplayNameHelp}</div>

            <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>{t.profileEmailLabel}</label>
            <div style={{ fontSize: 13, color: "#C4C2BA", marginBottom: 16, wordBreak: "break-all" }}>
              {user.email || "—"}
            </div>

            <button
              type="button"
              disabled={busy || saveBusy || !canSave}
              onClick={saveProfile}
              style={{
                ...btn,
                background: canSave ? "#F0997B" : "#5A4A43",
                color: canSave ? "#141413" : "#AFA8A3",
                cursor: (busy || saveBusy) ? "wait" : (canSave ? "pointer" : "not-allowed"),
                opacity: canSave ? 1 : 0.85,
              }}
            >
              {saveBusy ? "…" : t.profileSave}
            </button>
            {saveOk && (
              <p style={{ fontSize: 12, color: "#97C459", margin: "0 0 10px", textAlign: "center" }}>{t.profileSaved}</p>
            )}
            <button type="button" disabled={busy || saveBusy} onClick={signOut} style={{ ...btn, background: "transparent", color: "#A32D2D", border: "0.5px solid #A32D2D" }}>
              {t.signOut}
            </button>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>{t.authEmailLabel}</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
