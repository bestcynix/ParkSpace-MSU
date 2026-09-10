"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, LoaderCircle, RefreshCw, Search } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { parkingAreas } from "@/lib/parking/demo-data";
import { ParkingCard } from "@/components/parking/ParkingCard";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { LiveAreaSummary } from "@/components/parking/LiveAreaStatus";

type ParkingFilter = "all" | "available" | "reserved" | "occupied" | "closed";
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

export function ParkingBrowser({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ParkingFilter>("all");
  const [liveSummaries, setLiveSummaries] = useState<Record<string, LiveAreaSummary>>({});
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;

    async function loadLiveSummaries() {
      if (!isSupabaseConfigured()) {
        if (active) setLiveLoading(false);
        return;
      }
      setLiveLoading(true);
      setLiveError("");
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      try {
        const { data, error } = await createSupabaseBrowserClient().rpc("get_parking_capacity_by_type", {
          p_area_code: null,
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
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
        if (active) setLiveSummaries(next);
      } catch (error) {
        if (active) setLiveError(error instanceof Error ? error.message : t.operationalData);
      } finally {
        if (active) setLiveLoading(false);
      }
    }

    void loadLiveSummaries();

    if (!isSupabaseConfigured()) {
      return () => {
        active = false;
      };
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void loadLiveSummaries();
      }, 400);
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`parking-browser-realtime-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_slots" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_areas" }, () => scheduleRefresh())
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [refreshKey, t.operationalData]);

  const filtered = useMemo(() => parkingAreas.filter((area) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchQuery = !normalizedQuery || [area.code, area.th, area.en].some((value) => value.toLowerCase().includes(normalizedQuery));
    const summary = liveSummaries[area.code];
    const matchFilter = filter === "all" || Boolean(summary && (
      filter === "available" ? summary.available > 0 :
      filter === "reserved" ? summary.reserved > 0 :
      filter === "occupied" ? summary.occupied > 0 :
      summary.closed > 0
    ));
    return matchQuery && matchFilter;
  }), [filter, liveSummaries, query]);
  const filters = [
    ["all", t.all],
    ["available", t.available],
    ["reserved", t.reserved],
    ["occupied", t.occupied],
    ["closed", t.closed],
  ] as const;

  return (
    <section>
      <div className="search-box"><Search size={19} color="#727b86" /><input aria-label={t.searchPlaceholder} placeholder={t.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="chip-row" aria-label={locale === "th" ? "กรองสถานะพื้นที่จอดรถ" : "Filter parking area status"}>{filters.map(([key, label]) => <button className={`filter-chip ${filter === key ? "active" : ""}`} key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {liveLoading ? <div className="live-filter-note" role="status"><LoaderCircle size={15} className="spin" />{locale === "th" ? "กำลังอ่านสถานะพื้นที่จาก Supabase…" : "Reading live area status from Supabase…"}</div> : liveError ? <div className="live-filter-note warning" role="status"><Info size={15} /><span>{locale === "th" ? "ยังอ่านสถานะสดไม่ได้ จึงไม่แสดงผลกรองแบบเดา" : "Live status is unavailable, so status filters are not guessed."}</span><button className="text-link" type="button" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={12} />{locale === "th" ? "ลองใหม่" : "Retry"}</button></div> : <div className="live-filter-note" role="status"><Info size={15} />{locale === "th" ? "ตัวกรองสถานะอ่านจากช่องจอดและการจองจริงใน Supabase" : "Status filters read real slot and booking data from Supabase."}</div>}
      <div className="parking-grid" style={{ marginTop: 18 }}>{filtered.map((area) => <ParkingCard area={area} locale={locale} key={area.id} liveSummary={liveSummaries[area.code] ?? null} />)}</div>
      {!liveLoading && !filtered.length ? <div className="empty-card"><div><div className="empty-icon"><Search size={25} /></div><h2>{t.noResults}</h2><p>{liveError ? (locale === "th" ? "ลองใหม่เมื่อเชื่อมต่อฐานข้อมูลได้" : "Try again when the database connection is available.") : (locale === "th" ? "ไม่พบพื้นที่จอดรถที่ตรงกับเงื่อนไขการค้นหา" : "No parking areas match your search filter.")}</p></div></div> : null}
    </section>
  );
}
