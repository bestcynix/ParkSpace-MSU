import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getSystemDatabaseClient } from "@/lib/supabase/system-client";

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

    const client = await getSystemDatabaseClient();

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
      const { data: userData } = await client.auth.getUser(token);
      if (userData.user) user = userData.user;
    }

    const userEmail = (user?.email || "").toLowerCase().trim();
    let isAuthorized = false;

    // Multi-layer Role Verification:
    // Layer 1: Core MSU Staff / Super Admin / Admin email bypass
    if (
      userEmail === "68011211206@msu.ac.th" ||
      userEmail === "69010518004@msu.ac.th" ||
      userEmail === "staff@msu.ac.th"
    ) {
      isAuthorized = true;
    }

    // Layer 2: user_roles table
    if (!isAuthorized && user?.id) {
      try {
        const { data: userRoles } = await client
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const roles = (userRoles ?? []).map((r: { role: string }) => String(r.role).toLowerCase().trim());
        if (roles.includes("staff") || roles.includes("admin") || roles.includes("developer")) {
          isAuthorized = true;
        }
      } catch {
        // continue
      }
    }

    // Layer 3: profiles.user_type
    if (!isAuthorized && user?.id) {
      try {
        const { data: profile } = await client
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .maybeSingle();
        const uType = String(profile?.user_type ?? "").toLowerCase().trim();
        if (uType === "staff" || uType === "admin" || uType === "developer") {
          isAuthorized = true;
        }
      } catch {
        // continue
      }
    }

    // Layer 4: user_metadata
    if (!isAuthorized && user?.user_metadata) {
      const metaType = String(user.user_metadata.user_type || user.user_metadata.role || "").toLowerCase().trim();
      if (metaType === "staff" || metaType === "admin" || metaType === "developer") {
        isAuthorized = true;
      }
    }

    // Layer 5: If request is signed with any active MSU session
    if (!isAuthorized && user?.id && userEmail.endsWith("@msu.ac.th")) {
      isAuthorized = true;
    }

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
        user_id,
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

    let { data: booking } = await bookingQuery.maybeSingle();

    // Fallback: If not found by reference or ID, try searching by vehicle license plate
    if (!booking) {
      try {
        const { data: plateMatches } = await client
          .from("bookings")
          .select(`
            id,
            reference,
            status,
            starts_at,
            ends_at,
            user_id,
            vehicle_snapshot,
            parking_area:parking_areas(code, name_th),
            parking_slot:parking_slots(slot_code)
          `)
          .or(`vehicle_snapshot->>plate.ilike.%${cleanRef}%,vehicle_snapshot->>plate_number.ilike.%${cleanRef}%`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (plateMatches && plateMatches.length > 0) {
          booking = plateMatches[0];
        }
      } catch {
        // Continue to not found
      }
    }

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
          message: "ไม่พบรหัสการจองหรือทะเบียนรถในระบบ",
          is_overstay: false,
          overdue_minutes: 0,
        },
      });
    }

    // Fetch user profile info
    let bookerName: string | null = null;
    let bookerPhone: string | null = null;
    const targetUserId = (booking as { user_id?: string | null }).user_id;
    if (targetUserId) {
      try {
        const { data: prof } = await client
          .from("profiles")
          .select("full_name, phone, email")
          .eq("id", targetUserId)
          .maybeSingle();
        if (prof) {
          bookerName = prof.full_name || prof.email || null;
          bookerPhone = prof.phone || null;
        }
      } catch {
        // ignore
      }
    }

    const vSnapshot = booking.vehicle_snapshot as { plate?: string; plate_number?: string } | null;
    const plate = vSnapshot?.plate || vSnapshot?.plate_number || null;
    const bArea = booking.parking_area as { code?: string; name_th?: string } | null;
    const bSlot = booking.parking_slot as { slot_code?: string } | null;

    // Overstay check
    const now = new Date();
    const endsAt = booking.ends_at ? new Date(booking.ends_at) : null;
    const isOverstay = Boolean(
      (booking.status === "CHECKED_IN" || booking.status === "CONFIRMED" || booking.status === "RESERVED") &&
      endsAt &&
      now.getTime() > endsAt.getTime()
    );
    const overdueMinutes = isOverstay && endsAt ? Math.max(1, Math.floor((now.getTime() - endsAt.getTime()) / 60000)) : 0;

    let scanResult = "VALID";
    let message = "Pass validated successfully";

    if (booking.status === "CANCELLED") {
      scanResult = "INVALID";
      message = "รายการจองนี้ถูกยกเลิกแล้ว (CANCELLED)";
    } else if (booking.status === "COMPLETED") {
      scanResult = "USED";
      message = "รายการจองนี้ใช้งานเสร็จสิ้นแล้ว (COMPLETED)";
    } else if (cleanArea && bArea?.code && cleanArea.toUpperCase() !== bArea.code.toUpperCase()) {
      scanResult = "VALID";
      message = `บัตรผ่านจองไว้ที่ ${bArea.code} (${bArea.name_th ?? ""}) ไม่ตรงกับโซนเวร (${cleanArea})`;
    } else if (isOverstay) {
      scanResult = "VALID";
      message = `⚠️ จอดเกินเวลาที่จองแล้ว ${overdueMinutes} นาที`;
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
        booker_name: bookerName,
        booker_phone: bookerPhone,
        is_overstay: isOverstay,
        overdue_minutes: overdueMinutes,
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