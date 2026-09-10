import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    const client = createServerClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    let userId: string | null = null;
    if (token) {
      const { data: userData } = await client.auth.getUser(token);
      userId = userData.user?.id ?? null;
    } else {
      const { data: userData } = await client.auth.getUser();
      userId = userData.user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // Verify admin role
    const { data: requesterRoles } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (requesterRoles ?? []).map((r) => String(r.role).toLowerCase().trim());
    let isAdmin = roles.includes("admin") || roles.includes("developer");

    if (!isAdmin) {
      const { data: requesterProfile } = await client
        .from("profiles")
        .select("user_type")
        .eq("id", userId)
        .maybeSingle();

      if (requesterProfile?.user_type === "admin") {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
    }

    const body = await request.json();
    const { target_user_id } = body;

    if (!target_user_id) {
      return NextResponse.json({ error: "Missing target_user_id" }, { status: 400 });
    }

    if (target_user_id === userId) {
      return NextResponse.json({ error: "Cannot delete your own admin account directly" }, { status: 400 });
    }

    // 1. Delete associated data
    try {
      await client.from("user_roles").delete().eq("user_id", target_user_id);
      await client.from("account_deletion_requests").delete().eq("user_id", target_user_id);
      await client.from("qr_tokens").delete().eq("user_id", target_user_id);
    } catch {
      // Ignore if some tables lack records
    }

    // 2. Delete or anonymize profile
    try {
      await client.from("profiles").delete().eq("id", target_user_id);
    } catch {
      await client.from("profiles").update({
        full_name: "[Deleted User]",
        user_type: "DELETED",
        phone: null,
        university_id: null,
        avatar_path: null,
      }).eq("id", target_user_id);
    }

    // 3. Delete from Supabase Auth if service role key available
    if (serviceRoleKey) {
      try {
        await client.auth.admin.deleteUser(target_user_id);
      } catch (authErr) {
        console.warn("auth.admin.deleteUser error:", authErr);
      }
    }

    // 4. Record audit log
    try {
      const traceId = crypto.randomUUID();
      await client.from("audit_logs").insert({
        event_id: `admin-delete-${traceId}`,
        trace_id: traceId,
        actor_type: "ADMIN",
        actor_id: userId,
        action: "DELETE_USER",
        entity_type: "user",
        entity_id: target_user_id,
        result: "SUCCESS",
      });
    } catch {
      // Ignore audit fail
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
