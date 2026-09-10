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

    // Check if requester has admin role
    const { data: requesterRoles } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (requesterRoles ?? []).map((r) => String(r.role).toLowerCase().trim());
    let isAdmin = roles.includes("admin") || roles.includes("developer");

    if (!isAdmin) {
      // Fallback check on profiles.user_type
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
    const { target_user_id, roles: requestedRoles } = body;

    if (!target_user_id || !Array.isArray(requestedRoles)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Filter to valid roles: admin, staff, user
    const validRoles = requestedRoles
      .map((r: string) => String(r).toLowerCase().trim())
      .filter((r: string) => ["admin", "staff", "user"].includes(r));

    const effectiveRole = validRoles.includes("admin")
      ? "admin"
      : validRoles.includes("staff")
      ? "staff"
      : "user";

    // 1. Synchronize user_roles table if accessible
    try {
      await client.from("user_roles").delete().eq("user_id", target_user_id);
      if (effectiveRole !== "user") {
        await client.from("user_roles").insert({
          user_id: target_user_id,
          role: effectiveRole,
          granted_by: userId,
        });
      }
    } catch {
      // Continue to profile update even if user_roles table lacks direct permission
    }

    // 2. Synchronize profiles table
    try {
      await client
        .from("profiles")
        .update({
          user_type: effectiveRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target_user_id);
    } catch {
      // Ignore
    }

    // 3. Record audit log
    try {
      await client.from("audit_logs").insert({
        event_id: `role_change_${Date.now()}`,
        trace_id: `tr_${Date.now().toString(36)}`,
        actor_type: "ADMIN",
        actor_id: userId,
        action: "UPDATE_USER_ROLE",
        entity_type: "user_roles",
        entity_id: target_user_id,
        metadata: { new_role: effectiveRole, requested_roles: requestedRoles },
        result: "SUCCESS",
      });
    } catch {
      // Safe fallback
    }

    return NextResponse.json({
      success: true,
      roles: effectiveRole === "user" ? ["user"] : [effectiveRole],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
