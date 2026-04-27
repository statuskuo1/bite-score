import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../config/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
    if (error) {
      console.error("profiles load:", error);
      setProfile({ is_admin: false });
      return;
    }
    setProfile(data ?? { is_admin: false });
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s);
      setAuthReady(true);
      if (s?.user) loadProfile(s.user.id);
      else setProfile(null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAdmin: profile?.is_admin === true,
      authReady,
      refreshProfile: () => session?.user && loadProfile(session.user.id),
    }),
    [session, profile, authReady, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
