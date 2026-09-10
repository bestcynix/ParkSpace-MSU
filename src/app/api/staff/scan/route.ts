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

    let roles: string[] = [];
    try {
      const { data: userRoles } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      roles = (userRoles ?? []).map((r) => String(r.role).toLowerCase().trim());
    } catch {
      // Fallback to profiles.user_type if user_roles table doesn't exist
      const { data: profile } = await client.from("profiles").select("user_type").eq("id", userId).maybeSingle();
      if (profile?.user_type) roles = [String(profile.user_type).toLowerCase().trim()];
    }

    const isAuthorized = roles.some((r) => ["staff", "admin"].includes(r));
    if (!isAuthorized) {
      return NextResponse.json({ error: "Staff or Admin role required" }, { status: 403 });
    }

    const body = await request.json();
    const { reference, token: qrToken, area_code } = body;

    if (!reference) {
      return NextResponse.json({ error: "Booking or QR reference is required" }, { status: 400 });
    }

    let cleanRef = String(reference).trim();
    let cleanToken = (qrToken || "").trim();
    const cleanArea = (area_code || "").trim();

    if (cleanRef.startsWith("{") && cleanRef.endsWith("}")) {
      try {
        const json = JSON.parse(cleanRef);
        if (json.reference) cleanRef = String(json.reference).trim();
        if (json.token) cleanToken = String(json.token).trim();
        if (json.booking_reference) cleanRef = String(json.booking_reference).trim();
      } catch {
        // keep string
      }
    }

    // 1. Try DB RPC validate_booking_qr
    try {
      const { data: rpcData, error: rpcError } = await client.rpc("validate_booking_qr", {
        p_reference: cleanRef,
        p_token: cleanToken || cleanRef,
        p_area_code: cleanArea || null,
      });

      if (!rpcError && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row && row.scan_result === "VALID") {
          return NextResponse.json({ result: row });
        }
      }
    } catch {
      // Fall through to direct table lookup
    }

    // 2. Lookup in qr_tokens first if reference starts with MSUPK-QR-
    let bookingIdFromQr: string | null = null;
    try {
      const { data: qrRows } = await client
        .from("qr_tokens")
        .select("booking_id, reference, status, expires_at")
        .ilike("reference", cleanRef)
        .order("created_at", { ascending: false })
        .limit(1);

      if (qrRows && qrRows.length > 0) {
        bookingIdFromQr = qrRows[0].booking_id;
      }
    } catch {
      // Ignore and continue to bookings table lookup
    }

    // 3. Direct table lookup in bookings
    let bookingQuery = client
      .from("bookings")
      .select(`
        id,
        reference,
        status,
        starts_at,
        ends_at,
        vehicle_snapshot,
        parking_area:parking_areas(code, name_th),
        parking_slot:parking_slots(slot_code)
      `);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
    if (bookingIdFromQr) {
      bookingQuery = bookingQuery.eq("id", bookingIdFromQr);
    } else if (isUuid) {
      bookingQuery = bookingQuery.eq("id", cleanRef);
    } else {
      bookingQuery = bookingQuery.ilike("reference", cleanRef);
    }

    const { data: booking, error: bkgErr } = await bookingQuery.maybeSingle();

    if (!booking) {
      return NextResponse.json({
        error: "Booking not found",
        scan_result: "INVALID_REFERENCE",
        result: {
          booking_id: "",
          booking_reference: cleanRef,
          booking_status: "INVALID",
          starts_at: "",
          ends_at: "",
          area_code: null,
          area_name_th: null,
          slot_code: null,
          vehicle_plate: null,
          scan_result: "INVALID_REFERENCE",
          message: "ไม่พบรหัสการจองหรือรหัส QR ในระบบ",
        },
      });
    }

    const vSnapshot = booking.vehicle_snapshot as { plate?: string; plate_number?: string } | null;
    const plate = vSnapshot?.plate || vSnapshot?.plate_number || null;
    const bArea = booking.parking_area as { code?: string; name_th?: string } | null;
    const bSlot = booking.parking_slot as { slot_code?: string } | null;

    let scanResult = "VALID";
    let message = "Pass validated successfully";

    if (booking.status === "CANCELLED") {
      scanResult = "INVALID";
      message = "รายการจองนี้ถูกยกเลิกแล้ว (CANCELLED)";
    } else if (booking.status === "COMPLETED") {
      scanResult = "USED";
      message = "รายการจองนี้ใช้งานเสร็จสิ้นแล้ว (COMPLETED)";
    } else if (cleanArea && bArea?.code && cleanArea.toUpperCase() !== bArea.code.toUpperCase()) {
      scanResult = "WRONG_AREA";
      message = `พื้นที่จอดไม่ตรงกับที่จองไว้ (จองไว้ที่ ${bArea.code})`;
    }

    return NextResponse.json({
      result: {
        booking_id: booking.id,
        booking_reference: booking.reference,
        booking_status: booking.status,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        area_code: bArea?.code ?? null,
        area_name_th: bArea?.name_th ?? null,
        slot_code: bSlot?.slot_code ?? null,
        vehicle_plate: plate,
        scan_result: scanResult,
        message,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}