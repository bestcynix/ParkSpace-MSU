"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Database, FileText, LoaderCircle, MapPinned, QrCode, Radio, RefreshCw, Search, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/parking/StatusBadge";
import type { ParkingStatus } from "@/lib/parking/demo-data";

type ConsoleRole = "admin" | "staff";
export type ConsoleView = "summary" | "operations" | "staff" | "health";
type HealthState = "checking" | "healthy" | "degraded" | "unavailable";
type AreaFilter = "all" | "available" | "reserved" | "occupied" | "closed";

type AreaRow = {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  capacity: number | null;
  slot_mode: "AREA_ONLY" | "INDIVIDUAL_SLOT";
  current_status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "FULL" | "CLOSED";
  data_status: "DRAFT" | "AWAITING_VERIFICATION" | "VERIFIED" | "OUTDATED";
};

type CapacityRow = {
  area_code?: string | null;
  total_slots?: number | string | null;
  available_slots?: number | string | null;
  reserved_slots?: number | string | null;
  occupied_slots?: number | string | null;
  closed_slots?: number | string | null;
};

type LiveSummary = {
  total: number;
  available: number;
  reserved: number;
  occupied: number;
  closed: number;
};

type HealthSnapshot = {
  database: HealthState;
  auth: HealthState;
  realtime: HealthState;
  databaseLatency: number | null;
};

type LoadErrors = {
  areas: string;
  capacity: string;
  incidents: string;
  errors: string;
};

const emptySummary: LiveSummary = { total: 0, available: 0, reserved: 0, occupied: 0, closed: 0 };
const initialHealth: HealthSnapshot = { database: "checking", auth: "checking", realtime: "checking", databaseLatency: null };
const initialErrors: LoadErrors = { areas: "", capacity: "", incidents: "", errors: "" };

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function summariesFromRows(rows: CapacityRow[]) {
  const summaries: Record<string, LiveSummary> = {};
  for (const row of rows) {
    const code = row.area_code?.toUpperCase();
    if (!code) continue;
    const current = summaries[code] ?? { ...emptySummary };
    current.total += numeric(row.total_slots);
    current.available += numeric(row.available_slots);
    current.reserved += numeric(row.reserved_slots);
    current.occupied += numeric(row.occupied_slots);
    current.closed += numeric(row.closed_slots);
    summaries[code] = current;
  }
  return summaries;
}

function areaStatus(area: AreaRow, summary: LiveSummary | undefined): ParkingStatus {
  if (summary?.total) {
    if (summary.closed >= summary.total) return "closed";
    if (summary.available > 0) return "available";
    if (summary.occupied > 0) return "occupied";
    if (summary.reserved > 0) return "reserved";
    return "full";
  }
  return area.current_status.toLowerCase() as ParkingStatus;
}

function healthColor(state: HealthState) {
  if (state === "healthy") return "#2b9d65";
  if (state === "checking") return "#8a741f";
  return "#b64848";
}

