/**
 * Browser CORS for Edge Functions invoked via `supabase.functions.invoke`.
 * The supabase-js client always sends `Authorization` + `apikey` + JSON body,
 * so the preflight needs both listed. Origin is `*` for now — locked down by
 * the JWT verification in the handler, not by origin allowlist.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
