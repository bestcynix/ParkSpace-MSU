"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, LoaderCircle } from "lucide-react";
import type { Locale, Copy } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

import { getOperationalTimeWindow } from "@/components/parking/LiveAreaStatus";

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
  { row_label: "A", slot_type: "CAR", total_slots: 15, available_slots: 15, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "B", slot_type: "CAR", total_slots: 15, available_slots: 15, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "C", slot_type: "MOTORCYCLE", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "D", slot_type: "PICKUP", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "E", slot_type: "EV", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "F", slot_type: "VAN", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
  { row_label: "G", slot_type: "ANY", total_slots: 14, available_slots: 14, reserved_slots: 0, occupied_slots: 0, closed_slots: 0 },
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
  const reserved = useMemo(() => rows.reduce((sum, row) => sum + row.reserved_slots, 0), [rows]);
  const occupied = useMemo(() => rows.reduce((sum, row) => sum + row.occupied_slots, 0), [rows]);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;

    async function loadSummary() {
      // 1. Try fetching authoritative live capacity API (contains exact row breakdown)
      try {
        const res = await fetch(`/api/parking/live-capacity?area=${encodeURIComponent(areaCode)}`);
        if (res.ok) {
          const json = await res.json();
          if (active && Array.isArray(json.rows) && json.rows.length > 0) {
            setRows(json.rows as CapacityRow[]);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to RPC
      }

      if (!isSupabaseConfigured()) {
        if (active) setLoading(false);
        return;
      }

      // 2. Fallback to Supabase RPC
      try {
        const { startsAt, endsAt } = getOperationalTimeWindow();
        const { data, error } = await createSupabaseBrowserClient().rpc("get_parking_capacity_by_type", {
          p_area_code: areaCode,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
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

    if (!isSupabaseConfigured()) {
      return () => {
        active = false;
      };
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void loadSummary();
      }, 400);
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`live-cap-rows-${areaCode}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_slots" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_areas" }, () => scheduleRefresh())
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
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
          <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 13, marginTop: 4 }}>
            <span>{locale === "th" ? `ทั้งหมด ${total} ช่อง` : `Total ${total} slots`}</span>
            <span style={{ color: "#16a34a", fontWeight: 700 }}>· {locale === "th" ? `ว่าง ${available}` : `Free ${available}`}</span>
            {reserved > 0 ? (
              <span style={{ color: "#b45309", backgroundColor: "rgba(245, 158, 11, 0.15)", padding: "1px 8px", borderRadius: 999, fontWeight: 700, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                {locale === "th" ? `จอง ${reserved}` : `Reserved ${reserved}`}
              </span>
            ) : null}
            {occupied > 0 ? (
              <span style={{ color: "#1d4ed8", backgroundColor: "rgba(37, 99, 235, 0.12)", padding: "1px 8px", borderRadius: 999, fontWeight: 700, border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                {locale === "th" ? `จอด ${occupied}` : `Parked ${occupied}`}
              </span>
            ) : null}
          </div>
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
              <span className="capacity-avail-count" style={{ color: row.available_slots > 0 ? "#16a34a" : "#dc2626" }}>
                {row.available_slots}
              </span>
              <span className="capacity-slash">/</span>
              <span className="capacity-total-count">{row.total_slots}</span>
              <span className="capacity-status-label">{t.available}</span>
            </div>
            <div className="capacity-breakdown-row">
              <span
                className="breakdown-item reserved"
                style={{
                  color: row.reserved_slots > 0 ? "#b45309" : undefined,
                  fontWeight: row.reserved_slots > 0 ? 700 : undefined,
                }}
              >
                {t.reserved}: {row.reserved_slots}
              </span>
              <span
                className="breakdown-item occupied"
                style={{
                  color: row.occupied_slots > 0 ? "#1d4ed8" : undefined,
                  fontWeight: row.occupied_slots > 0 ? 700 : undefined,
                }}
              >
                {t.occupied}: {row.occupied_slots}
              </span>
              {row.closed_slots > 0 ? <span className="breakdown-item closed">{t.closed}: {row.closed_slots}</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
