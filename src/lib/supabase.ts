import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazily constructed so importing this module never runs createClient() --
// that would execute during Next's build-time prerender of client pages too,
// and throw if env vars aren't visible at build time. Every call site only
// uses this inside useEffect/handlers (browser-only), so lazy init is safe.
let client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const realClient = getSupabaseClient();
    return Reflect.get(realClient, prop, realClient);
  },
});
