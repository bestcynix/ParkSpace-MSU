import { NextRequest, NextResponse } from "next/server";
import { getSystemDatabaseClient } from "@/lib/supabase/system-client";

export async function GET(request: NextRequest) {
  try {
    const sysClient = await getSystemDatabaseClient();

    // Query bookings statuses
    const bookingsPromise = sysClient
      .from("bookings")
      .select("status");

    // Query unresolved incidents
    const incidentsPromise = sysClient
      .from("incidents")
      .select("status");

    // Query errors in last 24h
    const now = new Date();
    const errorsPromise = sysClient
      .from("error_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

    const [bookingsRes, incidentsRes, errorsRes] = await Promise.all([
      bookingsPromise,
      incidentsPromise,
      errorsPromise,
    ]);

    const bookings = bookingsRes.data ?? [];
    const incidents = incidentsRes.data ?? [];

    const breakdown: Record<string, number> = {};
    for (const b of bookings) {
      const s = String(b.status).toUpperCase();
      breakdown[s] = (breakdown[s] || 0) + 1;
    }

    const reservedCount = (breakdown["PENDING"] || 0) + (breakdown["CONFIRMED"] || 0) + (breakdown["RESERVED"] || 0);
    const occupiedCount = (breakdown["CHECKED_IN"] || 0) + (breakdown["OVERSTAY"] || 0);
    const unresolvedIncidents = incidents.filter((i) => i.status !== "RESOLVED").length;

    return NextResponse.json({
      reserved: reservedCount,
      occupied: occupiedCount,
      incidents: unresolvedIncidents,
      totalBookings: bookings.length,
      breakdown,
      errors24h: errorsRes.count ?? 0,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
