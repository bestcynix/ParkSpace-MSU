"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  Car,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Clock3,
  Edit3,
  ExternalLink,
  Filter,
  LogOut,
  MapPin,
  Navigation,
  PlusCircle,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { QrPass } from "@/components/booking/QrPass";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type Booking = {
  id: string;
  reference: string;
  booking_date: string;
  starts_at: string;
  ends_at: string;
  status: string;
  booking_mode: "AREA_ONLY" | "INDIVIDUAL_SLOT";
  parking_area_id: string;
  parking_slot_id: string | null;
  vehicle_snapshot: { plate?: string } | null;
};

type AreaInfo = {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
};

type QrRow = { qr_payload?: string; expires_at?: string; qr_reference?: string };

function renderStatusBadge(status: string, locale: Locale) {
  const isTh = locale === "th";
  const upper = (status || "").toUpperCase();
  switch (upper) {
    case "PENDING":
      return (
        <span className="booking-status pending">
          <Clock size={12} strokeWidth={2.3} />
          <span>{isTh ? "รอดำเนินการ (รอเข้าจอด)" : "Pending (Awaiting Check-in)"}</span>
        </span>
      );
    case "CONFIRMED":
      return (
        <span className="booking-status confirmed">
          <CalendarCheck size={12} strokeWidth={2.3} />
          <span>{isTh ? "ยืนยันแล้ว" : "Confirmed"}</span>
        </span>
      );
    case "RESERVED":
      return (
        <span className="booking-status reserved">
          <CheckCircle2 size={12} strokeWidth={2.3} />
          <span>{isTh ? "จองแล้ว" : "Reserved"}</span>
        </span>
      );
    case "CHECKED_IN":
      return (
        <span className="booking-status checked_in">
          <Car size={12} strokeWidth={2.3} />
          <span>{isTh ? "เช็คอินแล้ว (กำลังจอด)" : "Checked In (Parked)"}</span>
        </span>
      );
    case "OVERSTAY":
      return (
        <span className="booking-status overstay">
          <AlertTriangle size={12} strokeWidth={2.3} />
          <span>{isTh ? "จอดเกินเวลา" : "Overstay"}</span>
        </span>
      );
    case "COMPLETED":
    case "CHECKED_OUT":
      return (
        <span className="booking-status completed">
          <CheckCheck size={12} strokeWidth={2.3} />
          <span>{isTh ? "เสร็จสิ้น / เช็คเอาท์แล้ว" : "Completed / Checked Out"}</span>
        </span>
      );
    case "CANCELLED":
    case "REJECTED":
      return (
        <span className="booking-status cancelled">
          <XCircle size={12} strokeWidth={2.3} />
          <span>{isTh ? "ยกเลิกแล้ว" : "Cancelled"}</span>
        </span>
      );
    case "NO_SHOW":
      return (
        <span className="booking-status no_show">
          <CircleAlert size={12} strokeWidth={2.3} />
          <span>{isTh ? "ไม่มาใช้บริการ" : "No Show"}</span>
        </span>
      );
    case "EXPIRED":
      return (
        <span className="booking-status expired">
          <Clock size={12} strokeWidth={2.3} />
          <span>{isTh ? "หมดอายุ" : "Expired"}</span>
        </span>
      );
    default:
      return (
        <span className="booking-status pending">
          <span>{status}</span>
        </span>
      );
  }
}

