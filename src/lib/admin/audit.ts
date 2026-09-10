import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function logAdminAudit(payload: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  before_data?: unknown;
  after_data?: unknown;
  reason?: string;
  metadata?: Record<string, unknown>;
  result?: string;
}) {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    await fetch("/api/admin/audit-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Safe non-blocking fallback
  }
}
