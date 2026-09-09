"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import type { ParkingStatus } from "@/lib/parking/demo-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/parking/StatusBadge";

type LiveSlotRow = { availability?: string };

export function LiveAreaStatus({ areaCode, locale, fallback = "unverified" }: { areaCode: string; locale: Locale; fallback?: ParkingStatus }) {
  const t = getCopy(locale);
  const [status, setStatus] = useState<ParkingStatus>(fallback);
  const [counts, setCounts] = useState<{ available: number; total: number } | null>(null);

  useEffect(() => {
    let active = true;
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
          setCounts({ available, total: rows.length });
        }
      } catch {
        // Keep the explicit fallback label if the public availability RPC is unavailable.
      }
    }
    void loadStatus();
    return () => { active = false; };
  }, [areaCode, fallback]);

  return <div className="live-area-status" aria-live="polite"><StatusBadge status={status} locale={locale} />{counts ? <span>{counts.available}/{counts.total} {t.available}</span> : null}</div>;
}
