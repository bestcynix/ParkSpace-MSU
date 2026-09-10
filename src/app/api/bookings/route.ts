import { NextRequest, NextResponse } from "next/server";
import { getSystemDatabaseClient } from "@/lib/supabase/system-client";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    // 1. Authenticate user via Bearer token or Cookies
    let userId: string | null = null;
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    if (token) {
      const { createClient } = await import("@supabase/supabase-js");
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: userData } = await authClient.auth.getUser(token);
      userId = userData.user?.id ?? null;
    }

    if (!userId) {
      const cookieClient = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      });
      const { data: userData } = await cookieClient.auth.getUser();
      userId = userData.user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // 2. Parse & validate request body
    const body = await request.json();
    const {
      parking_area_id,
      booking_date,
      parking_slot_id,
      vehicle_id,
      starts_at,
      ends_at,
      vehicle_snapshot,
      status,
    } = body;

    if (!parking_area_id || !booking_date || !starts_at || !ends_at) {
      return NextResponse.json({ error: "Missing required booking fields" }, { status: 400 });
    }

    const startsAtDate = new Date(starts_at);
    const endsAtDate = new Date(ends_at);
    if (isNaN(startsAtDate.getTime()) || isNaN(endsAtDate.getTime()) || endsAtDate <= startsAtDate) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const now = new Date();
    if (endsAtDate.getTime() < now.getTime() - 5 * 60 * 1000) {
      return NextResponse.json({ error: "Cannot create a booking in the past" }, { status: 400 });
    }

    // Ensure database constraints are strictly satisfied:
    // (booking_mode = 'AREA_ONLY' and parking_slot_id is null) or (booking_mode = 'INDIVIDUAL_SLOT' and parking_slot_id is not null)
    const slotId = parking_slot_id ? String(parking_slot_id).trim() : null;
    const resolvedMode = slotId ? "INDIVIDUAL_SLOT" : "AREA_ONLY";

    const payload = {
      user_id: userId,
      parking_area_id,
      booking_date,
      parking_slot_id: slotId,
      vehicle_id: vehicle_id || null,
      starts_at,
      ends_at,
      vehicle_snapshot: vehicle_snapshot || {},
      booking_mode: resolvedMode,
      status: status || "PENDING",
    };

    // 3. Insert using authorized system client
    const sysClient = await getSystemDatabaseClient();
    const { data: booking, error: insertError } = await sysClient
      .from("bookings")
      .insert(payload)
      .select("id, reference, status, starts_at, ends_at, booking_date")
      .single();

    if (insertError) {
      let friendlyError = insertError.message;
      if (insertError.message.includes("no_overlapping_slot_bookings")) {
        friendlyError = "มีผู้จองช่องจอดนี้ในช่วงเวลาดังกล่าวแล้ว (This slot has already been reserved during this time)";
      } else if (insertError.message.includes("PARKING_SLOT_NOT_AVAILABLE")) {
        friendlyError = "ช่องจอดนี้ไม่พร้อมให้บริการในช่วงเวลาที่เลือก (Slot not available)";
      } else if (insertError.message.includes("VEHICLE_TYPE_NOT_ALLOWED_FOR_SLOT")) {
        friendlyError = "ประเภทยานพาหนะไม่ตรงกับประเภทช่องจอด (Vehicle type mismatch for this slot)";
      } else if (insertError.message.includes("PARKING_AREA_NOT_AVAILABLE")) {
        friendlyError = "พื้นที่จอดนี้ไม่พร้อมให้บริการ (Parking area not available)";
      } else if (insertError.message.includes("PARKING_ROW_CLOSED")) {
        friendlyError = "แถวจอดนี้ปิดให้บริการชั่วคราว (Parking row is temporarily closed)";
      }
      return NextResponse.json({ error: friendlyError }, { status: 400 });
    }

    // 4. Auto-issue QR pass
    let qr = null;
    try {
      const { data: qrData } = await sysClient.rpc("issue_booking_qr", {
        p_booking_id: booking.id,
      });
      qr = qrData?.[0] ?? null;
    } catch {
      // Non-fatal, fallback to client background trigger
    }

    return NextResponse.json({ booking, qr }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
