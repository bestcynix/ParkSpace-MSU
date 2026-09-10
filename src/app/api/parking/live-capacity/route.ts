import { NextRequest, NextResponse } from "next/server";
import { getSystemDatabaseClient } from "@/lib/supabase/system-client";

export type AreaLiveStats = {
  total: number;
  available: number;
  reserved: number;
  occupied: number;
  closed: number;
};

export async function GET(request: NextRequest) {
  try {
    const sysClient = await getSystemDatabaseClient();

    // 1. Fetch parking areas
    const { data: areas, error: areaErr } = await sysClient
      .from("parking_areas")
      .select("id, code, capacity, current_status")
      .order("code");

    if (areaErr) throw areaErr;

    // 2. Fetch active bookings (occupied or reserved)
    const { data: bookings, error: bkgErr } = await sysClient
      .from("bookings")
      .select("id, status, parking_area_id, parking_slot_id")
      .in("status", ["CHECKED_IN", "OVERSTAY", "PENDING", "CONFIRMED", "RESERVED"]);

    if (bkgErr) throw bkgErr;

    // 3. Fetch parking slots to map slot -> area and count closed slots
    const { data: slots, error: slotErr } = await sysClient
      .from("parking_slots")
      .select("id, parking_area_id, status");

    const slotToArea: Record<string, string> = {};
    const closedSlotsByArea: Record<string, number> = {};
    const totalSlotsByArea: Record<string, number> = {};

    for (const slot of slots ?? []) {
      if (slot.parking_area_id) {
        slotToArea[slot.id] = slot.parking_area_id;
        totalSlotsByArea[slot.parking_area_id] = (totalSlotsByArea[slot.parking_area_id] || 0) + 1;
        if (slot.status === "CLOSED") {
          closedSlotsByArea[slot.parking_area_id] = (closedSlotsByArea[slot.parking_area_id] || 0) + 1;
        }
      }
    }

    // 4. Map bookings to areas
    const reservedByArea: Record<string, number> = {};
    const occupiedByArea: Record<string, number> = {};

    for (const b of bookings ?? []) {
      const areaId = b.parking_area_id || (b.parking_slot_id ? slotToArea[b.parking_slot_id] : null);
      if (!areaId) continue;

      const st = String(b.status).toUpperCase();
      if (st === "CHECKED_IN" || st === "OVERSTAY") {
        occupiedByArea[areaId] = (occupiedByArea[areaId] || 0) + 1;
      } else if (st === "PENDING" || st === "CONFIRMED" || st === "RESERVED") {
        reservedByArea[areaId] = (reservedByArea[areaId] || 0) + 1;
      }
    }

    // 5. Build per-area summaries keyed by uppercase area code
    const summaries: Record<string, AreaLiveStats> = {};
    let globalTotal = 0;
    let globalAvailable = 0;
    let globalReserved = 0;
    let globalOccupied = 0;
    let globalClosed = 0;

    for (const area of areas ?? []) {
      const code = (area.code || "").toUpperCase();
      if (!code) continue;

      const cap = Number(area.capacity) || totalSlotsByArea[area.id] || 100;
      const occ = occupiedByArea[area.id] || 0;
      const res = reservedByArea[area.id] || 0;
      const isAreaClosed = area.current_status === "CLOSED";
      const cls = isAreaClosed ? cap : (closedSlotsByArea[area.id] || 0);
      const avail = Math.max(0, cap - occ - res - cls);

      summaries[code] = {
        total: cap,
        available: avail,
        reserved: res,
        occupied: occ,
        closed: cls,
      };

      globalTotal += cap;
      globalAvailable += avail;
      globalReserved += res;
      globalOccupied += occ;
      globalClosed += cls;
    }

    return NextResponse.json({
      success: true,
      summaries,
      global: {
        total: globalTotal,
        available: globalAvailable,
        reserved: globalReserved,
        occupied: globalOccupied,
        closed: globalClosed,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to calculate live capacity" },
      { status: 500 }
    );
  }
}
