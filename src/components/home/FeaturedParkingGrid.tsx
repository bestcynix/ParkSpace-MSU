"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { parkingAreas } from "@/lib/parking/demo-data";
import { ParkingCard } from "@/components/parking/ParkingCard";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getOperationalTimeWindow, type LiveAreaSummary } from "@/components/parking/LiveAreaStatus";

type CapacityRow = {
  area_code?: string | null;
  total_slots?: number | string | null;
  available_slots?: number | string | null;
  reserved_slots?: number | string | null;
  occupied_slots?: number | string | null;
  closed_slots?: number | string | null;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function FeaturedParkingGrid({ locale }: { locale: Locale }) {
  const [liveSummaries, setLiveSummaries] = useState<Record<string, LiveAreaSummary>>({});

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;

    async function loadSummaries() {
      try {
        // Fetch from high-accuracy real-time API
        const res = await fetch("/api/parking/live-capacity");
        if (res.ok) {
          const apiData = (await res.json()) as { summaries?: Record<string, LiveAreaSummary> };
          if (apiData.summaries && Object.keys(apiData.summaries).length > 0) {
            if (active) setLiveSummaries(apiData.summaries);
            return;
          }
        }
      } catch {
        // Fallback to direct RPC
      }

      if (!isSupabaseConfigured()) return;
      const { startsAt, endsAt } = getOperationalTimeWindow();
      try {
        const { data, error } = await createSupabaseBrowserClient().rpc("get_parking_capacity_by_type", {
          p_area_code: null,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
        });
        if (error) throw error;
        const next: Record<string, LiveAreaSummary> = {};
        for (const row of (data ?? []) as CapacityRow[]) {
          const code = row.area_code?.toUpperCase();
          if (!code) continue;
          const current = next[code] ?? { total: 0, available: 0, reserved: 0, occupied: 0, closed: 0 };
          current.total += numeric(row.total_slots);
          current.available += numeric(row.available_slots);
          current.reserved += numeric(row.reserved_slots);
          current.occupied += numeric(row.occupied_slots);
          current.closed += numeric(row.closed_slots);
          next[code] = current;
        }

        // Ensure featured 3 areas have an accurate baseline capacity
        for (const area of parkingAreas.slice(0, 3)) {
          const code = area.code.toUpperCase();
          if (!next[code] || next[code].total === 0) {
            const cap = area.estimatedCapacity || 100;
            const res = next[code]?.reserved ?? 0;
            const occ = next[code]?.occupied ?? 0;
            const cls = next[code]?.closed ?? 0;
            next[code] = {
              total: cap,
              available: Math.max(0, cap - res - occ - cls),
              reserved: res,
              occupied: occ,
              closed: cls,
            };
          }
        }

        if (active) setLiveSummaries(next);
      } catch {
        // Keep fallback
      }
    }

    void loadSummaries();

    if (!isSupabaseConfigured()) {
      return () => {
        active = false;
      };
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void loadSummaries();
      }, 400);
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`featured-parking-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_slots" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_areas" }, () => scheduleRefresh())
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="parking-grid">
      {parkingAreas.slice(0, 3).map((area) => (
        <ParkingCard area={area} locale={locale} key={area.id} liveSummary={liveSummaries[area.code] ?? null} />
      ))}
    </div>
  );
}
