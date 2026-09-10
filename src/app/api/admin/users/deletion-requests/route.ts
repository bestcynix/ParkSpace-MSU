import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
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
      const { data } = await client.auth.getUser(token);
      userId = data.user?.id ?? null;
    } else {
      const { data } = await client.auth.getUser();
      userId = data.user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // Try to query account_deletion_requests
    const { data: requests, error } = await client
      .from("account_deletion_requests")
      .select("*, profiles:user_id(id, email, full_name, user_type)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ requests: [] });
    }

    return NextResponse.json({ requests: requests ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load requests" },
      { status: 500 }
    );
  }
}

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
      const { data } = await client.auth.getUser(token);
      userId = data.user?.id ?? null;
    } else {
      const { data } = await client.auth.getUser();
      userId = data.user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json();
    const { action, request_id, user_id: targetUserId, reason } = body;

    // User requesting account deletion
    if (action === "request") {
      const { error } = await client
        .from("account_deletion_requests")
        .upsert(
          {
            user_id: userId,
            reason: reason || "USER_REQUEST",
            status: "PENDING",
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        // Safe fallback: mark user profile metadata
        await client
          .from("profiles")
          .update({ deletion_requested: true, updated_at: new Date().toISOString() })
          .eq("id", userId);
      }

      return NextResponse.json({ success: true, status: "PENDING" });
    }

    // User cancelling account deletion
    if (action === "cancel") {
      await client
        .from("account_deletion_requests")
        .delete()
        .eq("user_id", userId);

      await client
        .from("profiles")
        .update({ deletion_requested: false, updated_at: new Date().toISOString() })
        .eq("id", userId);

      return NextResponse.json({ success: true, status: "CANCELLED" });
    }

    // Admin operations: check Admin permission
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
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    if (action === "approve") {
      const uid = targetUserId || request_id;

      // Protect Primary Super Admin (68011211206@msu.ac.th)
      const { data: targetProfile } = await client
        .from("profiles")
        .select("email")
        .eq("id", uid)
        .maybeSingle();

      if (targetProfile?.email?.toLowerCase() === "68011211206@msu.ac.th") {
        return NextResponse.json({ error: "ไม่อนุญาตให้ลบบัญชี Admin หลัก (68011211206@msu.ac.th)" }, { status: 403 });
      }

      // Mark deletion request as APPROVED
      await client
        .from("account_deletion_requests")
        .update({ status: "APPROVED", resolved_at: new Date().toISOString(), resolved_by: userId })
        .eq("user_id", uid);

      // Clean or anonymize profile
      await client
        .from("profiles")
        .update({
          full_name: "[Deleted Account]",
          phone: null,
          university_id: null,
          faculty: null,
          major: null,
          department: null,
          user_type: "DELETED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", uid);

      // Remove roles
      await client.from("user_roles").delete().eq("user_id", uid);

      return NextResponse.json({ success: true, status: "APPROVED" });
    }

    if (action === "reject") {
      const uid = targetUserId || request_id;
      await client
        .from("account_deletion_requests")
        .update({ status: "REJECTED", resolved_at: new Date().toISOString(), resolved_by: userId })
        .eq("user_id", uid);

      await client
        .from("profiles")
        .update({ deletion_requested: false, updated_at: new Date().toISOString() })
        .eq("id", uid);

      return NextResponse.json({ success: true, status: "REJECTED" });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
