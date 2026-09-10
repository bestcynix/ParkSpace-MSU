import { NextRequest, NextResponse } from "next/server";
import { getSystemDatabaseClient } from "@/lib/supabase/system-client";

export type AreaLiveStats = {
  total: number;
  available: number;
  reserved: number;
  occupied: number;
  closed: number;
};

export type CapacityRow = {
  row_label: string;
  slot_type: string;
  total_slots: number;
  available_slots: number;
  reserved_slots: number;
  occupied_slots: number;
  closed_slots: number;
};

export type SlotLiveItem = {
  id: string;
  slot_code: string;
  row_label: string;
  position: number;
  slot_type: string;
  availability: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "CLOSED";
};

export async function GET(request: NextRequest) {
  try {
    const sysClient = await getSystemDatabaseClient();
    const requestedArea = request.nextUrl.searchParams.get("area")?.trim().toUpperCase();

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

    // 6. If a specific area was requested, compute live row-by-row breakdown and slot list
    let targetRows: CapacityRow[] | null = null;
    let targetSlots: SlotLiveItem[] | null = null;

    if (requestedArea) {
      const targetArea = (areas ?? []).find((a) => (a.code || "").toUpperCase() === requestedArea);
      if (targetArea) {
        const { data: areaSlots } = await sysClient
          .from("parking_slots")
          .select("id, slot_code, row_label, slot_type, status, position")
          .eq("parking_area_id", targetArea.id)
          .order("position");

        const bookingBySlot: Record<string, string> = {};
        for (const b of bookings ?? []) {
          if (b.parking_slot_id) {
            bookingBySlot[b.parking_slot_id] = String(b.status).toUpperCase();
          }
        }

        const rowsMap: Record<string, CapacityRow> = {};
        const slotList: SlotLiveItem[] = [];

        for (const s of areaSlots ?? []) {
          const rLabel = s.row_label || "A";
          if (!rowsMap[rLabel]) {
            rowsMap[rLabel] = {
              row_label: rLabel,
              slot_type: s.slot_type || "CAR",
              total_slots: 0,
              available_slots: 0,
              reserved_slots: 0,
              occupied_slots: 0,
              closed_slots: 0,
            };
          }
          const r = rowsMap[rLabel];
          r.total_slots++;

          const bStatus = bookingBySlot[s.id];
          let availability: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "CLOSED" = "AVAILABLE";

          if (bStatus === "CHECKED_IN" || bStatus === "OVERSTAY") {
            r.occupied_slots++;
            availability = "OCCUPIED";
          } else if (bStatus === "PENDING" || bStatus === "CONFIRMED" || bStatus === "RESERVED") {
            r.reserved_slots++;
            availability = "RESERVED";
          } else if (s.status === "CLOSED" || targetArea.current_status === "CLOSED") {
            r.closed_slots++;
            availability = "CLOSED";
          } else {
            r.available_slots++;
            availability = "AVAILABLE";
          }

          slotList.push({
            id: s.id,
            slot_code: s.slot_code,
            row_label: rLabel,
            position: s.position ?? 0,
            slot_type: s.slot_type || "CAR",
            availability,
          });
        }

        targetRows = Object.values(rowsMap).sort((a, b) => a.row_label.localeCompare(b.row_label));
        targetSlots = slotList;
      }
    }

    return NextResponse.json({
      success: true,
      areaStats: requestedArea ? summaries[requestedArea] || null : null,
      rows: targetRows,
      slots: targetSlots,
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
