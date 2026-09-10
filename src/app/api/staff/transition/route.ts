import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type ActionType = "CHECK_IN" | "CHECK_OUT" | "CANCEL" | "NO_SHOW" | "OVERRIDE";

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

    // 1. User verification client
    const cookieClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    // 2. Database client (bypasses RLS so staff can update bookings)
    const adminClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : cookieClient;

    let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
    if (token) {
      const { data: userData } = await cookieClient.auth.getUser(token);
      if (userData.user) user = userData.user;
    }
    if (!user) {
      const { data: userData } = await cookieClient.auth.getUser();
      if (userData.user) user = userData.user;
    }
    if (!user && serviceRoleKey && token) {
      const { data: userData } = await adminClient.auth.getUser(token);
      if (userData.user) user = userData.user;
    }

    if (!user?.id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const userEmail = (user.email || "").toLowerCase().trim();
    let isStaff = false;
    let isAdmin = false;

    // Layer 1: Core MSU Super Admin / Admin / Staff email bypass
    if (userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th") {
      isAdmin = true;
      isStaff = true;
    } else if (userEmail === "staff@msu.ac.th") {
      isStaff = true;
    }

    // Layer 2: user_roles table (using adminClient to avoid RLS restrictions)
    if ((!isStaff || !isAdmin) && user.id) {
      try {
        const { data: userRoles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const roles = (userRoles ?? []).map((r: { role: string }) => String(r.role).toLowerCase().trim());
        if (roles.includes("admin") || roles.includes("developer")) {
          isAdmin = true;
          isStaff = true;
        } else if (roles.includes("staff")) {
          isStaff = true;
        }
      } catch {
        // continue
      }
    }

    // Layer 3: profiles.user_type
    if ((!isStaff || !isAdmin) && user.id) {
      try {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .maybeSingle();
        const uType = String(profile?.user_type ?? "").toLowerCase().trim();
        if (uType === "admin" || uType === "developer") {
          isAdmin = true;
          isStaff = true;
        } else if (uType === "staff") {
          isStaff = true;
        }
      } catch {
        // continue
      }
    }

    // Layer 4: user_metadata
    if ((!isStaff || !isAdmin) && user.user_metadata) {
      const metaType = String(user.user_metadata.user_type || user.user_metadata.role || "").toLowerCase().trim();
      if (metaType === "admin" || metaType === "developer") {
        isAdmin = true;
        isStaff = true;
      } else if (metaType === "staff") {
        isStaff = true;
      }
    }

    if (!isStaff && !isAdmin) {
      return NextResponse.json({ error: "Staff or Admin role required" }, { status: 403 });
    }

    const client = adminClient;
    const userId = user.id;

    const body = await request.json();
    const { booking_id, action, note, override_status, updated_plate } = body as {
      booking_id: string;
      action: ActionType;
      note?: string;
      override_status?: string;
      updated_plate?: string;
    };

    if (!booking_id || !action) {
      return NextResponse.json({ error: "booking_id and action are required" }, { status: 400 });
    }

    // Fetch booking current state
    const { data: booking, error: bkgErr } = await client
      .from("bookings")
      .select("id, status, user_id, parking_area_id, parking_slot_id, vehicle_snapshot, starts_at, ends_at")
      .eq("id", booking_id)
      .single();

    if (bkgErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    let nextStatus: string;

    // Strict Role Permission Logic
    if (isStaff && !isAdmin) {
      // Staff has restricted transitions: only CHECK_IN and CHECK_OUT
      if (action === "CHECK_IN") {
        if (!["PENDING", "CONFIRMED", "RESERVED"].includes(booking.status)) {
          return NextResponse.json(
            { error: `Staff can only check-in PENDING, CONFIRMED, or RESERVED bookings (current: ${booking.status})` },
            { status: 400 }
          );
        }
        nextStatus = "CHECKED_IN";
      } else if (action === "CHECK_OUT") {
        if (booking.status !== "CHECKED_IN" && booking.status !== "OVERSTAY") {
          return NextResponse.json(
            { error: `Staff can only check-out active CHECKED_IN bookings (current: ${booking.status})` },
            { status: 400 }
          );
        }
        nextStatus = "COMPLETED";
      } else {
        return NextResponse.json(
          { error: "Staff accounts are strictly limited to Check-in and Check-out. Cancel or status override requires Admin." },
          { status: 403 }
        );
      }
    } else {
      // Admin: full authority
      if (action === "CHECK_IN") {
        nextStatus = "CHECKED_IN";
      } else if (action === "CHECK_OUT") {
        nextStatus = "COMPLETED";
      } else if (action === "CANCEL") {
        nextStatus = "CANCELLED";
      } else if (action === "NO_SHOW") {
        nextStatus = "NO_SHOW";
      } else if (action === "OVERRIDE" && override_status) {
        nextStatus = override_status;
      } else {
        return NextResponse.json({ error: "Invalid action or missing override status" }, { status: 400 });
      }
    }

    // Perform booking update
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    if (updated_plate && updated_plate.trim()) {
      const vSnap = (booking.vehicle_snapshot as Record<string, unknown>) || {};
      updatePayload.vehicle_snapshot = {
        ...vSnap,
        plate: updated_plate.trim(),
        plate_number: updated_plate.trim(),
      };
    }

    const { data: updatedBooking, error: updateErr } = await client
      .from("bookings")
      .update(updatePayload)
      .eq("id", booking_id)
      .select("id, status, reference")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Also record parking session transition if checking in or out
    const nowIso = new Date().toISOString();
    if (nextStatus === "CHECKED_IN") {
      await client.from("parking_sessions").insert({
        booking_id: booking.id,
        user_id: booking.user_id,
        parking_area_id: booking.parking_area_id,
        parking_slot_id: booking.parking_slot_id,
        status: "ACTIVE",
        check_in_at: nowIso,
      });
    } else if (nextStatus === "COMPLETED") {
      await client
        .from("parking_sessions")
        .update({ status: "COMPLETED", check_out_at: nowIso })
        .eq("booking_id", booking.id)
        .eq("status", "ACTIVE");
    }

    // Record audit log
    await client.from("audit_logs").insert({
      event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      trace_id: `trace-${Date.now()}`,
      actor_type: isAdmin ? "ADMIN" : "STAFF",
      actor_id: userId,
      action: `BOOKING_${action}`,
      entity_type: "booking",
      entity_id: booking_id,
      parking_area_id: booking.parking_area_id,
      before_data: { status: booking.status },
      after_data: { status: nextStatus, note: note || null },
      result: "SUCCESS",
    });

    return NextResponse.json({
      success: true,
      booking_id: updatedBooking.id,
      reference: updatedBooking.reference,
      previous_status: booking.status,
      current_status: updatedBooking.status,
      message: `Status transitioned to ${nextStatus} successfully`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}