export function ConsoleLiveData({ locale, role, view }: { locale: Locale; role: ConsoleRole; view: ConsoleView }) {
  const t = getCopy(locale);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [summaries, setSummaries] = useState<Record<string, LiveSummary>>({});
  const [incidentCount, setIncidentCount] = useState<number | null>(null);
  const [errorCount, setErrorCount] = useState<number | null>(null);
  const [areaCount, setAreaCount] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthSnapshot>(initialHealth);
  const [errors, setErrors] = useState<LoadErrors>(initialErrors);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AreaFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;

    if (!isSupabaseConfigured()) {
      const timer = window.setTimeout(() => {
        setLoading(false);
        setHealth({ database: "unavailable", auth: "unavailable", realtime: "unavailable", databaseLatency: null });
        setErrors({
          areas: locale === "th" ? "ยังไม่ได้ตั้งค่า Supabase" : "Supabase is not configured.",
          capacity: locale === "th" ? "ยังไม่ได้ตั้งค่า Supabase" : "Supabase is not configured.",
          incidents: locale === "th" ? "ยังไม่ได้ตั้งค่า Supabase" : "Supabase is not configured.",
          errors: locale === "th" ? "ยังไม่ได้ตั้งค่า Supabase" : "Supabase is not configured.",
        });
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    const supabase = createSupabaseBrowserClient();

    async function load(showBusyState: boolean) {
      if (showBusyState) setRefreshing(true);
      const startedAt = performance.now();
      const now = new Date();
      const endsAt = new Date(now.getTime() + 60 * 60 * 1000);

      const areasRequest = supabase
        .from("parking_areas")
        .select("id, code, name_th, name_en, capacity, slot_mode, current_status, data_status", { count: "exact" })
        .order("code");
      const capacityRequest = supabase.rpc("get_parking_capacity_by_type", {
        p_area_code: null,
        p_starts_at: now.toISOString(),
        p_ends_at: endsAt.toISOString(),
      });
      const incidentsRequest = supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .neq("status", "RESOLVED");
      const errorsRequest = supabase
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
      const authRequest = supabase.auth.getUser();

      const [areasResult, capacityResult, incidentsResult, errorResult, authResult] = await Promise.all([
        areasRequest,
        capacityRequest,
        incidentsRequest,
        errorsRequest,
        authRequest,
      ]);
      if (!active) return;

      const databaseLatency = Math.round(performance.now() - startedAt);
      const nextErrors: LoadErrors = {
        areas: areasResult.error?.message ?? "",
        capacity: capacityResult.error?.message ?? "",
        incidents: incidentsResult.error?.message ?? "",
        errors: errorResult.error?.message ?? "",
      };

      if (!areasResult.error) {
        setAreas((areasResult.data ?? []) as AreaRow[]);
        setAreaCount(areasResult.count ?? 0);
      }
      if (!capacityResult.error) setSummaries(summariesFromRows((capacityResult.data ?? []) as CapacityRow[]));
      if (!incidentsResult.error && incidentsResult.count != null) setIncidentCount(incidentsResult.count);
      if (!errorResult.error && errorResult.count != null) setErrorCount(errorResult.count);

      let authState: HealthState = authResult.error || !authResult.data.user ? "unavailable" : "healthy";
      if (authState === "healthy" && authResult.data.user) {
        const roleResult = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authResult.data.user.id);
        if (!active) return;
        const userRoles = (roleResult.data ?? []).map((r: { role: string }) => String(r.role).toLowerCase().trim());
        const allowedRoles = role === "staff" ? ["staff", "admin"] : ["admin"];
        const hasRole = userRoles.some((r: string) => allowedRoles.includes(r));
        authState = roleResult.error || !hasRole ? "degraded" : "healthy";
      }

      setErrors(nextErrors);
      setHealth((current) => ({
        ...current,
        database: areasResult.error ? "unavailable" : capacityResult.error ? "degraded" : "healthy",
        auth: authState,
        databaseLatency,
      }));
      setUpdatedAt(new Date());
      setLoading(false);
      setRefreshing(false);
    }

    void load(true);

    const channel = supabase
      .channel(`console-live-${role}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_areas" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_slots" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "error_logs" }, () => scheduleRefresh())
      .subscribe((status: string) => {
        if (!active) return;
        const realtime: HealthState = status === "SUBSCRIBED" ? "healthy" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "unavailable" : "degraded";
        setHealth((current) => ({ ...current, realtime }));
      });

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { void load(false); }, 300);
    }

    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [locale, refreshKey, role]);

  const totals = useMemo(() => Object.values(summaries).reduce((total, summary) => ({
    total: total.total + summary.total,
    available: total.available + summary.available,
    reserved: total.reserved + summary.reserved,
    occupied: total.occupied + summary.occupied,
    closed: total.closed + summary.closed,
  }), { ...emptySummary }), [summaries]);

  const filteredAreas = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale === "th" ? "th-TH" : "en-US");
    return areas.filter((area) => {
      const status = areaStatus(area, summaries[area.code.toUpperCase()]);
      const matchesQuery = !normalizedQuery || [area.code, area.name_th, area.name_en]
        .some((value) => value.toLocaleLowerCase(locale === "th" ? "th-TH" : "en-US").includes(normalizedQuery));
      const matchesFilter = filter === "all" || status === filter || filter === "closed" && status === "full";
      return matchesQuery && matchesFilter;
    });
  }, [areas, filter, locale, query, summaries]);

  const unavailable = locale === "th" ? "ไม่พร้อมใช้งาน" : "Unavailable";
  const loadingLabel = locale === "th" ? "กำลังตรวจสอบ…" : "Checking…";
  const liveCountLabel = locale === "th" ? "จำนวนช่องจอดตามเวลาจริง" : "Real-time slot count";
  const incidentLabel = locale === "th" ? "เหตุการณ์ที่ยังไม่ปิด" : "Unresolved incidents";
  const systemHealthKpis: Array<[string, string, LucideIcon, string, HealthState]> = [
    ["Database", health.database === "checking" ? loadingLabel : healthLabel(health.database, locale), Database, databaseDetail(health, areaCount, locale), health.database],
    ["Auth / RLS", health.auth === "checking" ? loadingLabel : healthLabel(health.auth, locale), ShieldCheck, authDetail(health.auth, role, locale), health.auth],
    ["Realtime", health.realtime === "checking" ? loadingLabel : healthLabel(health.realtime, locale), Radio, realtimeDetail(health.realtime, locale), health.realtime],
    ["Errors", errorCount == null ? errors.errors ? unavailable : loadingLabel : errorCount.toLocaleString(locale === "th" ? "th-TH" : "en-US"), AlertTriangle, locale === "th" ? "24 ชั่วโมงล่าสุด" : "Last 24 hours", errors.errors ? "unavailable" : errorCount == null ? "checking" : errorCount > 0 ? "degraded" : "healthy"],
  ];
  const operationsKpis: Array<[string, string, LucideIcon, string, HealthState]> = [
    [t.available, errors.capacity ? unavailable : loading && !Object.keys(summaries).length ? loadingLabel : totals.available.toLocaleString(locale === "th" ? "th-TH" : "en-US"), Activity, liveCountLabel, errors.capacity ? "unavailable" : "healthy"],
    [t.reserved, errors.capacity ? unavailable : loading && !Object.keys(summaries).length ? loadingLabel : totals.reserved.toLocaleString(locale === "th" ? "th-TH" : "en-US"), QrCode, liveCountLabel, errors.capacity ? "unavailable" : "healthy"],
    [t.occupied, errors.capacity ? unavailable : loading && !Object.keys(summaries).length ? loadingLabel : totals.occupied.toLocaleString(locale === "th" ? "th-TH" : "en-US"), MapPinned, liveCountLabel, errors.capacity ? "unavailable" : "healthy"],
    [t.incidents, incidentCount == null ? errors.incidents ? unavailable : loadingLabel : incidentCount.toLocaleString(locale === "th" ? "th-TH" : "en-US"), AlertTriangle, incidentLabel, errors.incidents ? "unavailable" : incidentCount == null ? "checking" : incidentCount > 0 ? "degraded" : "healthy"],
  ];
  const kpis = view === "health" ? systemHealthKpis : operationsKpis;

  return (
    <>
      <div className="dashboard-grid" aria-live="polite" aria-busy={loading || refreshing}>
        {kpis.map(([label, value, Icon, detail, state]) => <div className="dashboard-card" key={label}><Icon size={18} color={healthColor(state)} /><p>{label}</p><strong>{value}</strong><small style={{ color: healthColor(state) }}>{detail}</small></div>)}
      </div>
      {view === "operations" ? <OperationsList locale={locale} areas={areas} summaries={summaries} filteredAreas={filteredAreas} loading={loading} refreshing={refreshing} errors={errors} query={query} filter={filter} updatedAt={updatedAt} onQueryChange={setQuery} onFilterChange={setFilter} onRefresh={() => setRefreshKey((value) => value + 1)} /> : null}
      {view === "staff" ? <StaffOverview locale={locale} totals={totals} incidentCount={incidentCount} errors={errors} loading={loading} /> : null}
      {view === "health" ? <SystemHealth locale={locale} role={role} health={health} areaCount={areaCount} errorCount={errorCount} errors={errors} /> : null}
    </>
  );
}

function OperationsList({ locale, areas, summaries, filteredAreas, loading, refreshing, errors, query, filter, updatedAt, onQueryChange, onFilterChange, onRefresh }: {
  locale: Locale;
  areas: AreaRow[];
  summaries: Record<string, LiveSummary>;
  filteredAreas: AreaRow[];
  loading: boolean;
  refreshing: boolean;
  errors: LoadErrors;
  query: string;
  filter: AreaFilter;
  updatedAt: Date | null;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: AreaFilter) => void;
  onRefresh: () => void;
}) {
  const t = getCopy(locale);
  const filters: Array<[AreaFilter, string]> = [["all", t.all], ["available", t.available], ["reserved", t.reserved], ["occupied", t.occupied], ["closed", t.closed]];
  const unavailable = locale === "th" ? "อ่านข้อมูลสดไม่ได้" : "Live data is unavailable.";

  return <section aria-label={t.liveOperations}>
    <div className="section-heading">
      <div><h2>{t.liveOperations}</h2><p>{filteredAreas.length}/{areas.length} {t.areas}{updatedAt ? ` · ${formatUpdatedAt(updatedAt, locale)}` : ""}</p></div>
      <div className="inline-actions"><Link className="text-link" href={`/${locale}/admin/parking-areas`}>{t.areas}</Link><button className="secondary-button small-button" type="button" onClick={onRefresh} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "spin" : undefined} />{t.refreshAvailability}</button></div>
    </div>
    <div className="user-search-box"><Search size={16} /><input aria-label={locale === "th" ? "ค้นหาพื้นที่ปฏิบัติการ" : "Search operational areas"} placeholder={locale === "th" ? "ค้นหารหัสหรือชื่อพื้นที่" : "Search area code or name"} value={query} onChange={(event) => onQueryChange(event.target.value)} /></div>
    <div className="chip-row" aria-label={locale === "th" ? "กรองสถานะพื้นที่" : "Filter area status"}>{filters.map(([key, label]) => <button className={`filter-chip ${filter === key ? "active" : ""}`} key={key} type="button" aria-pressed={filter === key} onClick={() => onFilterChange(key)}>{label}</button>)}</div>
    {errors.areas || errors.capacity ? <div className="form-note" role="alert">{unavailable} <button className="text-link" type="button" onClick={onRefresh}>{locale === "th" ? "ลองใหม่" : "Retry"}</button></div> : null}
    {loading && !areas.length ? <ConsoleZeroState icon={LoaderCircle} title={locale === "th" ? "กำลังโหลดข้อมูลสด" : "Loading live data"} detail={t.operationalData} spinning />
      : filteredAreas.length ? <div className="ops-grid" style={{ marginTop: 18 }}>{filteredAreas.map((area) => {
        const summary = summaries[area.code.toUpperCase()];
        const status = areaStatus(area, summary);
        const areaName = locale === "th" ? area.name_th : area.name_en;
        const capacity = summary?.total ? `${summary.available}/${summary.total} ${t.available}` : area.capacity != null ? `${area.capacity.toLocaleString(locale === "th" ? "th-TH" : "en-US")} ${locale === "th" ? "ช่องตามข้อมูลพื้นที่" : "area capacity"}` : locale === "th" ? "ไม่มีข้อมูลจำนวนช่อง" : "No slot count";
        return <Link className="ops-card" href={`/${locale}/parking/${area.code.toLowerCase()}`} key={area.id}><header><strong>{area.code}</strong><StatusBadge status={status} locale={locale} /></header><p>{areaName}<br />{capacity} · {area.data_status}</p></Link>;
      })}</div>
        : <ConsoleZeroState icon={Search} title={areas.length ? t.noResults : t.noRecords} detail={areas.length ? (locale === "th" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" : "Try a different search or status filter.") : t.operationalData} />}
  </section>;
}

function StaffOverview({ locale, totals, incidentCount, errors, loading }: { locale: Locale; totals: LiveSummary; incidentCount: number | null; errors: LoadErrors; loading: boolean }) {
  const t = getCopy(locale);
  const unavailable = locale === "th" ? "ไม่พร้อมใช้งาน" : "Unavailable";
  const checking = locale === "th" ? "กำลังตรวจสอบ…" : "Checking…";
  const count = (value: number, hasError: boolean) => hasError ? unavailable : loading ? checking : value.toLocaleString(locale === "th" ? "th-TH" : "en-US");

  return <>
    <div className="info-card" style={{ padding: 20, marginTop: 24 }}><h2 style={{ margin: 0, fontSize: 19 }}>{t.scanQr}</h2><p className="page-subtitle">{locale === "th" ? "สแกน QR แล้วตรวจสอบรถก่อนยืนยัน Check-in" : "Scan a QR, verify the vehicle, then confirm Check-in."}</p><Link className="primary-button" style={{ marginTop: 16 }} href={`/${locale}/staff/scan`}><QrCode size={16} />{t.scanQr}</Link></div>
    <div className="status-list" aria-live="polite">
      <div className="status-list-row"><span>{t.reserved}</span><strong>{count(totals.reserved, Boolean(errors.capacity))}</strong></div>
      <div className="status-list-row"><span>{t.occupied}</span><strong>{count(totals.occupied, Boolean(errors.capacity))}</strong></div>
      <div className="status-list-row"><span>{t.incidents}</span><strong>{errors.incidents ? unavailable : incidentCount == null ? checking : incidentCount.toLocaleString(locale === "th" ? "th-TH" : "en-US")}</strong></div>
    </div>
  </>;
}

function SystemHealth({ locale, role, health, areaCount, errorCount, errors }: { locale: Locale; role: ConsoleRole; health: HealthSnapshot; areaCount: number | null; errorCount: number | null; errors: LoadErrors }) {
  const t = getCopy(locale);
  const rows: Array<[string, HealthState, string]> = [
    ["Database", health.database, databaseDetail(health, areaCount, locale)],
    ["Auth / RLS", health.auth, authDetail(health.auth, role, locale)],
    ["API / Realtime", health.realtime, realtimeDetail(health.realtime, locale)],
    [locale === "th" ? "ข้อผิดพลาด 24 ชม." : "Errors, 24h", errors.errors ? "unavailable" : errorCount == null ? "checking" : errorCount > 0 ? "degraded" : "healthy", errorCount == null ? (errors.errors || (locale === "th" ? "กำลังตรวจสอบ" : "Checking")) : errorCount.toLocaleString(locale === "th" ? "th-TH" : "en-US")],
  ];

  return <><div className="info-card" style={{ padding: 20, marginTop: 24 }}><h2 style={{ margin: 0, fontSize: 19 }}>{t.systemHealth}</h2><p className="page-subtitle">{locale === "th" ? "สถานะการทำงานระบบ ParkSpace MSU สำหรับผู้ดูแลระบบ" : "System operational state for authorized administrators."}</p><div className="status-list">{rows.map(([label, state, detail]) => <div className="status-list-row" key={label}><span>{label}</span><strong style={{ color: healthColor(state) }}>{healthLabel(state, locale)} · {detail}</strong></div>)}</div></div><p className="footer-note"><FileText size={12} style={{ verticalAlign: "-2px" }} /> {t.noPrivateData}</p></>;
}

function ConsoleZeroState({ icon: Icon, title, detail, spinning = false }: { icon: LucideIcon; title: string; detail: string; spinning?: boolean }) {
  return <div className="empty-card"><div><div className="empty-icon"><Icon size={25} className={spinning ? "spin" : undefined} /></div><h2>{title}</h2><p>{detail}</p></div></div>;
}

function healthLabel(state: HealthState, locale: Locale) {
  if (state === "checking") return locale === "th" ? "กำลังตรวจสอบ" : "Checking";
  if (state === "healthy") return locale === "th" ? "ปกติ" : "Healthy";
  if (state === "degraded") return locale === "th" ? "มีข้อจำกัด" : "Degraded";
  return locale === "th" ? "ไม่พร้อมใช้งาน" : "Unavailable";
}

function databaseDetail(health: HealthSnapshot, areaCount: number | null, locale: Locale) {
  if (health.database === "checking") return locale === "th" ? "กำลังทดสอบการอ่านข้อมูล" : "Testing database reads";
  if (health.database === "unavailable") return locale === "th" ? "อ่านฐานข้อมูลไม่สำเร็จ" : "Database read failed";
  const areas = areaCount == null ? "" : locale === "th" ? `${areaCount.toLocaleString("th-TH")} พื้นที่` : `${areaCount.toLocaleString("en-US")} areas`;
  const latency = health.databaseLatency == null ? "" : `${health.databaseLatency} ms`;
  return [areas, latency].filter(Boolean).join(" · ");
}

function authDetail(state: HealthState, role: ConsoleRole, locale: Locale) {
  if (state === "checking") return locale === "th" ? "กำลังตรวจสอบเซสชันและสิทธิ์" : "Checking session and role";
  if (state === "healthy") return locale === "th" ? `ยืนยันสิทธิ์ ${role} ผ่าน RLS` : `${role} role verified through RLS`;
  if (state === "degraded") return locale === "th" ? "เซสชันใช้ได้ แต่ตรวจสอบสิทธิ์ไม่สำเร็จ" : "Session works, but role verification failed";
  return locale === "th" ? "ตรวจสอบเซสชันไม่สำเร็จ" : "Session verification failed";
}

function realtimeDetail(state: HealthState, locale: Locale) {
  if (state === "checking") return locale === "th" ? "กำลังเชื่อมต่อช่องข้อมูลสด" : "Connecting to the live channel";
  if (state === "healthy") return locale === "th" ? "เชื่อมต่อและรอรับการเปลี่ยนแปลง" : "Connected and listening for changes";
  if (state === "degraded") return locale === "th" ? "กำลังเชื่อมต่อใหม่" : "Reconnecting";
  return locale === "th" ? "ช่องข้อมูลสดเชื่อมต่อไม่ได้" : "Live channel connection failed";
}

function formatUpdatedAt(value: Date, locale: Locale) {
  return value.toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
