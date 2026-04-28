import { useState } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../config/supabaseClient.js";

/**
 * Shown after a user clicks the password-reset link from email and Supabase fires the
 * `PASSWORD_RECOVERY` event. The user already has a temporary session, so we just collect
 * a new password and call `updateUser`.
 */
export function ResetPasswordModal() {
  const { t } = useLang();
  const { recoveryActive, clearRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  if (!recoveryActive) return null;

  async function submit() {
    setErr("");
    if (!password) {
      setErr(t.authPasswordRequired);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setPassword("");
    } catch (e) {
      console.error(e);
      setErr(e.message || t.authErrorGeneric);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setPassword("");
    setErr("");
    setDone(false);
    clearRecovery();
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
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 410,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8" }}>{t.authResetTitle}</div>
          <button
            type="button"
            onClick={close}
            style={{ fontSize: 22, color: "#888780", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {done ? (
          <>
            <p style={{ fontSize: 13, color: "#97C459", margin: "0 0 16px", lineHeight: 1.5 }}>{t.authResetSuccess}</p>
            <button type="button" onClick={close} style={{ ...btn, background: "#F0997B", color: "#141413" }}>
              {t.authResetClose}
            </button>
          </>
        ) : (
          <>
            <label style={{ fontSize: 11, color: "#888780", display: "block", marginBottom: 6 }}>{t.authNewPasswordLabel}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", marginBottom: 12, fontSize: 14 }}
            />
            <button type="button" disabled={busy} onClick={submit} style={{ ...btn, background: "#F0997B", color: "#141413" }}>
              {t.authResetSubmit}
            </button>
          </>
        )}

        {err ? <p style={{ fontSize: 12, color: "#A32D2D", margin: "8px 0 0" }}>{err}</p> : null}
      </div>
    </div>
  );
}
