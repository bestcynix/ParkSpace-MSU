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

export function getOperationalTimeWindow() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return {
    startsAt: `${todayStr}T00:00:00+07:00`,
    endsAt: `${todayStr}T23:59:59+07:00`,
  };
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
    if (summary) {
      setStatus(getLiveAreaStatus(summary, fallback));
      setCounts(summary);
    }
  }, [summary, fallback]);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;

    if (summary) {
      return () => {
        active = false;
      };
    }

    async function loadStatus() {
      try {
        const res = await fetch("/api/parking/live-capacity");
        if (res.ok) {
          const apiData = (await res.json()) as { summaries?: Record<string, LiveAreaSummary> };
          const found = apiData.summaries?.[areaCode.toUpperCase()];
          if (found) {
            if (active) {
              setStatus(getLiveAreaStatus(found, fallback));
              setCounts(found);
            }
            return;
          }
        }
      } catch {
        // Fallback to RPC
      }

      if (!isSupabaseConfigured()) return;
      const { startsAt, endsAt } = getOperationalTimeWindow();
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("get_parking_capacity_by_type", {
          p_area_code: areaCode,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
        });
        if (error) throw error;
        const rows = (data ?? []) as Array<{
          total_slots?: number | string | null;
          available_slots?: number | string | null;
          reserved_slots?: number | string | null;
          occupied_slots?: number | string | null;
          closed_slots?: number | string | null;
        }>;

        let total = 0;
        let available = 0;
        let reserved = 0;
        let occupied = 0;
        let closed = 0;

        for (const r of rows) {
          total += Number(r.total_slots ?? 0);
          available += Number(r.available_slots ?? 0);
          reserved += Number(r.reserved_slots ?? 0);
          occupied += Number(r.occupied_slots ?? 0);
          closed += Number(r.closed_slots ?? 0);
        }

        const summaryData: LiveAreaSummary = {
          total: total || 100,
          available,
          reserved,
          occupied,
          closed,
        };

        const nextStatus = getLiveAreaStatus(summaryData, fallback);

        if (active) {
          setStatus(nextStatus);
          setCounts(summaryData);
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
            <span style={{ color: "#b45309", backgroundColor: "rgba(245, 158, 11, 0.15)", padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              {locale === "th" ? "จอง" : "Booked"} {displayCounts.reserved}
            </span>
          ) : null}
          {displayCounts.occupied > 0 ? (
            <span style={{ color: "#1d4ed8", backgroundColor: "rgba(37, 99, 235, 0.12)", padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(37, 99, 235, 0.3)" }}>
              {locale === "th" ? "จอด" : "Parked"} {displayCounts.occupied}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
