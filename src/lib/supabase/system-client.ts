import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getSystemDatabaseClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL or Publishable key not configured");
  }

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: "Bearer " + cachedToken } },
    });
  }

  if (serviceKey) {
    try {
      const adminClient = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const linkRes = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: "68011211206@msu.ac.th",
      });

      const hashedToken = linkRes.data?.properties?.hashed_token;
      if (hashedToken) {
        const verifyClient = createClient(url, anonKey);
        const { data: sessionData } = await verifyClient.auth.verifyOtp({
          token_hash: hashedToken,
          type: "magiclink",
        });

        if (sessionData.session?.access_token) {
          cachedToken = sessionData.session.access_token;
          tokenExpiresAt = Date.now() + (sessionData.session.expires_in || 3600) * 1000 - 60000;

          return createClient(url, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { headers: { Authorization: "Bearer " + cachedToken } },
          });
        }
      }

      return adminClient;
    } catch {
      // fallback
    }
  }

  return createClient(url, anonKey);
}
