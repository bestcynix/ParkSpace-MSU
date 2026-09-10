import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getSystemDatabaseClient } from "@/lib/supabase/system-client";

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

    const cookieClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    const adminClient = await getSystemDatabaseClient();

    let user: { id: string; email?: string } | null = null;
    if (token) {
      const { data } = await cookieClient.auth.getUser(token);
      if (data.user) user = data.user;
    }
    if (!user) {
      const { data } = await cookieClient.auth.getUser();
      if (data.user) user = data.user;
    }
    if (!user && serviceRoleKey && token) {
      const { data } = await adminClient.auth.getUser(token);
      if (data.user) user = data.user;
    }

    if (!user?.id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const userEmail = (user.email || "").toLowerCase().trim();
    let isAdmin = false;

    if (userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th" || userEmail === "admin@msu.ac.th") {
      isAdmin = true;
    } else {
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (roleData ?? []).map((r: { role: string }) => String(r.role).toLowerCase().trim());
      if (roles.includes("admin") || roles.includes("developer")) {
        isAdmin = true;
      } else {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .maybeSingle();
        const uType = String(profile?.user_type ?? "").toLowerCase().trim();
        if (uType === "admin" || uType === "developer") {
          isAdmin = true;
        }
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    // Query parameters
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const areaCode = searchParams.get("area")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "15", 10);

    let query = adminClient
      .from("bookings")
      .select(
        `
        id,
        reference,
        status,
        booking_date,
        starts_at,
        ends_at,
        booking_mode,
        parking_area_id,
        parking_slot_id,
        vehicle_snapshot,
        created_at,
        updated_at,
        profiles:user_id (
          id,
          full_name,
          email,
          phone,
          student_id
        ),
        parking_areas:parking_area_id (
          id,
          code,
          name_th,
          name_en
        ),
        parking_slots:parking_slot_id (
          id,
          slot_code,
          row_label
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status.toUpperCase());
    }

    if (q) {
      query = query.or(
        `reference.ilike.%${q}%,vehicle_snapshot->>plate.ilike.%${q}%,vehicle_snapshot->>plate_number.ilike.%${q}%`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by area code if specified (client-side or secondary filter)
    let rows = (data || []) as Array<Record<string, unknown>>;
    if (areaCode && areaCode !== "ALL") {
      rows = rows.filter((b) => {
        const pa = b.parking_areas as { code?: string } | Array<{ code?: string }> | null;
        const code = Array.isArray(pa) ? pa[0]?.code : pa?.code;
        return code?.toUpperCase() === areaCode.toUpperCase();
      });
    }

    return NextResponse.json({
      bookings: rows,
      total: count ?? rows.length,
      page,
      pageSize,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

async function getCallerEmail(request: NextRequest): Promise<string | null> {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return null;
    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll: () => request.cookies.getAll(), setAll() {} },
    });
    if (token) {
      const { data } = await client.auth.getUser(token);
      if (data.user?.email) return data.user.email.toLowerCase().trim();
    }
    const { data } = await client.auth.getUser();
    return data.user?.email?.toLowerCase().trim() ?? null;
  } catch {
    return null;
  }
}

export async function PUT(request: NextRequest) {
  try {
    const callerEmail = await getCallerEmail(request);

    // Demo Admin Sandbox: simulate booking update without touching live data
    if (callerEmail === "admin@msu.ac.th") {
      return NextResponse.json({
        success: true,
        demoMode: true,
        message: "จำลองการแก้ไขการจองสำเร็จ (โหมด Demo Admin - ข้อมูลจริงไม่ถูกเปลี่ยนแปลง)",
      });
    }

    const adminClient = await getSystemDatabaseClient();

    const body = await request.json();
    const { id, status, parking_area_id, parking_slot_id, vehicle_plate, note } = body;

    if (!id) {
      return NextResponse.json({ error: "Booking id is required" }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updatePayload.status = status;
    if (parking_area_id) updatePayload.parking_area_id = parking_area_id;
    if (parking_slot_id !== undefined) updatePayload.parking_slot_id = parking_slot_id;

    if (vehicle_plate) {
      const { data: curr } = await adminClient.from("bookings").select("vehicle_snapshot").eq("id", id).single();
      const vSnap = (curr?.vehicle_snapshot as Record<string, unknown>) || {};
      updatePayload.vehicle_snapshot = {
        ...vSnap,
        plate: vehicle_plate,
        plate_number: vehicle_plate,
      };
    }

    const { data: updated, error } = await adminClient
      .from("bookings")
      .update(updatePayload)
      .eq("id", id)
      .select("*, parking_areas(*), parking_slots(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record audit
    await adminClient.from("audit_logs").insert({
      event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      trace_id: `trace-${Date.now()}`,
      actor_type: "ADMIN",
      actor_id: "admin",
      action: "ADMIN_UPDATE_BOOKING",
      entity_type: "booking",
      entity_id: id,
      after_data: { updatePayload, note: note || null },
      result: "SUCCESS",
    });

    return NextResponse.json({ success: true, booking: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const callerEmail = await getCallerEmail(request);

    // Demo Admin Sandbox: simulate booking deletion without touching live data
    if (callerEmail === "admin@msu.ac.th") {
      return NextResponse.json({
        success: true,
        demoMode: true,
        message: "จำลองการลบการจองสำเร็จ (โหมด Demo Admin - ข้อมูลจริงไม่ถูกเปลี่ยนแปลง)",
      });
    }

    const adminClient = await getSystemDatabaseClient();

    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "Booking id is required" }, { status: 400 });
    }

    // Delete associated tokens and sessions first
    await adminClient.from("qr_tokens").delete().eq("booking_id", id);
    await adminClient.from("parking_sessions").delete().eq("booking_id", id);

    const { error } = await adminClient.from("bookings").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await adminClient.from("audit_logs").insert({
      event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      trace_id: `trace-${Date.now()}`,
      actor_type: "ADMIN",
      actor_id: "admin",
      action: "ADMIN_DELETE_BOOKING",
      entity_type: "booking",
      entity_id: id,
      result: "SUCCESS",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
