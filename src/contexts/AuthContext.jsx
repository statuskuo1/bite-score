import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../config/supabaseClient.js";
import { ensureProfile, fetchProfileById } from "../utils/profileApi.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [recoveryActive, setRecoveryActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!cancelled) setSession(s);
      })
      .catch((err) => {
        console.error("[BITE] auth getSession failed — check VITE_SUPABASE_URL / anon key:", err);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecoveryActive(true);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const clearRecovery = () => setRecoveryActive(false);

  useEffect(() => {
    const u = session?.user;
    if (!u?.id) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      await ensureProfile(supabase, u);
      const p = await fetchProfileById(supabase, u.id);
      if (!cancelled) setProfile(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      authReady,
      profile,
      displayName:
        (profile?.display_name && String(profile.display_name).trim()) ||
        session?.user?.email?.split("@")[0] ||
        "",
      recoveryActive,
      clearRecovery,
    }),
    [session, authReady, profile, recoveryActive]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
