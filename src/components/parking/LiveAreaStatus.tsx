"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import type { ParkingStatus } from "@/lib/parking/demo-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/parking/StatusBadge";

type LiveSlotRow = { availability?: string };

export type LiveAreaSummary = {
  total: number;
  available: number;
  reserved: number;
  occupied: number;
  closed: number;
};

export function getLiveAreaStatus(summary: LiveAreaSummary, fallback: ParkingStatus): ParkingStatus {
  if (summary.total <= 0) return fallback;
  if (summary.closed >= summary.total) return "closed";
  if (summary.available > 0) return "available";
  if (summary.occupied > 0) return "occupied";
  if (summary.reserved > 0) return "reserved";
  return "full";
}

export function LiveAreaStatus({
  areaCode,
  locale,
  fallback = "unverified",
  summary = null,
}: {
  areaCode: string;
  locale: Locale;
  fallback?: ParkingStatus;
  summary?: LiveAreaSummary | null;
}) {
  const t = getCopy(locale);
  const [status, setStatus] = useState<ParkingStatus>(summary ? getLiveAreaStatus(summary, fallback) : fallback);
  const [counts, setCounts] = useState<LiveAreaSummary | null>(summary);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;

    if (summary) {
      return () => {
        active = false;
      };
    }

    async function loadStatus() {
      if (!isSupabaseConfigured()) return;
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("get_available_parking_slots", {
          p_area_code: areaCode,
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
        });
        if (error) throw error;
        const rows = (data ?? []) as LiveSlotRow[];

        // Count base slot states
        const rawAvailable = rows.filter((row) => row.availability === "AVAILABLE").length;
        const closed = rows.filter((row) => row.availability === "CLOSED").length;
        const occupied = rows.filter((row) => row.availability === "OCCUPIED").length;
        let reserved = rows.filter((row) => row.availability === "RESERVED").length;

        // Also check if any area-level bookings (where slot is null) exist for this area
        const { data: areaBookings } = await supabase
          .from("bookings")
          .select("id")
          .is("parking_slot_id", null)
          .in("status", ["CONFIRMED", "RESERVED", "CHECKED_IN"])
          .gte("ends_at", startsAt.toISOString())
          .lte("starts_at", endsAt.toISOString());

        const unassignedCount = areaBookings?.length ?? 0;
        const available = Math.max(0, rawAvailable - unassignedCount);
        reserved += Math.min(rawAvailable, unassignedCount);

        const nextStatus: ParkingStatus = !rows.length
          ? fallback
          : closed === rows.length
          ? "closed"
          : available === 0
          ? (occupied ? "occupied" : "full")
          : available < rows.length
          ? "reserved"
          : "available";

        if (active) {
          setStatus(nextStatus);
          setCounts({ available, total: rows.length, reserved, occupied, closed });
        }
      } catch {
        // Keep the explicit fallback label if the public availability RPC is unavailable.
      }
    }

    void loadStatus();

    if (!isSupabaseConfigured()) {
      return () => {
        active = false;
      };
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void loadStatus();
      }, 400);
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`live-area-${areaCode}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_slots" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_areas" }, () => scheduleRefresh())
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [areaCode, fallback, summary]);

  const displayStatus = summary ? getLiveAreaStatus(summary, fallback) : status;
  const displayCounts = summary ?? counts;
  return (
    <div className="live-area-status" aria-live="polite">
      <StatusBadge status={displayStatus} locale={locale} />
      {displayCounts && displayCounts.total > 0 ? (
        <div className="live-breakdown-row" style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: "var(--ink)" }}>{locale === "th" ? "ทั้งหมด" : "Total"} {displayCounts.total}</span>
          <span style={{ color: "#16a34a" }}>· {locale === "th" ? "ว่าง" : "Free"} {displayCounts.available}</span>
          {displayCounts.reserved > 0 ? (
            <span style={{ color: "#ca8a04" }}>· {locale === "th" ? "จอง" : "Booked"} {displayCounts.reserved}</span>
          ) : null}
          {displayCounts.occupied > 0 ? (
            <span style={{ color: "#2563eb" }}>· {locale === "th" ? "จอด" : "Parked"} {displayCounts.occupied}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
