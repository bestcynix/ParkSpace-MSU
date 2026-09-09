import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The app is deployed with Next.js static export, so all Supabase work runs in
// the browser. Use Supabase's browser storage for the PKCE verifier/session;
// cookie-based SSR storage cannot be exchanged by a static callback page.
let browserClient: SupabaseClient | undefined;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  browserClient = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true,
    },
  });
  return browserClient;
}
