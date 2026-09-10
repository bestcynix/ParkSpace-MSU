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

    const { data: userRoles } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (userRoles ?? []).map((r) => String(r.role).toLowerCase().trim());
    const isAuthorized = roles.some((r) => ["staff", "admin", "developer"].includes(r));
    if (!isAuthorized) {
      return NextResponse.json({ error: "Staff, Admin, or Developer role required" }, { status: 403 });
    }

    const body = await request.json();
    const { reference, token: qrToken, area_code } = body;

    if (!reference) {
      return NextResponse.json({ error: "Booking or QR reference is required" }, { status: 400 });
    }

    const cleanRef = String(reference).trim();
    const cleanToken = (qrToken || "").trim();
    const cleanArea = (area_code || "").trim();

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

    // 2. Direct table lookup: by reference, or by ID if UUID
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
    if (isUuid) {
      bookingQuery = bookingQuery.eq("id", cleanRef);
    } else {
      bookingQuery = bookingQuery.eq("reference", cleanRef);
    }

    const { data: booking, error: bkgErr } = await bookingQuery.maybeSingle();

    if (!booking) {
      // Check qr_tokens table
      const { data: qrRow } = await client
        .from("qr_tokens")
        .select("booking_id, reference, status, expires_at")
        .eq("reference", cleanRef)
        .maybeSingle();

      if (qrRow && qrRow.booking_id) {
        const { data: bkgFromQr } = await client
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
          `)
          .eq("id", qrRow.booking_id)
          .maybeSingle();

        if (bkgFromQr) {
          return NextResponse.json({
            result: {
              booking_id: bkgFromQr.id,
              booking_reference: bkgFromQr.reference,
              booking_status: bkgFromQr.status,
              starts_at: bkgFromQr.starts_at,
              ends_at: bkgFromQr.ends_at,
              area_code: (bkgFromQr.parking_area as { code?: string })?.code ?? null,
              area_name_th: (bkgFromQr.parking_area as { name_th?: string })?.name_th ?? null,
              slot_code: (bkgFromQr.parking_slot as { slot_code?: string })?.slot_code ?? null,
              vehicle_plate: (bkgFromQr.vehicle_snapshot as { plate_number?: string })?.plate_number ?? null,
              scan_result: "VALID",
              message: "Pass validated via QR token reference",
            },
          });
        }
      }

      return NextResponse.json(
        { error: "Booking not found", scan_result: "INVALID_REFERENCE" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      result: {
        booking_id: booking.id,
        booking_reference: booking.reference,
        booking_status: booking.status,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        area_code: (booking.parking_area as { code?: string })?.code ?? null,
        area_name_th: (booking.parking_area as { name_th?: string })?.name_th ?? null,
        slot_code: (booking.parking_slot as { slot_code?: string })?.slot_code ?? null,
        vehicle_plate: (booking.vehicle_snapshot as { plate_number?: string })?.plate_number ?? null,
        scan_result: "VALID",
        message: "Pass validated successfully",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}