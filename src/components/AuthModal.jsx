import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../config/supabaseClient.js";

const redirectBase = () =>
  (import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin).replace(/\/$/, "");

export function AuthModal({ open, onClose }) {
  const { t } = useLang();
  const { user, session, displayName } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  async function sendMagicLink() {
    setErr("");
    const trimmed = email.trim();
    if (!trimmed) {
      setErr(t.authEmailRequired);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: `${redirectBase()}/` },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      console.error(e);
      setErr(e.message || t.authErrorGeneric);
    } finally {
      setBusy(false);
    }
  }

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

  async function signOut() {
    setBusy(true);
    setErr("");
    try {
      await supabase.auth.signOut();
      setSent(false);
      setEmail("");
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
              <span style={{ color: "#F0997B", fontWeight: 600 }}>{displayName || user.email?.split("@")[0] || user.id}</span>
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
            {sent ? (
              <p style={{ fontSize: 14, color: "#97C459", margin: "0 0 12px", lineHeight: 1.6 }}>{t.authCheckEmail}</p>
            ) : (
              <>
                <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>{t.authEmailLabel}</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ width: "100%", boxSizing: "border-box", marginBottom: 12, fontSize: 14 }}
                />
                <button type="button" disabled={busy} onClick={sendMagicLink} style={{ ...btn, background: "#F0997B", color: "#141413" }}>
                  {t.authSendLink}
                </button>
                <div style={{ textAlign: "center", fontSize: 11, color: "#666663", margin: "4px 0 12px" }}>{t.authOr}</div>
                <button type="button" disabled={busy} onClick={signGoogle} style={{ ...btn, background: "#252523", color: "#F1EFE8", border: "0.5px solid rgba(255,255,255,0.2)" }}>
                  {t.authGoogle}
                </button>
              </>
            )}
          </div>
        )}

        {err ? <p style={{ fontSize: 12, color: "#A32D2D", margin: "8px 0 0" }}>{err}</p> : null}
      </div>
    </div>
  );
}