export function BookingsList({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [areaMap, setAreaMap] = useState<Record<string, AreaInfo>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [qrLoadingId, setQrLoadingId] = useState("");
  const [qrPass, setQrPass] = useState<{ bookingId: string; reference: string; payload: string | null; expiresAt: string | null } | null>(null);

  // Search, filter, pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Edit modal
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editPlate, setEditPlate] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const { confirm, notify } = useNotifications();

  const loadBookings = useCallback(async () => {
    const copy = getCopy(locale);
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setMessage(copy.signInRequired);
        return;
      }
      const { data, error } = await supabase.from("bookings").select("id, reference, booking_date, starts_at, ends_at, status, booking_mode, parking_area_id, parking_slot_id, vehicle_snapshot").order("created_at", { ascending: false });
      if (error) throw error;
      setBookings((data ?? []) as Booking[]);
      const { data: areas } = await supabase.from("parking_areas").select("id, code, name_th, name_en, latitude, longitude");
      const mapped: Record<string, AreaInfo> = {};
      for (const a of (areas ?? []) as Array<{ id: string; code: string; name_th: string; name_en: string; latitude: number | null; longitude: number | null }>) {
        mapped[a.id] = {
          id: a.id,
          code: a.code,
          name: isTh ? a.name_th : a.name_en,
          latitude: Number(a.latitude) || 16.2425,
          longitude: Number(a.longitude) || 103.247,
        };
      }
      setAreaMap(mapped);
    } catch (error) {
      if (error && typeof error === "object") {
        const detail = error as { code?: unknown; status?: unknown; message?: unknown };
        console.error("[bookings] Supabase read failed", JSON.stringify({
          code: typeof detail.code === "string" ? detail.code : undefined,
          status: typeof detail.status === "number" ? detail.status : undefined,
          message: typeof detail.message === "string" ? detail.message : undefined,
        }));
      }
      setMessage(error instanceof Error ? error.message : copy.operationalData);
    } finally {
      setLoading(false);
    }
  }, [locale, isTh]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBookings(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBookings]);

  // Persistent QR Pass logic
  async function showQr(booking: Booking) {
    setMessage("");
    if (qrPass?.bookingId === booking.id) {
      setQrPass(null);
      return;
    }

    const cacheKey = `parkspace_qr_${booking.id}`;
    setQrLoadingId(booking.id);
    try {
      // Use canonical booking.reference as payload so QR codes are 100% identical between booking confirmation and QR pass
      const canonicalPayload = booking.reference;
      const payloadData = {
        bookingId: booking.id,
        reference: booking.reference,
        payload: canonicalPayload,
        expiresAt: booking.ends_at ?? null,
      };
      setQrPass(payloadData);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(payloadData));
      } catch {
        // ignore
      }

      // Background ensure token exists in database for scanner validation
      void fetch("/api/bookings/issue-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id }),
      }).catch(() => {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.qrUnavailable);
    } finally {
      setQrLoadingId("");
    }
  }

  async function cancelBooking(booking: Booking) {
    const confirmed = await confirm({
      title: t.cancel,
      message: isTh ? `ต้องการยกเลิกการจอง ${booking.reference} หรือไม่?` : `Cancel booking ${booking.reference}?`,
      confirmLabel: t.confirm,
      cancelLabel: t.close,
      danger: true,
    });
    if (!confirmed) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("bookings")
        .update({ status: "CANCELLED", cancellation_reason: "USER_REQUEST" })
        .eq("id", booking.id)
        .in("status", ["PENDING", "CONFIRMED", "RESERVED"]);
      if (error) throw error;
      setBookings((current) => current.map((item) => (item.id === booking.id ? { ...item, status: "CANCELLED" } : item)));
      if (qrPass?.bookingId === booking.id) setQrPass(null);
      notify({ title: t.cancel, kind: "success" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.operationalData;
      setMessage(detail);
      notify({ title: t.operationalData, message: detail, kind: "error" });
    }
  }

  function openEdit(booking: Booking) {
    setEditingBooking(booking);
    setEditPlate(booking.vehicle_snapshot?.plate ?? "");
    setEditStartsAt(booking.starts_at ? booking.starts_at.slice(11, 16) : "");
    setEditEndsAt(booking.ends_at ? booking.ends_at.slice(11, 16) : "");
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingBooking) return;
    setSavingEdit(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const bDate = editingBooking.booking_date;
      const updatedStarts = `${bDate}T${editStartsAt || "08:00"}:00`;
      const updatedEnds = `${bDate}T${editEndsAt || "12:00"}:00`;
      const updatedSnapshot = { plate: editPlate.trim() };

      const { error } = await supabase
        .from("bookings")
        .update({
          starts_at: updatedStarts,
          ends_at: updatedEnds,
          vehicle_snapshot: updatedSnapshot,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingBooking.id)
        .eq("status", "PENDING");

      if (error) throw error;

      setBookings((prev) =>
        prev.map((b) =>
          b.id === editingBooking.id
            ? { ...b, starts_at: updatedStarts, ends_at: updatedEnds, vehicle_snapshot: updatedSnapshot }
            : b
        )
      );

      setEditingBooking(null);
      notify({ title: isTh ? "แก้ไขข้อมูลการจองสำเร็จ" : "Booking updated successfully", kind: "success" });
    } catch (err) {
      notify({
        title: isTh ? "ไม่สามารถแก้ไขข้อมูลได้" : "Failed to update booking",
        message: err instanceof Error ? err.message : "",
        kind: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  // Filtered & paginated bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const area = areaMap[b.parking_area_id];
      const matchRef = b.reference.toLowerCase().includes(q);
      const matchArea = (area?.name ?? "").toLowerCase().includes(q) || (area?.code ?? "").toLowerCase().includes(q);
      const matchPlate = (b.vehicle_snapshot?.plate ?? "").toLowerCase().includes(q);
      return matchRef || matchArea || matchPlate;
    });
  }, [bookings, statusFilter, searchQuery, areaMap]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedBookings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, page, pageSize]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="empty-card">
        <div>
          <div className="empty-icon"><CircleAlert size={27} /></div>
          <h2>{t.setupRequired}</h2>
          <p>{t.accountNotConfigured} / {t.accountNotConfiguredEn}</p>
          <Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/login`}>{t.login}</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="empty-card">
        <div>
          <RefreshCw size={26} />
          <p>{isTh ? "กำลังโหลดข้อมูล…" : "Loading bookings…"}</p>
        </div>
      </div>
    );
  }

  if (message && !bookings.length) {
    return (
      <div className="empty-card">
        <div>
          <div className="empty-icon"><CircleAlert size={27} /></div>
          <h2>{message}</h2>
          <Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/login`}>{t.login}</Link>
        </div>
      </div>
    );
  }

  if (!bookings.length) {
    return (
      <div className="empty-card">
        <div>
          <div className="empty-icon"><CalendarDays size={27} /></div>
          <h2>{t.myBookingsEmpty}</h2>
          <p>{t.myBookingsEmptySub}</p>
          <Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/parking`}>{t.parking}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-list-wrapper">
      {/* Search & Status Filter Controls */}
      <div className="booking-filter-bar" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="user-search-box" style={{ flex: "1 1 220px", margin: 0 }}>
            <Search size={16} />
            <input
              placeholder={isTh ? "ค้นหาด้วยรหัสจอง, พื้นที่, หรือทะเบียนรถ…" : "Search by reference, area, plate…"}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search bookings"
            />
            {searchQuery ? (
              <button type="button" onClick={() => setSearchQuery("")} style={{ border: 0, background: "none", cursor: "pointer", color: "var(--muted)" }}>
                <X size={14} />
              </button>
            ) : null}
          </div>

          <label className="user-search-box" style={{ flex: "0 1 180px", margin: 0 }}>
            <Filter size={16} />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit", font: "inherit" }}
              aria-label="Filter status"
            >
              <option value="ALL">{isTh ? "สถานะทั้งหมด (All Status)" : "All Status"}</option>
              <option value="PENDING">{isTh ? "รอดำเนินการ (Pending)" : "Pending"}</option>
              <option value="CONFIRMED">{isTh ? "ยืนยันแล้ว (Confirmed)" : "Confirmed"}</option>
              <option value="RESERVED">{isTh ? "จองแล้ว (Reserved)" : "Reserved"}</option>
              <option value="CHECKED_IN">{isTh ? "เช็คอินแล้ว (Checked In)" : "Checked In"}</option>
              <option value="OVERSTAY">{isTh ? "จอดเกินเวลา (Overstay)" : "Overstay"}</option>
              <option value="COMPLETED">{isTh ? "เสร็จสิ้น (Completed)" : "Completed"}</option>
              <option value="CANCELLED">{isTh ? "ยกเลิกแล้ว (Cancelled)" : "Cancelled"}</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "var(--muted)", padding: "0 4px" }}>
          <span>{isTh ? `พบรายการจองทั้งหมด ${filteredBookings.length} รายการ` : `Total ${filteredBookings.length} bookings found`}</span>
          {totalPages > 1 ? (
            <span>{isTh ? `หน้า ${page} จาก ${totalPages}` : `Page ${page} of ${totalPages}`}</span>
          ) : null}
        </div>
      </div>

      {/* Bookings List */}
      <div className="booking-list">
        {paginatedBookings.length === 0 ? (
          <div className="empty-card" style={{ padding: 24, textAlign: "center" }}>
            <p>{t.noResults}</p>
          </div>
        ) : (
          paginatedBookings.map((booking) => {
            const area = areaMap[booking.parking_area_id];
            const canShowQr = ["PENDING", "CONFIRMED", "RESERVED", "CHECKED_IN", "OVERSTAY"].includes(booking.status);
            const isPending = booking.status === "PENDING";
            const navUrl = area ? `https://www.google.com/maps/search/?api=1&query=${area.latitude},${area.longitude}` : "#";

            return (
              <article className="booking-card" key={booking.id}>
                <div className="booking-card-top">
                  <div>
                    <Link
                      href={`/${locale}/app/bookings/${booking.reference}`}
                      prefetch={false}
                      style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 3 }}
                    >
                      {booking.reference}
                    </Link>
                    <span>{booking.booking_mode === "INDIVIDUAL_SLOT" ? t.individualSlot : t.areaOnly}</span>
                  </div>
                  {renderStatusBadge(booking.status, locale)}
                </div>

                <div className="booking-card-line">
                  <MapPin size={15} />
                  <span>
                    {area?.name ?? booking.parking_area_id}
                    <small>
                      {area?.code ?? t.area}
                      {booking.parking_slot_id ? ` · ${t.selectedSlot}` : ""}
                    </small>
                  </span>
                </div>

                <div className="booking-card-line">
                  <CalendarDays size={15} />
                  <span>
                    {booking.booking_date}
                    <small>{t.date}</small>
                  </span>
                  <Clock3 size={15} />
                  <span>
                    {formatTime(booking.starts_at, locale)}–{formatTime(booking.ends_at, locale)}
                    <small>{t.selectTime}</small>
                  </span>
                </div>

                <div className="booking-card-line">
                  <Car size={15} />
                  <span>
                    {booking.vehicle_snapshot?.plate ?? "—"}
                    <small>{t.vehicle}</small>
                  </span>
                </div>

                {/* Smart Status-Aware Action Buttons */}
                <div className="booking-card-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {/* PENDING / CONFIRMED / RESERVED: QR Pass to Check-in */}
                  {["PENDING", "CONFIRMED", "RESERVED"].includes(booking.status.toUpperCase()) && (
                    <button
                      className="booking-action-btn primary"
                      type="button"
                      onClick={() => void showQr(booking)}
                      disabled={qrLoadingId === booking.id}
                    >
                      <QrCode size={14} />
                      <span>{qrLoadingId === booking.id ? "…" : qrPass?.bookingId === booking.id ? (isTh ? "ซ่อน QR" : "Hide QR") : (isTh ? "QR Pass เข้าจอด" : "Check-in QR")}</span>
                    </button>
                  )}

                  {/* CHECKED_IN: QR Pass to Check-out (Exit) */}
                  {booking.status.toUpperCase() === "CHECKED_IN" && (
                    <button
                      className="booking-action-btn primary"
                      type="button"
                      onClick={() => void showQr(booking)}
                      disabled={qrLoadingId === booking.id}
                    >
                      <QrCode size={14} />
                      <span>{qrLoadingId === booking.id ? "…" : qrPass?.bookingId === booking.id ? (isTh ? "ซ่อน QR" : "Hide QR") : (isTh ? "QR Pass สแกนออก" : "Exit QR")}</span>
                    </button>
                  )}

                  {/* OVERSTAY: QR Pass to settle/exit */}
                  {booking.status.toUpperCase() === "OVERSTAY" && (
                    <button
                      className="booking-action-btn danger"
                      type="button"
                      onClick={() => void showQr(booking)}
                      disabled={qrLoadingId === booking.id}
                    >
                      <AlertTriangle size={14} />
                      <span>{qrLoadingId === booking.id ? "…" : qrPass?.bookingId === booking.id ? (isTh ? "ซ่อน QR" : "Hide QR") : (isTh ? "QR Pass เช็คเอาท์/เกินเวลา" : "Overstay Exit QR")}</span>
                    </button>
                  )}

                  {/* COMPLETED or CANCELLED: Book Again shortcut */}
                  {(["COMPLETED", "CHECKED_OUT"].includes(booking.status.toUpperCase()) || ["CANCELLED", "REJECTED", "EXPIRED", "NO_SHOW"].includes(booking.status.toUpperCase())) && (
                    <Link
                      className={["COMPLETED", "CHECKED_OUT"].includes(booking.status.toUpperCase()) ? "booking-action-btn success" : "booking-action-btn primary"}
                      href={`/${locale}/parking/${area?.code?.toLowerCase() || ""}`}
                    >
                      {["COMPLETED", "CHECKED_OUT"].includes(booking.status.toUpperCase()) ? <PlusCircle size={14} /> : <RotateCcw size={14} />}
                      <span>{isTh ? "จองใหม่อีกครั้ง" : "Book Again"}</span>
                    </Link>
                  )}

                  {/* Navigation (for active bookings) */}
                  {area && (["PENDING", "CONFIRMED", "RESERVED", "CHECKED_IN"].includes(booking.status.toUpperCase())) ? (
                    <a
                      className="booking-action-btn secondary"
                      href={navUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation size={14} />
                      <span>{isTh ? "นำทาง" : "Navigate"}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : null}

                  {/* Edit Booking (Only allowed when PENDING or CONFIRMED before checking in) */}
                  {["PENDING", "CONFIRMED", "RESERVED"].includes(booking.status.toUpperCase()) ? (
                    <button
                      className="booking-action-btn secondary"
                      type="button"
                      onClick={() => openEdit(booking)}
                    >
                      <Edit3 size={14} />
                      <span>{isTh ? "แก้ไขข้อมูล" : "Edit"}</span>
                    </button>
                  ) : null}

                  {/* Cancel Booking (Allowed when PENDING or CONFIRMED, NEVER when CHECKED_IN or COMPLETED) */}
                  {["PENDING", "CONFIRMED", "RESERVED"].includes(booking.status.toUpperCase()) ? (
                    <button
                      className="booking-action-btn danger"
                      type="button"
                      onClick={() => void cancelBooking(booking)}
                    >
                      <XCircle size={14} />
                      <span>{isTh ? "ยกเลิกการจอง" : "Cancel Booking"}</span>
                    </button>
                  ) : null}

                  {/* View Booking Detail Page (Always available) */}
                  <Link
                    className="booking-action-btn secondary"
                    href={`/${locale}/app/bookings/${booking.reference}`}
                    prefetch={false}
                  >
                    <ExternalLink size={14} />
                    <span>{isTh ? "ดูรายละเอียด" : "Details"}</span>
                  </Link>
                </div>

                {/* QR Pass Render */}
                {qrPass?.bookingId === booking.id ? (
                  <div style={{ marginTop: 12 }}>
                    <QrPass
                      locale={locale}
                      payload={qrPass.payload}
                      reference={qrPass.reference}
                      expiresAt={qrPass.expiresAt}
                    />
                  </div>
                ) : null}

                {message ? (
                  <div className="form-note" role="alert" style={{ marginTop: 8 }}>
                    {message}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 ? (
        <div
          className="pagination-bar"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
          }}
        >
          <button
            className="secondary-button small-button"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
            <span>{isTh ? "ก่อนหน้า" : "Prev"}</span>
          </button>

          <span style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>
            &lt; {page} / {totalPages} &gt;
          </span>

          <button
            className="secondary-button small-button"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <span>{isTh ? "ถัดไป" : "Next"}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}

      {/* Edit Booking Modal */}
      {editingBooking ? (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="modal-card"
            style={{
              background: "var(--card-bg, #ffffff)",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>
                {isTh ? `แก้ไขข้อมูลการจอง: ${editingBooking.reference}` : `Edit Booking: ${editingBooking.reference}`}
              </strong>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                style={{ border: 0, background: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label htmlFor="edit-plate">{t.vehiclePlate}</label>
                <input
                  id="edit-plate"
                  className="form-control"
                  value={editPlate}
                  onChange={(e) => setEditPlate(e.target.value)}
                  placeholder={isTh ? "เช่น กข 1234 สารคาม" : "e.g. 1AB 1234"}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label htmlFor="edit-starts">{isTh ? "เวลาเริ่ม" : "Start Time"}</label>
                  <input
                    id="edit-starts"
                    className="form-control"
                    type="time"
                    value={editStartsAt}
                    onChange={(e) => setEditStartsAt(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-ends">{isTh ? "เวลาสิ้นสุด" : "End Time"}</label>
                  <input
                    id="edit-ends"
                    className="form-control"
                    type="time"
                    value={editEndsAt}
                    onChange={(e) => setEditEndsAt(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditingBooking(null)}
                  disabled={savingEdit}
                >
                  {t.close}
                </button>
                <button type="submit" className="primary-button" disabled={savingEdit}>
                  {savingEdit ? "…" : isTh ? "บันทึกการแก้ไข" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatTime(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString(locale === "th" ? "th-TH" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}
