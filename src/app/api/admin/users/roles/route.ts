import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    let userId: string | null = null;
    let userEmail: string | null = null;

    if (token) {
      const { data: userData } = await client.auth.getUser(token);
      userId = userData.user?.id ?? null;
      userEmail = userData.user?.email?.toLowerCase() ?? null;
    } else {
      const { data: userData } = await client.auth.getUser();
      userId = userData.user?.id ?? null;
      userEmail = userData.user?.email?.toLowerCase() ?? null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // Check if requester has admin role
    let isAdmin = false;
    if (userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th" || userEmail === "admin@msu.ac.th") {
      isAdmin = true;
    } else {
      const { data: requesterRoles } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const roles = (requesterRoles ?? []).map((r) => String(r.role).toLowerCase().trim());
      isAdmin = roles.includes("admin") || roles.includes("developer");

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
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
    }

    const body = await request.json();
    const { target_user_id, roles: requestedRoles } = body;

    if (!target_user_id || !Array.isArray(requestedRoles)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Demo Admin Sandbox: simulate role update without modifying real database
    if (userEmail === "admin@msu.ac.th") {
      const demoRole = requestedRoles.includes("admin") ? "admin" : requestedRoles.includes("staff") ? "staff" : "user";
      return NextResponse.json({
        success: true,
        demoMode: true,
        user_id: target_user_id,
        role: demoRole,
        message: "จำลองการเปลี่ยนบทบาทสำเร็จ (โหมด Demo Admin - ข้อมูลจริงไม่ถูกเปลี่ยนแปลง)",
      });
    }

    // Service client bypassing RLS
    const adminClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : client;

    // Protect Primary Super Admin (68011211206@msu.ac.th)
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", target_user_id)
      .maybeSingle();

    const targetEmail = targetProfile?.email?.toLowerCase();
    if (targetEmail === "68011211206@msu.ac.th" || targetEmail === "69010518004@msu.ac.th") {
      return NextResponse.json(
        { error: "ไม่อนุญาตให้ปรับเปลี่ยนบทบาทของ Admin หลัก (Super Admin)" },
        { status: 403 }
      );
    }

    if (targetProfile?.email?.toLowerCase() === "staff@msu.ac.th") {
      return NextResponse.json(
        { error: "ไม่อนุญาตให้ปรับเปลี่ยนบทบาทของบัญชี staff@msu.ac.th (Central Staff)" },
        { status: 403 }
      );
    }

    if (targetProfile?.email?.toLowerCase() === "admin@msu.ac.th") {
      return NextResponse.json(
        { error: "ไม่อนุญาตให้ปรับเปลี่ยนบทบาทของบัญชี admin@msu.ac.th (Demo Admin)" },
        { status: 403 }
      );
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

    // 1. Synchronize user_roles table
    try {
      await adminClient.from("user_roles").delete().eq("user_id", target_user_id);
      if (effectiveRole !== "user") {
        await adminClient.from("user_roles").insert({
          user_id: target_user_id,
          role: effectiveRole,
          granted_by: userId,
        });
      }
    } catch {
      // Continue
    }

    // 2. Synchronize profiles table
    try {
      await adminClient
        .from("profiles")
        .update({
          user_type: effectiveRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target_user_id);
    } catch {
      // Continue
    }

    // 3. Synchronize Supabase Auth user_metadata
    if (serviceRoleKey) {
      try {
        await adminClient.auth.admin.updateUserById(target_user_id, {
          user_metadata: {
            user_type: effectiveRole,
            role: effectiveRole,
          },
        });
      } catch {
        // Continue
      }
    }

    // 4. Record audit log
    try {
      await adminClient.from("audit_logs").insert({
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
      user_id: target_user_id,
      role: effectiveRole,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update role" },
      { status: 500 }
    );
  }
}
