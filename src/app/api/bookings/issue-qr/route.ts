import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
      return NextResponse.json({ ok: false, message: "Database not configured" });
    }

    const body = await request.json().catch(() => ({}));
    const { booking_id } = body as { booking_id?: string };

    if (!booking_id) {
      return NextResponse.json({ ok: false, message: "booking_id is required" });
    }

    const client = createClient(supabaseUrl, serviceRoleKey || anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
