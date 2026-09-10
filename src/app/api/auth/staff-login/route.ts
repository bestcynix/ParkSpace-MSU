import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { identifier?: string; password?: string };
    const rawId = (body.identifier || "").trim().toLowerCase();
    const password = body.password || "";

    const isStaffAttempt = (rawId === "staff" || rawId === "staff@msu.ac.th") && password === "staff123";

    if (!isStaffAttempt) {
      return NextResponse.json({ error: "Invalid staff credentials" }, { status: 400 });
    }

    try {
      const configRes = await fetch(new URL("/api/admin/demo-accounts", request.url));
      if (configRes.ok) {
        const cfg = (await configRes.json()) as { staffEnabled?: boolean };
        if (cfg.staffEnabled === false) {
          return NextResponse.json({ error: "Staff account login disabled by administrator" }, { status: 403 });
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

    const staffEmail = "staff@msu.ac.th";

    // Check if staff user already exists
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = usersData.users.find((u) => u.email?.toLowerCase() === staffEmail);

    let staffUserId: string;

    if (!existingUser) {
      // Create central staff user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: staffEmail,
        password: "staff123",
        email_confirm: true,
        user_metadata: {
          full_name: "Staff กลาง (เจ้าหน้าที่ส่วนกลาง)",
          user_type: "staff",
        },
      });

      if (createError) throw createError;
      staffUserId = newUser.user.id;

      // Upsert profile
      await adminClient.from("profiles").upsert({
        id: staffUserId,
        email: staffEmail,
        full_name: "Staff กลาง (เจ้าหน้าที่ส่วนกลาง)",
        user_type: "staff",
      });

      // Assign staff role
      await adminClient.from("user_roles").upsert({
        user_id: staffUserId,
        role: "staff",
      });
    } else {
      staffUserId = existingUser.id;

      // Ensure password is staff123
      await adminClient.auth.admin.updateUserById(staffUserId, {
        password: "staff123",
        email_confirm: true,
      });

      // Ensure staff role exists
      const { data: roleRows } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", staffUserId);

      const hasStaff = (roleRows ?? []).some((r) => String(r.role).toLowerCase() === "staff");
      if (!hasStaff) {
        await adminClient.from("user_roles").insert({
          user_id: staffUserId,
          role: "staff",
        });
      }

      await adminClient.from("profiles").upsert({
        id: staffUserId,
        email: staffEmail,
        full_name: existingUser.user_metadata?.full_name || "Staff กลาง (เจ้าหน้าที่ส่วนกลาง)",
        user_type: "staff",
      });
    }

    return NextResponse.json({
      success: true,
      email: staffEmail,
      userId: staffUserId,
      message: "Central staff account ready",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
