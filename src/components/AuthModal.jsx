import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../config/supabaseClient.js";

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
  const { user, session, username } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resetSent, setResetSent] = useState(false);

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
          <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8" }}>{session ? t.authSignedIn : t.authTitle}</div>
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
            <p style={{ fontSize: 13, color: "#888780", margin: "0 0 16px", lineHeight: 1.5 }}>
              {t.authSignedInAs}{" "}
              <span style={{ color: "#F0997B", fontWeight: 600 }}>{username || user.email?.split("@")[0] || user.id}</span>
              {user.email && (
                <span style={{ display: "block", fontSize: 11, color: "#888780", marginTop: 8, wordBreak: "break-all" }}>{user.email}</span>
              )}
            </p>
            <button type="button" disabled={busy} onClick={signOut} style={{ ...btn, background: "transparent", color: "#A32D2D", border: "0.5px solid #A32D2D" }}>
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
