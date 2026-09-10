import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { identifier?: string; password?: string };
    const rawId = (body.identifier || "").trim().toLowerCase();
    const password = body.password || "";

    const isAdminAttempt = (rawId === "admin" || rawId === "admin@msu.ac.th") && password === "admin123";

    if (!isAdminAttempt) {
      return NextResponse.json({ error: "Invalid demo admin credentials" }, { status: 400 });
    }

    try {
      const configRes = await fetch(new URL("/api/admin/demo-accounts", request.url));
      if (configRes.ok) {
        const cfg = (await configRes.json()) as { adminEnabled?: boolean };
        if (cfg.adminEnabled === false) {
          return NextResponse.json({ error: "Demo admin account login disabled by administrator" }, { status: 403 });
        }
      }
    } catch {
      // continue
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !url) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
    }

    const adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const demoAdminEmail = "admin@msu.ac.th";

    // Check if demo admin user already exists
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = usersData.users.find((u) => u.email?.toLowerCase() === demoAdminEmail);

    let demoAdminUserId: string;

    if (!existingUser) {
      // Create demo admin user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: demoAdminEmail,
        password: "admin123",
        email_confirm: true,
        user_metadata: {
          full_name: "ผู้ดูแลระบบสาธิต (Demo Admin)",
          user_type: "admin",
          is_demo_admin: true,
        },
      });

      if (createError) throw createError;
      demoAdminUserId = newUser.user.id;

      // Upsert profile
      await adminClient.from("profiles").upsert({
        id: demoAdminUserId,
        email: demoAdminEmail,
        full_name: "ผู้ดูแลระบบสาธิต (Demo Admin)",
        user_type: "admin",
      });

      // Assign admin role
      await adminClient.from("user_roles").upsert({
        user_id: demoAdminUserId,
        role: "admin",
      });
    } else {
      demoAdminUserId = existingUser.id;

      // Ensure password is admin123
      await adminClient.auth.admin.updateUserById(demoAdminUserId, {
        password: "admin123",
        email_confirm: true,
      });

      // Ensure admin role exists
      const { data: roleRows } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", demoAdminUserId);

      const hasAdmin = (roleRows ?? []).some((r) => String(r.role).toLowerCase() === "admin");
      if (!hasAdmin) {
        await adminClient.from("user_roles").insert({
          user_id: demoAdminUserId,
          role: "admin",
        });
      }

      await adminClient.from("profiles").upsert({
        id: demoAdminUserId,
        email: demoAdminEmail,
        full_name: existingUser.user_metadata?.full_name || "ผู้ดูแลระบบสาธิต (Demo Admin)",
        user_type: "admin",
      });
    }

    return NextResponse.json({
      success: true,
      email: demoAdminEmail,
      userId: demoAdminUserId,
      message: "Demo admin account ready",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to initialize demo admin" },
      { status: 500 },
    );
  }
}
