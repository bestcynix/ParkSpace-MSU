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

    // Demo Admin Sandbox: simulate password change without modifying real data
    if (callerEmail === "admin@msu.ac.th") {
      return NextResponse.json({
        success: true,
        demoMode: true,
        message: "จำลองการจัดการรหัสผ่านสำเร็จ (โหมด Demo Admin - ข้อมูลจริงไม่ถูกเปลี่ยนแปลง)",
      });
    }

    const body = await request.json();
    const { target_user_id, action, password, email } = body;

    if (!target_user_id) {
      return NextResponse.json({ error: "Missing target_user_id" }, { status: 400 });
    }

    // Check if target is a protected account
    const { data: targetProfile } = await client
      .from("profiles")
      .select("email")
      .eq("id", target_user_id)
      .maybeSingle();

    const targetEmail = targetProfile?.email?.toLowerCase();
    if (targetEmail === "68011211206@msu.ac.th" || targetEmail === "69010518004@msu.ac.th") {
      return NextResponse.json(
        { error: "ไม่อนุญาตให้เปลี่ยนรหัสผ่านของ Admin หลัก (Super Admin)" },
        { status: 403 }
      );
    }
    if (targetEmail === "staff@msu.ac.th") {
      return NextResponse.json(
        { error: "ไม่อนุญาตให้เปลี่ยนรหัสผ่านของ staff@msu.ac.th (รหัสผ่านคงที่คือ staff123)" },
        { status: 403 }
      );
    }
    if (targetEmail === "admin@msu.ac.th") {
      return NextResponse.json(
        { error: "ไม่อนุญาตให้เปลี่ยนรหัสผ่านของ admin@msu.ac.th (รหัสผ่านคงที่คือ admin123)" },
        { status: 403 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    // Action 1: Directly set user password by Admin
    if (action === "set_password") {
      if (!password || typeof password !== "string" || password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters long" },
          { status: 400 }
        );
      }

      if (!serviceRoleKey) {
        return NextResponse.json(
          { error: "Service role key required to update credentials directly" },
          { status: 500 }
        );
      }

      const { data: updatedUser, error: updateErr } = await client.auth.admin.updateUserById(
        target_user_id,
        {
          password,
          user_metadata: {
            parkspace_google_password_setup_completed_at: new Date().toISOString(),
          },
        }
      );

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      // Record audit log
      try {
        const traceId = crypto.randomUUID();
        await client.from("audit_logs").insert({
          event_id: `admin-pw-${traceId}`,
          trace_id: traceId,
          actor_type: "ADMIN",
          actor_id: userId,
          action: "ADMIN_RESET_PASSWORD",
          entity_type: "user",
          entity_id: target_user_id,
          result: "SUCCESS",
        });
      } catch {
        // Safe fallback
      }

      return NextResponse.json({
        success: true,
        message: "Password changed successfully for user",
        user_id: updatedUser.user.id,
      });
    }

    // Action 2: Send password reset email
    if (action === "send_reset_email") {
      let targetEmail = email;
      if (!targetEmail) {
        const { data: profile } = await client
          .from("profiles")
          .select("email")
          .eq("id", target_user_id)
          .maybeSingle();
        targetEmail = profile?.email;
      }

      if (!targetEmail) {
        return NextResponse.json({ error: "User email not found" }, { status: 400 });
      }

      const { error: resetErr } = await client.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${siteUrl}/th/reset-password`,
      });

      if (resetErr) {
        return NextResponse.json({ error: resetErr.message }, { status: 400 });
      }

      // Record audit log
      try {
        const traceId = crypto.randomUUID();
        await client.from("audit_logs").insert({
          event_id: `admin-pw-email-${traceId}`,
          trace_id: traceId,
          actor_type: "ADMIN",
          actor_id: userId,
          action: "ADMIN_SEND_RESET_EMAIL",
          entity_type: "user",
          entity_id: target_user_id,
          metadata: { email: targetEmail },
          result: "SUCCESS",
        });
      } catch {
        // Safe fallback
      }

      return NextResponse.json({
        success: true,
        message: `Password reset email dispatched to ${targetEmail}`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to manage password" },
      { status: 500 }
    );
  }
}
