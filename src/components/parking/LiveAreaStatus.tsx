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

export function LiveAreaStatus({ areaCode, locale, fallback = "unverified", summary = null }: { areaCode: string; locale: Locale; fallback?: ParkingStatus; summary?: LiveAreaSummary | null }) {
  const t = getCopy(locale);
  const [status, setStatus] = useState<ParkingStatus>(summary ? getLiveAreaStatus(summary, fallback) : fallback);
  const [counts, setCounts] = useState<LiveAreaSummary | null>(summary);

  useEffect(() => {
    let active = true;
    if (summary) {
      return () => { active = false; };
    }

    async function loadStatus() {
      if (!isSupabaseConfigured()) return;
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      try {
        const { data, error } = await createSupabaseBrowserClient().rpc("get_available_parking_slots", {
          p_area_code: areaCode,
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
        });
        if (error) throw error;
        const rows = (data ?? []) as LiveSlotRow[];
        const available = rows.filter((row) => row.availability === "AVAILABLE").length;
        const closed = rows.filter((row) => row.availability === "CLOSED").length;
        const occupied = rows.filter((row) => row.availability === "OCCUPIED").length;
        const nextStatus: ParkingStatus = !rows.length ? fallback : closed === rows.length ? "closed" : available === 0 ? (occupied ? "occupied" : "full") : available < rows.length ? "reserved" : "available";
        if (active) {
          setStatus(nextStatus);
          setCounts({ available, total: rows.length, reserved: rows.filter((row) => row.availability === "RESERVED").length, occupied, closed });
        }
      } catch {
        // Keep the explicit fallback label if the public availability RPC is unavailable.
      }
    }
    void loadStatus();
    return () => { active = false; };
  }, [areaCode, fallback, summary]);

  const displayStatus = summary ? getLiveAreaStatus(summary, fallback) : status;
  const displayCounts = summary ?? counts;
  return <div className="live-area-status" aria-live="polite"><StatusBadge status={displayStatus} locale={locale} />{displayCounts ? <span title={`${t.reserved}: ${displayCounts.reserved} · ${t.occupied}: ${displayCounts.occupied} · ${t.closed}: ${displayCounts.closed}`}>{displayCounts.available}/{displayCounts.total} {t.available}</span> : null}</div>;
}
