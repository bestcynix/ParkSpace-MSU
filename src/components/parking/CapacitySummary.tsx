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

const defaultStandardRows: CapacityRow[] = [
  { row_label: "A", slot_type: "CAR", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "B", slot_type: "CAR", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "C", slot_type: "CAR", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "D", slot_type: "CAR", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "E", slot_type: "MOTORCYCLE", total_slots: 15, available_slots: 15, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "F", slot_type: "MOTORCYCLE", total_slots: 15, available_slots: 15, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "G", slot_type: "PICKUP", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
];

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
  const [rows, setRows] = useState<CapacityRow[]>(defaultStandardRows);
  const [loading, setLoading] = useState(true);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.total_slots, 0), [rows]);
  const available = useMemo(() => rows.reduce((sum, row) => sum + row.available_slots, 0), [rows]);

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      if (!isSupabaseConfigured()) {
        if (active) setLoading(false);
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
        if (active && Array.isArray(data) && data.length > 0) {
          setRows(data as CapacityRow[]);
        }
      } catch {
        // Fallback default rows already set
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSummary();
    return () => { active = false; };
  }, [areaCode]);

  if (loading) {
    return (
      <section className="capacity-summary">
        <div className="inline-loading"><LoaderCircle size={17} className="spin" />กำลังตรวจสอบความจุช่องจอด…</div>
      </section>
    );
  }

  return (
    <section className="capacity-summary" aria-label={t.liveCapacityByType}>
      <div className="capacity-summary-heading">
        <BarChart3 size={18} />
        <div>
          <strong>{t.liveCapacityByType}</strong>
          <span>{available}/{total} {t.available}</span>
        </div>
      </div>
      <div className="capacity-summary-grid">
        {rows.map((row) => (
          <article className="capacity-summary-card" key={`${row.row_label}-${row.slot_type}`}>
            <div className="capacity-card-header">
              <strong>{t.row} {row.row_label}</strong>
              <span className="vehicle-type-tag">{typeLabel(t, row.slot_type)}</span>
            </div>
            <div className="capacity-card-stat">
              <span className="capacity-avail-count">{row.available_slots}</span>
              <span className="capacity-slash">/</span>
              <span className="capacity-total-count">{row.total_slots}</span>
              <span className="capacity-status-label">{t.available}</span>
            </div>
            <div className="capacity-breakdown-row">
              <span className="breakdown-item reserved">{t.reserved}: {row.reserved_slots}</span>
              <span className="breakdown-item occupied">{t.occupied}: {row.occupied_slots}</span>
              {row.closed_slots > 0 ? <span className="breakdown-item closed">{t.closed}: {row.closed_slots}</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
