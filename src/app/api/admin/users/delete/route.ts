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
    let callerEmail: string | null = null;
    if (token) {
      const { data: userData } = await client.auth.getUser(token);
      userId = userData.user?.id ?? null;
      callerEmail = userData.user?.email?.toLowerCase() ?? null;
    } else {
      const { data: userData } = await client.auth.getUser();
      userId = userData.user?.id ?? null;
      callerEmail = userData.user?.email?.toLowerCase() ?? null;
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
    let isAdmin = roles.includes("admin") || roles.includes("developer") ||
      callerEmail === "68011211206@msu.ac.th" || callerEmail === "69010518004@msu.ac.th" || callerEmail === "admin@msu.ac.th";

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

    // Demo Admin Sandbox: simulate deletion without modifying real data
    if (callerEmail === "admin@msu.ac.th") {
      return NextResponse.json({
        success: true,
        demoMode: true,
        message: "จำลองการลบผู้ใช้สำเร็จ (โหมด Demo Admin - ข้อมูลจริงไม่ถูกเปลี่ยนแปลง)",
      });
    }

    const body = await request.json();
    const { target_user_id } = body;

    if (!target_user_id) {
      return NextResponse.json({ error: "Missing target_user_id" }, { status: 400 });
    }

    if (target_user_id === userId) {
      return NextResponse.json({ error: "Cannot delete your own admin account directly" }, { status: 400 });
    }

    // Protect Primary Super Admin (68011211206@msu.ac.th)
    const { data: targetProfile } = await client
      .from("profiles")
      .select("email")
      .eq("id", target_user_id)
      .maybeSingle();

    const targetEmail = targetProfile?.email?.toLowerCase();
    if (targetEmail === "68011211206@msu.ac.th" || targetEmail === "69010518004@msu.ac.th") {
      return NextResponse.json(
        { error: "บัญชีผู้ดูแลระบบหลัก (Super Admin) ได้รับการคุ้มครองถาวร ไม่สามารถลบได้" },
        { status: 403 }
      );
    }

    if (targetProfile?.email?.toLowerCase() === "staff@msu.ac.th") {
      return NextResponse.json(
        { error: "บัญชี staff@msu.ac.th เป็นบัญชีเจ้าหน้าที่ส่วนกลาง ไม่สามารถลบได้ (Central staff account is protected)" },
        { status: 403 }
      );
    }

    if (targetProfile?.email?.toLowerCase() === "admin@msu.ac.th") {
      return NextResponse.json(
        { error: "บัญชี admin@msu.ac.th เป็นบัญชีผู้ดูแลระบบสาธิต ไม่สามารถลบได้ (Demo admin account is protected)" },
        { status: 403 }
      );
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
