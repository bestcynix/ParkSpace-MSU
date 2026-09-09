"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, LoaderCircle } from "lucide-react";
import type { Locale, Copy } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type CapacityRow = {
  row_label: string;
  slot_type: string;
  total_slots: number;
  available_slots: number;
  reserved_slots: number;
  occupied_slots: number;
  closed_slots: number;
};

function typeLabel(t: Copy, value: string) {
  switch (value) {
    case "CAR": return t.car;
    case "MOTORCYCLE": return t.motorcycle;
    case "PICKUP": return t.pickup;
    case "VAN": return t.van;
    case "EV": return t.ev;
    case "ANY": return t.otherVehicle;
    default: return t.otherVehicle;
  }
}

export function CapacitySummary({ areaCode, locale }: { areaCode: string; locale: Locale }) {
  const t = getCopy(locale);
  const [rows, setRows] = useState<CapacityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.total_slots, 0), [rows]);
  const available = useMemo(() => rows.reduce((sum, row) => sum + row.available_slots, 0), [rows]);

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      if (!isSupabaseConfigured()) {
        if (active) {
          setLoading(false);
          setMessage(t.operationalData);
        }
        return;
      }
      try {
        const startsAt = new Date();
        const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
        const { data, error } = await createSupabaseBrowserClient().rpc("get_parking_capacity_by_type", {
          p_area_code: areaCode,
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
        });
        if (error) throw error;
        if (active) {
          setRows((data ?? []) as CapacityRow[]);
          setMessage("");
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : t.operationalData);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSummary();
    return () => { active = false; };
  }, [areaCode, t.operationalData]);

  if (loading) return <section className="capacity-summary"><div className="inline-loading"><LoaderCircle size={17} className="spin" />Loading</div></section>;
  if (message && !rows.length) return <section className="capacity-summary"><div className="capacity-summary-heading"><BarChart3 size={18} /><div><strong>{t.liveCapacityByType}</strong><span>{message}</span></div></div></section>;

  return <section className="capacity-summary" aria-label={t.liveCapacityByType}><div className="capacity-summary-heading"><BarChart3 size={18} /><div><strong>{t.liveCapacityByType}</strong><span>{available}/{total} {t.available} · {t.liveCounts}</span></div></div><div className="capacity-summary-grid">{rows.map((row) => <article className="capacity-summary-card" key={`${row.row_label}-${row.slot_type}`}><div><strong>{t.row} {row.row_label}</strong><span>{typeLabel(t, row.slot_type)}</span></div><b>{row.available_slots}/{row.total_slots}</b><small>{t.availableCount} · {t.reservedCount}: {row.reserved_slots} · {t.occupiedCount}: {row.occupied_slots} · {t.closedCount}: {row.closed_slots}</small></article>)}</div></section>;
}
