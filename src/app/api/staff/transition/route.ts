import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

    // Role check
    const { data: userRoles } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (userRoles ?? []).map((r) => String(r.role).toLowerCase().trim());
    const isStaff = roles.includes("staff");
    const isAdmin = roles.includes("admin");
    const isDev = roles.includes("developer");

    if (!isStaff && !isAdmin && !isDev) {
      return NextResponse.json({ error: "Staff, Admin, or Developer role required" }, { status: 403 });
    }

    const body = await request.json();
    const { booking_id, action, note, override_status } = body as {
      booking_id: string;
      action: ActionType;
      note?: string;
      override_status?: string;
    };

    if (!booking_id || !action) {
      return NextResponse.json({ error: "booking_id and action are required" }, { status: 400 });
    }

    // Fetch booking current state
    const { data: booking, error: bkgErr } = await client
      .from("bookings")
      .select("id, status, user_id, parking_area_id, parking_slot_id, starts_at, ends_at")
      .eq("id", booking_id)
      .single();

    if (bkgErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    let nextStatus: string;

    // Strict Role Permission Logic
    if (isStaff && !isAdmin && !isDev) {
      // Staff has restricted transitions: only CHECK_IN and CHECK_OUT
      if (action === "CHECK_IN") {
        if (!["CONFIRMED", "RESERVED"].includes(booking.status)) {
          return NextResponse.json(
            { error: `Staff can only check-in CONFIRMED or RESERVED bookings (current: ${booking.status})` },
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
          { error: "Staff accounts are strictly limited to Check-in and Check-out. Cancel or status override requires Admin/Developer." },
          { status: 403 }
        );
      }
    } else {
      // Admin or Developer: full authority
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
    const { data: updatedBooking, error: updateErr } = await client
      .from("bookings")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
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
      actor_type: isAdmin ? "ADMIN" : isDev ? "DEVELOPER" : "STAFF",
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