import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV && (!url || !anonKey)) {
  console.error(
    "[BITE] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to `.env` (see project README). Requests will fail until set."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: { persistSession: true, autoRefreshToken: true },
});
