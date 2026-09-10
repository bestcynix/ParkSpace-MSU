import { NextRequest, NextResponse } from "next/server";
import { getSystemDatabaseClient } from "@/lib/supabase/system-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { booking_id } = body as { booking_id?: string };

    if (!booking_id) {
      return NextResponse.json({ ok: false, message: "booking_id is required" });
    }

    const client = await getSystemDatabaseClient();

    try {
      const { data, error } = await client.rpc("issue_booking_qr", { p_booking_id: booking_id });
      if (error) {
        return NextResponse.json({ ok: false, error: error.message });
      }
      return NextResponse.json({ ok: true, data });
    } catch (rpcErr) {
      return NextResponse.json({ ok: false, error: rpcErr instanceof Error ? rpcErr.message : "RPC failed" });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Server error" });
  }
}
