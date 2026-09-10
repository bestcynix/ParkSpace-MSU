"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Info,
  LoaderCircle,
  MapPin,
  MapPinned,
  Phone,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/parking/StatusBadge";
import type { ParkingStatus } from "@/lib/parking/demo-data";
import { getOperationalTimeWindow } from "@/components/parking/LiveAreaStatus";
import { useNotifications } from "@/components/layout/NotificationProvider";
import { QrPass } from "@/components/booking/QrPass";
import type { AdminBookingItem } from "@/components/admin/AdminBookingsManager";

type ConsoleRole = "admin" | "staff";
export type ConsoleView = "summary" | "operations" | "staff" | "health";
type HealthState = "checking" | "healthy" | "degraded" | "unavailable";
type AreaFilter = "all" | "available" | "reserved" | "occupied" | "closed";
type OpsTab = "areas" | "reserved" | "occupied";

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
  const isTh = locale === "th";
  const { confirm, notify } = useNotifications();
  const searchParams = useSearchParams();
  const urlFilter = searchParams?.get("filter") || searchParams?.get("tab");

  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [summaries, setSummaries] = useState<Record<string, LiveSummary>>({});
  const [incidentCount, setIncidentCount] = useState<number | null>(null);
  const [opStats, setOpStats] = useState<{
    reserved: number;
    occupied: number;
    incidents: number;
    totalBookings: number;
  } | null>(null);
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

  // Operational Tabs & Real Booking Management
  const [activeOpsTab, setActiveOpsTab] = useState<OpsTab>(
    urlFilter === "reserved" ? "reserved" : urlFilter === "occupied" ? "occupied" : "areas"
  );
  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingItem | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  useEffect(() => {
    if (urlFilter === "reserved") {
      setActiveOpsTab("reserved");
    } else if (urlFilter === "occupied") {
      setActiveOpsTab("occupied");
    } else if (urlFilter === "areas") {
      setActiveOpsTab("areas");
    }
  }, [urlFilter]);

  const fetchBookings = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      setLoadingBookings(true);
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/admin/bookings?pageSize=200", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bookings)) {
          setBookings(data.bookings as AdminBookingItem[]);
        }
      }
    } catch {
      // silent catch
    } finally {
      setLoadingBookings(false);
    }
  }, []);

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
      const { startsAt, endsAt } = getOperationalTimeWindow();

      const areasRequest = supabase
        .from("parking_areas")
        .select("id, code, name_th, name_en, capacity, slot_mode, current_status, data_status", { count: "exact" })
        .order("code");
      const capacityRequest = supabase.rpc("get_parking_capacity_by_type", {
        p_area_code: null,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      });
      const statsRequest = fetch("/api/admin/operations/stats")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
      const errorsRequest = supabase
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
      const authRequest = supabase.auth.getUser();

      const [areasResult, capacityResult, statsResult, errorResult, authResult] = await Promise.all([
        areasRequest,
        capacityRequest,
        statsRequest,
        errorsRequest,
        authRequest,
      ]);
      if (!active) return;

      const databaseLatency = Math.round(performance.now() - startedAt);
      const nextErrors: LoadErrors = {
        areas: areasResult.error?.message ?? "",
        capacity: capacityResult.error?.message ?? "",
        incidents: "",
        errors: errorResult.error?.message ?? "",
      };

      if (!areasResult.error) {
        setAreas((areasResult.data ?? []) as AreaRow[]);
        setAreaCount(areasResult.count ?? 0);
      }
      if (!capacityResult.error) setSummaries(summariesFromRows((capacityResult.data ?? []) as CapacityRow[]));
      if (statsResult) {
        setOpStats({
          reserved: statsResult.reserved ?? 0,
          occupied: statsResult.occupied ?? 0,
          incidents: statsResult.incidents ?? 0,
          totalBookings: statsResult.totalBookings ?? 0,
        });
        setIncidentCount(statsResult.incidents ?? 0);
      }
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
      refreshTimer = window.setTimeout(() => {
        void load(false);
        void fetchBookings();
      }, 300);
    }

    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [fetchBookings, isTh, locale, refreshKey, role]);

  const reservedBookings = useMemo(() => {
    return bookings.filter((b) => ["PENDING", "CONFIRMED", "RESERVED"].includes(b.status));
  }, [bookings]);

  const occupiedBookings = useMemo(() => {
    return bookings.filter((b) => ["CHECKED_IN", "OVERSTAY"].includes(b.status));
  }, [bookings]);

  const totals = useMemo(() => {
    const raw = Object.values(summaries).reduce((total, summary) => ({
      total: total.total + summary.total,
      available: total.available + summary.available,
      reserved: total.reserved + summary.reserved,
      occupied: total.occupied + summary.occupied,
      closed: total.closed + summary.closed,
    }), { ...emptySummary });

    const res = opStats?.reserved ?? reservedBookings.length;
    const occ = opStats?.occupied ?? occupiedBookings.length;
    const avail = Math.max(0, raw.total - res - occ - raw.closed);
    return {
      ...raw,
      reserved: res,
      occupied: occ,
      available: raw.total > 0 ? avail : raw.available,
    };
  }, [summaries, opStats, reservedBookings.length, occupiedBookings.length]);

  const filteredAreas = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale === "th" ? "th-TH" : "en-US");
    return areas.filter((area) => {
      const status = areaStatus(area, summaries[area.code.toUpperCase()]);
      const matchesQuery = !normalizedQuery || [area.code, area.name_th, area.name_en]
        .some((value) => value.toLocaleLowerCase(locale === "th" ? "th-TH" : "en-US").includes(normalizedQuery));
      const matchesFilter = filter === "all" || status === filter || (filter === "closed" && status === "full");
      return matchesQuery && matchesFilter;
    });
  }, [areas, filter, locale, query, summaries]);

  // Operational Action Handlers
  async function handleCheckIn(bookingId: string) {
    setTransitioningId(bookingId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/staff/transition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ booking_id: bookingId, action: "CHECK_IN" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");

      notify({
        title: isTh ? "เช็คอินเข้าจอดสำเร็จ" : "Check-in successful",
        message: isTh ? "ยานพาหนะเข้าจอดเรียบร้อยแล้ว ย้ายไปยังแท็บรถที่กำลังจอด" : "Vehicle is now checked-in and moved to active parking.",
        kind: "success",
      });
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, status: "CHECKED_IN" } : null));
      }
      await fetchBookings();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      notify({
        title: isTh ? "เกิดข้อผิดพลาดในการเช็คอิน" : "Check-in error",
        message: err instanceof Error ? err.message : "Error",
        kind: "error",
      });
    } finally {
      setTransitioningId(null);
    }
  }

  async function handleCheckOut(bookingId: string) {
    setTransitioningId(bookingId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/staff/transition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ booking_id: bookingId, action: "CHECK_OUT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-out failed");

      notify({
        title: isTh ? "เช็คเอาท์เสร็จสิ้น" : "Check-out completed",
        message: isTh ? "ยานพาหนะออกจากพื้นที่เรียบร้อยแล้ว ช่องจอดพร้อมใช้งานสำหรับคันต่อไป" : "Vehicle checked out. Slot is now free.",
        kind: "success",
      });
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
      }
      await fetchBookings();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      notify({
        title: isTh ? "เกิดข้อผิดพลาดในการเช็คเอาท์" : "Check-out error",
        message: err instanceof Error ? err.message : "Error",
        kind: "error",
      });
    } finally {
      setTransitioningId(null);
    }
  }

  async function handleCancelOrNoShow(bookingId: string, action: "CANCEL" | "NO_SHOW") {
    const isCancel = action === "CANCEL";
    const ok = await confirm({
      title: isCancel
        ? (isTh ? "ยืนยันยกเลิกการจอง?" : "Confirm Cancel Booking?")
        : (isTh ? "บันทึกไม่มาตามนัด (No-Show)?" : "Mark as No-Show?"),
      message: isTh
        ? `ต้องการดำเนินการเปลี่ยนสถานะรายการนี้เป็น ${isCancel ? "ยกเลิกแล้ว" : "ไม่มาตามนัด"} ใช่หรือไม่?`
        : "Do you want to proceed with this status change?",
      confirmLabel: isTh ? "ยืนยัน" : "Confirm",
      cancelLabel: isTh ? "ปิด" : "Cancel",
      danger: true,
    });
    if (!ok) return;

    setTransitioningId(bookingId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/staff/transition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ booking_id: bookingId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transition failed");

      notify({
        title: isTh ? "ดำเนินการสำเร็จ" : "Action completed",
        kind: "success",
      });
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
      }
      await fetchBookings();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      notify({
        title: isTh ? "เกิดข้อผิดพลาด" : "Error",
        message: err instanceof Error ? err.message : "Error",
        kind: "error",
      });
    } finally {
      setTransitioningId(null);
    }
  }

  async function handleDeleteBooking(bookingId: string, ref: string) {
    if (role !== "admin") {
      notify({
        title: isTh ? "ไม่มีสิทธิ์ลบ" : "Unauthorized",
        message: isTh ? "เจ้าหน้าที่ (Staff) ไม่มีสิทธิ์ลบรายการจอง ต้องเป็น Admin เท่านั้น" : "Only Admin can delete bookings",
        kind: "error",
      });
      return;
    }

    const ok = await confirm({
      title: isTh ? "ยืนยันการลบรายการจอง?" : "Delete Booking?",
      message: isTh
        ? `คุณกำลังจะลบรายการจองรหัส ${ref} ออกจากระบบอย่างถาวร ข้อมูล QR และ Session ที่เกี่ยวข้องจะถูกลบทั้งหมด การดำเนินการนี้ไม่สามารถย้อนกลับได้`
        : `Are you sure you want to permanently delete booking ${ref}?`,
      confirmLabel: isTh ? "ลบรายการถาวร" : "Delete",
      cancelLabel: isTh ? "ยกเลิก" : "Cancel",
      danger: true,
    });
    if (!ok) return;

    setTransitioningId(bookingId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/bookings", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      notify({
        title: isTh ? "ลบรายการจองสำเร็จ" : "Booking deleted",
        message: data.message || ref,
        kind: "success",
      });
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
      }
      await fetchBookings();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      notify({
        title: isTh ? "เกิดข้อผิดพลาดในการลบ" : "Delete error",
        message: err instanceof Error ? err.message : "Error deleting booking",
        kind: "error",
      });
    } finally {
      setTransitioningId(null);
    }
  }

  const unavailable = isTh ? "ไม่พร้อมใช้งาน" : "Unavailable";
  const loadingLabel = isTh ? "กำลังตรวจสอบ…" : "Checking…";
  const liveCountLabel = isTh ? "จำนวนช่องจอดตามเวลาจริง" : "Real-time slot count";
  const incidentLabel = isTh ? "เหตุการณ์ที่ยังไม่ปิด" : "Unresolved incidents";

  type KpiItem = {
    label: string;
    value: string;
    Icon: LucideIcon;
    detail: string;
    state: HealthState;
    href?: string;
    actionLabel?: string;
  };

  const systemHealthKpis: KpiItem[] = [
    { label: "Database", value: health.database === "checking" ? loadingLabel : healthLabel(health.database, locale), Icon: Database, detail: databaseDetail(health, areaCount, locale), state: health.database, href: role === "admin" ? `/${locale}/admin/database` : undefined, actionLabel: role === "admin" ? (isTh ? "ฐานข้อมูล" : "Database") : undefined },
    { label: "Auth / RLS", value: health.auth === "checking" ? loadingLabel : healthLabel(health.auth, locale), Icon: ShieldCheck, detail: authDetail(health.auth, role, locale), state: health.auth, href: role === "admin" ? `/${locale}/admin/users` : undefined, actionLabel: role === "admin" ? (isTh ? "ผู้ใช้" : "Users") : undefined },
    { label: "Realtime", value: health.realtime === "checking" ? loadingLabel : healthLabel(health.realtime, locale), Icon: Radio, detail: realtimeDetail(health.realtime, locale), state: health.realtime, href: role === "admin" ? `/${locale}/admin/traces` : undefined, actionLabel: role === "admin" ? (isTh ? "Traces" : "Traces") : undefined },
    { label: "Errors", value: errorCount == null ? errors.errors ? unavailable : loadingLabel : errorCount.toLocaleString(locale === "th" ? "th-TH" : "en-US"), Icon: AlertTriangle, detail: isTh ? "24 ชั่วโมงล่าสุด" : "Last 24 hours", state: errors.errors ? "unavailable" : errorCount == null ? "checking" : errorCount > 0 ? "degraded" : "healthy", href: role === "admin" ? `/${locale}/admin/errors` : undefined, actionLabel: role === "admin" ? (isTh ? "ดูข้อผิดพลาด" : "Errors") : undefined },
  ];

  const operationsKpis: KpiItem[] = [
    {
      label: t.available,
      value: errors.capacity ? unavailable : loading && !Object.keys(summaries).length ? loadingLabel : totals.available.toLocaleString(locale === "th" ? "th-TH" : "en-US"),
      Icon: Activity,
      detail: liveCountLabel,
      state: errors.capacity ? "unavailable" : "healthy",
      href: `/${locale}/${role}/operations?filter=areas`,
      actionLabel: isTh ? "ดูผังพื้นที่ →" : "View Areas →",
    },
    {
      label: t.reserved,
      value: errors.capacity ? unavailable : loading && !Object.keys(summaries).length ? loadingLabel : totals.reserved.toLocaleString(locale === "th" ? "th-TH" : "en-US"),
      Icon: QrCode,
      detail: isTh ? "คลิกเพื่อกรอง / จัดการรายการจอง" : "Click to view reservations",
      state: errors.capacity ? "unavailable" : "healthy",
      href: `/${locale}/${role}/operations?filter=reserved`,
      actionLabel: isTh ? "ดูรายการจอง →" : "View Bookings →",
    },
    {
      label: t.occupied,
      value: errors.capacity ? unavailable : loading && !Object.keys(summaries).length ? loadingLabel : totals.occupied.toLocaleString(locale === "th" ? "th-TH" : "en-US"),
      Icon: MapPinned,
      detail: isTh ? "คลิกเพื่อกรอง / ตรวจสอบรถที่จอด" : "Click to view parked cars",
      state: errors.capacity ? "unavailable" : "healthy",
      href: `/${locale}/${role}/operations?filter=occupied`,
      actionLabel: isTh ? "ดูรถที่กำลังจอด →" : "View Parked →",
    },
    {
      label: t.incidents,
      value: incidentCount == null ? errors.incidents ? unavailable : loadingLabel : incidentCount.toLocaleString(locale === "th" ? "th-TH" : "en-US"),
      Icon: AlertTriangle,
      detail: incidentLabel,
      state: errors.incidents ? "unavailable" : incidentCount == null ? "checking" : incidentCount > 0 ? "degraded" : "healthy",
      href: `/${locale}/${role}/incidents`,
      actionLabel: isTh ? "จัดการเหตุการณ์ →" : "Manage Incidents →",
    },
  ];

  const kpis = view === "health" ? systemHealthKpis : operationsKpis;

  return (
    <>
      <div className="dashboard-grid" aria-live="polite" aria-busy={loading || refreshing}>
        {kpis.map((kpi) => {
          const cardInner = (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <kpi.Icon size={18} color={healthColor(kpi.state)} />
                {kpi.actionLabel ? (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontWeight: 600 }}>
                    {kpi.actionLabel}
                  </span>
                ) : null}
              </div>
              <p>{kpi.label}</p>
              <strong>{kpi.value}</strong>
              <small style={{ color: healthColor(kpi.state) }}>{kpi.detail}</small>
            </>
          );

          if (kpi.href) {
            return (
              <Link
                href={kpi.href}
                className="dashboard-card"
                key={kpi.label}
                style={{
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {cardInner}
              </Link>
            );
          }

          return (
            <div className="dashboard-card" key={kpi.label}>
              {cardInner}
            </div>
          );
        })}
      </div>
      {view === "operations" ? (
        <OperationsList
          locale={locale}
          role={role}
          areas={areas}
          summaries={summaries}
          filteredAreas={filteredAreas}
          loading={loading}
          refreshing={refreshing}
          errors={errors}
          query={query}
          filter={filter}
          updatedAt={updatedAt}
          onQueryChange={setQuery}
          onFilterChange={setFilter}
          onRefresh={() => {
            setRefreshKey((value) => value + 1);
            void fetchBookings();
          }}
          activeOpsTab={activeOpsTab}
          onTabChange={setActiveOpsTab}
          reservedBookings={reservedBookings}
          occupiedBookings={occupiedBookings}
          loadingBookings={loadingBookings}
          onSelectBooking={setSelectedBooking}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onCancelOrNoShow={handleCancelOrNoShow}
          onDeleteBooking={handleDeleteBooking}
          transitioningId={transitioningId}
        />
      ) : null}

      {view === "staff" ? (
        <StaffOverview
          locale={locale}
          role={role}
          totals={totals}
          incidentCount={incidentCount}
          errors={errors}
          loading={loading}
        />
      ) : null}

      {view === "health" ? (
        <SystemHealth locale={locale} role={role} health={health} areaCount={areaCount} errorCount={errorCount} errors={errors} />
      ) : null}

      {/* Inspect Modal */}
      {selectedBooking ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 20,
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {isTh ? "ตรวจสอบรายละเอียดการจอง & ยานพาหนะ" : "Booking & Vehicle Inspection"}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>
                  {selectedBooking.reference}
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedBooking(null)}
                style={{ width: 32, height: 32 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--canvas)", padding: "12px 16px", borderRadius: 14 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>{isTh ? "ทะเบียนยานพาหนะ" : "License Plate"}</span>
                  <strong style={{ fontSize: 20, color: "var(--foreground)" }}>
                    {selectedBooking.vehicle_snapshot?.plate || selectedBooking.vehicle_snapshot?.plate_number || (isTh ? "ไม่ระบุทะเบียน" : "No plate")}
                  </strong>
                </div>
                <span className={`booking-status ${selectedBooking.status.toLowerCase()}`}>
                  {selectedBooking.status}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div style={{ padding: 12, background: "var(--canvas)", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{isTh ? "พื้นที่จอดรถ" : "Parking Area"}</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>
                    {selectedBooking.parking_areas?.code} · {isTh ? selectedBooking.parking_areas?.name_th : (selectedBooking.parking_areas?.name_en || selectedBooking.parking_areas?.name_th)}
                  </div>
                </div>
                <div style={{ padding: 12, background: "var(--canvas)", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{isTh ? "ช่องจอดที่ระบุ" : "Assigned Slot"}</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>
                    {selectedBooking.parking_slots?.slot_code || (isTh ? "เข้าจอดพื้นที่ทั่วไป (Area Only)" : "General Area")}
                  </div>
                </div>
                <div style={{ padding: 12, background: "var(--canvas)", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{isTh ? "ผู้จอง / ผู้ขับขี่" : "Driver / User"}</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>
                    {selectedBooking.profiles?.full_name || selectedBooking.profiles?.email || (isTh ? "ผู้ใช้ระบบ" : "System User")}
                  </div>
                </div>
                <div style={{ padding: 12, background: "var(--canvas)", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{isTh ? "ช่วงเวลาที่จอง" : "Booking Window"}</span>
                  <div style={{ fontWeight: 600, marginTop: 2, fontSize: 13 }}>
                    {new Date(selectedBooking.starts_at).toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {new Date(selectedBooking.ends_at).toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })} น.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
                <QrPass
                  locale={locale}
                  reference={selectedBooking.reference}
                  payload={selectedBooking.reference}
                  expiresAt={selectedBooking.ends_at}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderTop: "1px solid var(--line)", background: "var(--canvas)", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
              <div>
                {role === "admin" ? (
                  <button
                    type="button"
                    className="danger-button small-button"
                    onClick={() => void handleDeleteBooking(selectedBooking.id, selectedBooking.reference)}
                    disabled={transitioningId === selectedBooking.id}
                  >
                    <Trash2 size={14} />
                    <span>{isTh ? "ลบรายการจอง (Admin)" : "Delete Booking"}</span>
                  </button>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["PENDING", "CONFIRMED", "RESERVED"].includes(selectedBooking.status) ? (
                  <>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => void handleCancelOrNoShow(selectedBooking.id, "NO_SHOW")}
                      disabled={transitioningId === selectedBooking.id}
                    >
                      <span>{isTh ? "ไม่มาตามนัด" : "No-Show"}</span>
                    </button>
                    <button
                      type="button"
                      className="primary-button small-button"
                      onClick={() => void handleCheckIn(selectedBooking.id)}
                      disabled={transitioningId === selectedBooking.id}
                      style={{ background: "#15803d", borderColor: "#15803d", color: "#fff" }}
                    >
                      <CheckCircle2 size={14} />
                      <span>{isTh ? "เช็คอินเข้าจอด" : "Confirm Check-in"}</span>
                    </button>
                  </>
                ) : ["CHECKED_IN", "OVERSTAY"].includes(selectedBooking.status) ? (
                  <>
                    <Link
                      href={`/${locale}/${role}/incidents?area=${selectedBooking.parking_areas?.code || ""}`}
                      className="secondary-button small-button"
                      style={{ textDecoration: "none" }}
                    >
                      <AlertTriangle size={14} />
                      <span>{isTh ? "แจ้งเหตุการณ์" : "Report"}</span>
                    </Link>
                    <button
                      type="button"
                      className="primary-button small-button"
                      onClick={() => void handleCheckOut(selectedBooking.id)}
                      disabled={transitioningId === selectedBooking.id}
                      style={{ background: "#2563eb", borderColor: "#2563eb", color: "#fff" }}
                    >
                      <CheckCircle2 size={14} />
                      <span>{isTh ? "เช็คเอาท์ออก" : "Confirm Exit"}</span>
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="secondary-button small-button"
                  onClick={() => setSelectedBooking(null)}
                >
                  <span>{isTh ? "ปิด" : "Close"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function OperationsList({
  locale,
  role,
  areas,
  summaries,
  filteredAreas,
  loading,
  refreshing,
  errors,
  query,
  filter,
  updatedAt,
  onQueryChange,
  onFilterChange,
  onRefresh,
  activeOpsTab,
  onTabChange,
  reservedBookings,
  occupiedBookings,
  loadingBookings,
  onSelectBooking,
  onCheckIn,
  onCheckOut,
  onCancelOrNoShow,
  onDeleteBooking,
  transitioningId,
}: {
  locale: Locale;
  role: ConsoleRole;
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
  activeOpsTab: OpsTab;
  onTabChange: (tab: OpsTab) => void;
  reservedBookings: AdminBookingItem[];
  occupiedBookings: AdminBookingItem[];
  loadingBookings: boolean;
  onSelectBooking: (b: AdminBookingItem) => void;
  onCheckIn: (id: string) => Promise<void>;
  onCheckOut: (id: string) => Promise<void>;
  onCancelOrNoShow: (id: string, action: "CANCEL" | "NO_SHOW") => Promise<void>;
  onDeleteBooking: (id: string, ref: string) => Promise<void>;
  transitioningId: string | null;
}) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const filters: Array<[AreaFilter, string]> = [
    ["all", t.all],
    ["available", t.available],
    ["reserved", t.reserved],
    ["occupied", t.occupied],
    ["closed", t.closed],
  ];
  const unavailable = isTh ? "อ่านข้อมูลสดไม่ได้" : "Live data is unavailable.";

  function exportOperationsCsv() {
    const header = [
      "Area Code",
      "Area Name",
      "Total Slots",
      "Available Slots",
      "Reserved Slots",
      "Occupied Slots",
      "Occupancy Rate",
      "Operational Status",
    ];
    const rows = areas.map((a) => {
      const s = summaries[a.code.toUpperCase()];
      const total = s?.total ?? a.capacity ?? 0;
      const occ = s?.occupied ?? 0;
      const res = s?.reserved ?? 0;
      const av = s?.available ?? (total - occ - res);
      const pct = total > 0 ? Math.round(((occ + res) / total) * 100) : 0;
      return [
        a.code,
        `"${(isTh ? a.name_th : a.name_en).replaceAll('"', '""')}"`,
        String(total),
        String(av),
        String(res),
        String(occ),
        `${pct}%`,
        s ? areaStatus(a, s) : a.current_status,
      ];
    });
    const csvContent = "\uFEFF" + [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `parkspace-msu-operations-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-label={t.liveOperations}>
      <div className="section-heading">
        <div>
          <h2>{t.liveOperations}</h2>
          <p>
            {filteredAreas.length}/{areas.length} {t.areas}
            {updatedAt ? ` · ${formatUpdatedAt(updatedAt, locale)}` : ""}
          </p>
        </div>
        <div className="inline-actions">
          {role === "admin" ? (
            <Link className="text-link" href={`/${locale}/admin/parking-areas`}>
              {t.areas}
            </Link>
          ) : null}
          <button
            className="secondary-button small-button"
            type="button"
            onClick={exportOperationsCsv}
            title={isTh ? "ส่งออกสถิติพื้นที่จอดรถเป็น CSV" : "Export operations report as CSV"}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Download size={14} />
            <span>{isTh ? "ส่งออก CSV" : "Export CSV"}</span>
          </button>
          <button className="secondary-button small-button" type="button" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
            {t.refreshAvailability}
          </button>
        </div>
      </div>

      {/* Main Operational Switcher Tabs */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", margin: "16px 0 20px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`filter-chip ${activeOpsTab === "areas" ? "active" : ""}`}
            onClick={() => onTabChange("areas")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <MapPinned size={16} />
            <span>{isTh ? "ผังพื้นที่และช่องจอด" : "Parking Areas"}</span>
            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: activeOpsTab === "areas" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)" }}>
              {areas.length}
            </span>
          </button>
          <button
            type="button"
            className={`filter-chip ${activeOpsTab === "reserved" ? "active" : ""}`}
            onClick={() => onTabChange("reserved")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <QrCode size={16} />
            <span>{isTh ? "รายการจองที่ต้องดูแล" : "Active Reservations"}</span>
            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>
              {reservedBookings.length}
            </span>
          </button>
          <button
            type="button"
            className={`filter-chip ${activeOpsTab === "occupied" ? "active" : ""}`}
            onClick={() => onTabChange("occupied")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Car size={16} />
            <span>{isTh ? "รถที่กำลังจอดอยู่" : "Parked Vehicles"}</span>
            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
              {occupiedBookings.length}
            </span>
          </button>
        </div>

        {role === "admin" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href={`/${locale}/admin/parking-areas`}
              className="secondary-button small-button"
              style={{ textDecoration: "none" }}
            >
              <MapPin size={14} />
              <span>{isTh ? "จัดการพื้นที่ (Area Manager)" : "Manage Areas"}</span>
            </Link>
            <Link
              href={`/${locale}/admin/bookings`}
              className="secondary-button small-button"
              style={{ textDecoration: "none" }}
            >
              <Calendar size={14} />
              <span>{isTh ? "จัดการการจองทั้งหมด" : "All Bookings"}</span>
            </Link>
          </div>
        ) : null}
      </div>

      {/* Tab 1: Parking Areas */}
      {activeOpsTab === "areas" ? (
        <>
          <div className="user-search-box">
            <Search size={16} />
            <input
              aria-label={isTh ? "ค้นหาพื้นที่ปฏิบัติการ" : "Search operational areas"}
              placeholder={isTh ? "ค้นหารหัสหรือชื่อพื้นที่ เช่น P01, สาธิต" : "Search area code or name"}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <div className="chip-row" aria-label={isTh ? "กรองสถานะพื้นที่" : "Filter area status"}>
            {filters.map(([key, label]) => (
              <button
                className={`filter-chip ${filter === key ? "active" : ""}`}
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => onFilterChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.areas || errors.capacity ? (
            <div className="form-note" role="alert">
              {unavailable}{" "}
              <button className="text-link" type="button" onClick={onRefresh}>
                {isTh ? "ลองใหม่" : "Retry"}
              </button>
            </div>
          ) : null}
          {loading && !areas.length ? (
            <ConsoleZeroState
              icon={LoaderCircle}
              title={isTh ? "กำลังโหลดข้อมูลสด" : "Loading live data"}
              detail={t.operationalData}
              spinning
            />
          ) : filteredAreas.length ? (
            <div className="ops-grid" style={{ marginTop: 18 }}>
              {filteredAreas.map((area) => {
                const summary = summaries[area.code.toUpperCase()];
                const status = areaStatus(area, summary);
                const areaName = isTh ? area.name_th : area.name_en;
                const isNearCapacity = Boolean(
                  summary?.total &&
                  summary.total > 0 &&
                  (summary.occupied + summary.reserved) / summary.total >= 0.9
                );
                const capacity = summary?.total
                  ? `${summary.available}/${summary.total} ${t.available} (จอง ${summary.reserved} · จอด ${summary.occupied})`
                  : area.capacity != null
                    ? `${area.capacity.toLocaleString(locale === "th" ? "th-TH" : "en-US")} ${isTh ? "ช่องตามข้อมูลพื้นที่" : "area capacity"}`
                    : isTh ? "ไม่มีข้อมูลจำนวนช่อง" : "No slot count";
                return (
                  <Link className="ops-card" href={`/${locale}/parking/${area.code.toLowerCase()}`} key={area.id}>
                    <header>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong>{area.code}</strong>
                        {isNearCapacity ? (
                          <span
                            style={{
                              background: "#fef2f2",
                              color: "#dc2626",
                              border: "1px solid #fca5a5",
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 6,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                            title={isTh ? "อัตราการจอดและจองสูงกว่า 90%" : "Occupancy exceeds 90%"}
                          >
                            <AlertTriangle size={11} />
                            {isTh ? "หนาแน่น (>90%)" : "Near Capacity"}
                          </span>
                        ) : null}
                      </div>
                      <StatusBadge status={status} locale={locale} />
                    </header>
                    <p>
                      {areaName}
                      <br />
                      {capacity}
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <ConsoleZeroState
              icon={Search}
              title={areas.length ? t.noResults : t.noRecords}
              detail={areas.length ? (isTh ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" : "Try a different search or status filter.") : t.operationalData}
            />
          )}
        </>
      ) : null}

      {/* Tab 2: Active Reservations */}
      {activeOpsTab === "reserved" ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {isTh ? "รายการจองที่ต้องดูแล (จองแล้ว)" : "Active Reservations (Reserved)"}
              </h3>
              <p className="page-subtitle" style={{ margin: "2px 0 0" }}>
                {isTh
                  ? `พบ ${reservedBookings.length} รายการจองที่รอการเข้าจอดหรือยืนยันสิทธิ์หน้างาน`
                  : `${reservedBookings.length} reservations waiting for entry verification`}
              </p>
            </div>
          </div>

          {loadingBookings && !reservedBookings.length ? (
            <ConsoleZeroState
              icon={LoaderCircle}
              title={isTh ? "กำลังโหลดรายการจอง…" : "Loading reservations…"}
              detail={t.operationalData}
              spinning
            />
          ) : reservedBookings.length === 0 ? (
            <div className="empty-card">
              <div>
                <CheckCircle2 size={32} color="#16a34a" />
                <h2>{isTh ? "ไม่มีรายการจองที่ค้างอยู่" : "No Pending Reservations"}</h2>
                <p className="page-subtitle">
                  {isTh ? "ยังไม่มีรายการจองใหม่ที่รอการเข้าจอดในขณะนี้" : "All reservations have been processed or checked in."}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {reservedBookings.map((b) => {
                const plate = b.vehicle_snapshot?.plate || b.vehicle_snapshot?.plate_number || (isTh ? "ไม่ระบุทะเบียน" : "No Plate");
                const areaTitle = b.parking_areas?.code ? `${b.parking_areas.code} · ${isTh ? b.parking_areas.name_th : (b.parking_areas.name_en || b.parking_areas.name_th)}` : (isTh ? "พื้นที่ไม่ระบุ" : "Unspecified");
                const slotLabel = b.parking_slots?.slot_code || (isTh ? "ไม่ระบุช่อง" : "General");
                const customerName = b.profiles?.full_name || b.profiles?.email || (isTh ? "ผู้ใช้ระบบ" : "Customer");
                const timeWindow = `${new Date(b.starts_at).toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })} - ${new Date(b.ends_at).toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })} น.`;

                return (
                  <article
                    key={b.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 16,
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 12px",
                            borderRadius: 8,
                            background: "#0f172a",
                            color: "#f8fafc",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: 15,
                            border: "1.5px solid #334155",
                          }}
                        >
                          <Car size={16} />
                          <span>{plate}</span>
                        </span>
                        <strong style={{ fontSize: 14, color: "var(--foreground)" }}>{b.reference}</strong>
                      </div>
                      <span className={`booking-status ${b.status.toLowerCase()}`}>{b.status}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13, color: "var(--muted)" }}>
                      <div>
                        <span>{isTh ? "พื้นที่: " : "Area: "}</span>
                        <strong style={{ color: "var(--foreground)" }}>{areaTitle}</strong>
                      </div>
                      <div>
                        <span>{isTh ? "ช่องจอด: " : "Slot: "}</span>
                        <strong style={{ color: "var(--foreground)" }}>{slotLabel}</strong>
                      </div>
                      <div>
                        <span>{isTh ? "เวลา: " : "Time: "}</span>
                        <strong style={{ color: "var(--foreground)" }}>{timeWindow}</strong>
                      </div>
                      <div>
                        <span>{isTh ? "ผู้จอง: " : "User: "}</span>
                        <strong style={{ color: "var(--foreground)" }}>{customerName}</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => onSelectBooking(b)}
                      >
                        <Search size={14} />
                        <span>{isTh ? "ตรวจสอบ / ดู QR" : "Inspect / QR"}</span>
                      </button>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => void onCancelOrNoShow(b.id, "NO_SHOW")}
                          disabled={transitioningId === b.id}
                        >
                          <span>{isTh ? "ไม่มาตามนัด" : "No-Show"}</span>
                        </button>
                        <button
                          type="button"
                          className="primary-button small-button"
                          onClick={() => void onCheckIn(b.id)}
                          disabled={transitioningId === b.id}
                          style={{ background: "#15803d", borderColor: "#15803d", color: "#fff" }}
                        >
                          <CheckCircle2 size={14} />
                          <span>{isTh ? "เช็คอินเข้าจอด" : "Check-in"}</span>
                        </button>
                        {role === "admin" ? (
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => void onDeleteBooking(b.id, b.reference)}
                            disabled={transitioningId === b.id}
                            title={isTh ? "ลบรายการจอง" : "Delete booking"}
                            style={{ width: 32, height: 32 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Tab 3: Parked Vehicles */}
      {activeOpsTab === "occupied" ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {isTh ? "รถที่กำลังจอดอยู่ (กำลังใช้งาน)" : "Currently Parked Vehicles (Occupied)"}
              </h3>
              <p className="page-subtitle" style={{ margin: "2px 0 0" }}>
                {isTh
                  ? `พบ ${occupiedBookings.length} คันที่เช็คอินเข้าจอดแล้ว ตรวจสอบระยะเวลาและยืนยันการออก`
                  : `${occupiedBookings.length} vehicles currently parked on premises`}
              </p>
            </div>
          </div>

          {loadingBookings && !occupiedBookings.length ? (
            <ConsoleZeroState
              icon={LoaderCircle}
              title={isTh ? "กำลังโหลดข้อมูลรถที่จอด…" : "Loading parked vehicles…"}
              detail={t.operationalData}
              spinning
            />
          ) : occupiedBookings.length === 0 ? (
            <div className="empty-card">
              <div>
                <Car size={32} color="#64748b" />
                <h2>{isTh ? "ไม่มีรถจอดอยู่ในระบบขณะนี้" : "No Parked Vehicles"}</h2>
                <p className="page-subtitle">
                  {isTh ? "ยังไม่มียานพาหนะใดเช็คอินเข้าพื้นที่ในขณะนี้" : "All slots are clear."}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {occupiedBookings.map((b) => {
                const plate = b.vehicle_snapshot?.plate || b.vehicle_snapshot?.plate_number || (isTh ? "ไม่ระบุทะเบียน" : "No Plate");
                const areaTitle = b.parking_areas?.code ? `${b.parking_areas.code} · ${isTh ? b.parking_areas.name_th : (b.parking_areas.name_en || b.parking_areas.name_th)}` : (isTh ? "พื้นที่ไม่ระบุ" : "Unspecified");
                const slotLabel = b.parking_slots?.slot_code || (isTh ? "ไม่ระบุช่อง" : "General");
                const customerName = b.profiles?.full_name || b.profiles?.email || (isTh ? "ผู้ใช้ระบบ" : "Customer");
                const isOverstay = b.status === "OVERSTAY" || new Date().getTime() > new Date(b.ends_at).getTime();

                return (
                  <article
                    key={b.id}
                    style={{
                      background: "var(--surface)",
                      border: isOverstay ? "1.5px solid #ef4444" : "1px solid var(--line)",
                      borderRadius: 16,
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 12px",
                            borderRadius: 8,
                            background: "#0f172a",
                            color: "#f8fafc",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: 15,
                            border: "1.5px solid #334155",
                          }}
                        >
                          <Car size={16} />
                          <span>{plate}</span>
                        </span>
                        <strong style={{ fontSize: 14, color: "var(--foreground)" }}>{b.reference}</strong>
                      </div>
                      <span className={`booking-status ${isOverstay ? "overstay" : "checked_in"}`}>
                        {isOverstay ? (isTh ? "เลยเวลาจอด" : "OVERSTAY") : (isTh ? "กำลังจอด" : "CHECKED_IN")}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13, color: "var(--muted)" }}>
                      <div>
                        <span>{isTh ? "จอดที่: " : "Location: "}</span>
                        <strong style={{ color: "var(--foreground)" }}>{areaTitle}</strong>
                      </div>
                      <div>
                        <span>{isTh ? "ช่องจอด: " : "Slot: "}</span>
                        <strong style={{ color: "var(--foreground)" }}>{slotLabel}</strong>
                      </div>
                      <div>
                        <span>{isTh ? "กำหนดออก: " : "Exit by: "}</span>
                        <strong style={{ color: isOverstay ? "#ef4444" : "var(--foreground)" }}>
                          {new Date(b.ends_at).toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })} น.
                        </strong>
                      </div>
                      <div>
                        <span>{isTh ? "ผู้ขับขี่: " : "Driver: "}</span>
                        <strong style={{ color: "var(--foreground)" }}>{customerName}</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => onSelectBooking(b)}
                      >
                        <Search size={14} />
                        <span>{isTh ? "ตรวจสอบ" : "Inspect"}</span>
                      </button>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Link
                          href={`/${locale}/${role}/incidents?area=${b.parking_areas?.code || ""}`}
                          className="secondary-button small-button"
                          style={{ textDecoration: "none" }}
                        >
                          <AlertTriangle size={14} />
                          <span>{isTh ? "แจ้งเหตุการณ์" : "Report"}</span>
                        </Link>
                        <button
                          type="button"
                          className="primary-button small-button"
                          onClick={() => void onCheckOut(b.id)}
                          disabled={transitioningId === b.id}
                          style={{ background: "#2563eb", borderColor: "#2563eb", color: "#fff" }}
                        >
                          <CheckCircle2 size={14} />
                          <span>{isTh ? "ยืนยันออก / เช็คเอาท์" : "Confirm Exit"}</span>
                        </button>
                        {role === "admin" ? (
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => void onDeleteBooking(b.id, b.reference)}
                            disabled={transitioningId === b.id}
                            title={isTh ? "ลบรายการจอง" : "Delete booking"}
                            style={{ width: 32, height: 32 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function StaffOverview({
  locale,
  role,
  totals,
  incidentCount,
  errors,
  loading,
}: {
  locale: Locale;
  role: ConsoleRole;
  totals: LiveSummary;
  incidentCount: number | null;
  errors: LoadErrors;
  loading: boolean;
}) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const unavailable = isTh ? "ไม่พร้อมใช้งาน" : "Unavailable";
  const checking = isTh ? "กำลังตรวจสอบ…" : "Checking…";
  const count = (value: number, hasError: boolean) =>
    hasError ? unavailable : loading ? checking : value.toLocaleString(locale === "th" ? "th-TH" : "en-US");

  return (
    <>
      <div className="info-card" style={{ padding: 20, marginTop: 24 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{t.scanQr}</h2>
        <p className="page-subtitle">
          {isTh
            ? "สแกน QR แล้วตรวจสอบรถก่อนยืนยัน Check-in หรือ Check-out ออกจากพื้นที่"
            : "Scan a QR pass to verify and confirm vehicle Check-in or Check-out."}
        </p>
        <Link className="primary-button" style={{ marginTop: 16 }} href={`/${locale}/staff/scan`}>
          <QrCode size={16} />
          {t.scanQr}
        </Link>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {isTh ? "สรุปปฏิบัติการเร่งด่วนประจำวัน" : "Daily Operational Summary"}
          </h3>
          <Link href={`/${locale}/${role}/operations`} className="text-link" style={{ fontSize: 13 }}>
            {isTh ? "ดูคอนโซลปฏิบัติการเต็มรูปแบบ →" : "Full Operations Console →"}
          </Link>
        </div>

        <div className="status-list" aria-live="polite">
          <Link
            href={`/${locale}/${role}/operations?filter=reserved`}
            className="status-list-row"
            style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <QrCode size={15} color="#d97706" />
              <span>{t.reserved} (จองแล้ว)</span>
            </span>
            <strong style={{ color: "#d97706" }}>
              {count(totals.reserved, Boolean(errors.capacity))} รายการ →
            </strong>
          </Link>
          <Link
            href={`/${locale}/${role}/operations?filter=occupied`}
            className="status-list-row"
            style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Car size={15} color="#16a34a" />
              <span>{t.occupied} (กำลังใช้งาน)</span>
            </span>
            <strong style={{ color: "#16a34a" }}>
              {count(totals.occupied, Boolean(errors.capacity))} คัน →
            </strong>
          </Link>
          <Link
            href={`/${locale}/${role}/incidents`}
            className="status-list-row"
            style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} color="#ef4444" />
              <span>{t.incidents} (เหตุการณ์ที่ยังไม่ปิด)</span>
            </span>
            <strong style={{ color: "#ef4444" }}>
              {errors.incidents ? unavailable : incidentCount == null ? checking : incidentCount.toLocaleString(isTh ? "th-TH" : "en-US")} เรื่อง →
            </strong>
          </Link>
        </div>
      </div>
    </>
  );
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
