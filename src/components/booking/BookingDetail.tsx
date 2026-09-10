"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Car,
  Check,
  CheckCheck,
  CheckCircle2,
  CircleAlert,
  Clock,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  MapPin,
  Navigation,
  PlusCircle,
  QrCode,
  RotateCcw,
  Share2,
  X,
  XCircle,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { QrPass } from "@/components/booking/QrPass";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type BookingDetailData = {
  id: string;
  reference: string;
  booking_date: string;
  starts_at: string;
  ends_at: string;
  status: string;
  booking_mode: "AREA_ONLY" | "INDIVIDUAL_SLOT";
  parking_area_id: string;
  parking_slot_id: string | null;
  vehicle_snapshot: { plate?: string; plate_number?: string; province?: string } | null;
  created_at: string;
  updated_at?: string;
  parking_areas?: {
    code: string;
    name_th: string;
    name_en: string;
    latitude: number;
    longitude: number;
  } | null;
  parking_slots?: {
    slot_code: string;
    row_label: string;
  } | null;
};


function renderStatusBadge(status: string, locale: Locale) {
  const isTh = locale === "th";
  const upper = (status || "").toUpperCase();
  switch (upper) {
    case "PENDING":
      return (
        <span className="booking-status pending" style={{ fontSize: 13, padding: "5px 12px" }}>
          <Clock size={13} strokeWidth={2.3} />
          <span>{isTh ? "รอดำเนินการ (รอเข้าจอด)" : "Pending (Awaiting Check-in)"}</span>
        </span>
      );
    case "CONFIRMED":
      return (
        <span className="booking-status confirmed" style={{ fontSize: 13, padding: "5px 12px" }}>
          <CalendarCheck size={13} strokeWidth={2.3} />
          <span>{isTh ? "ยืนยันแล้ว" : "Confirmed"}</span>
        </span>
      );
    case "RESERVED":
      return (
        <span className="booking-status reserved" style={{ fontSize: 13, padding: "5px 12px" }}>
          <CheckCircle2 size={13} strokeWidth={2.3} />
          <span>{isTh ? "จองแล้ว" : "Reserved"}</span>
        </span>
      );
    case "CHECKED_IN":
      return (
        <span className="booking-status checked_in" style={{ fontSize: 13, padding: "5px 12px" }}>
          <Car size={13} strokeWidth={2.3} />
          <span>{isTh ? "เช็คอินแล้ว (กำลังจอด)" : "Checked In (Parked)"}</span>
        </span>
      );
    case "OVERSTAY":
      return (
        <span className="booking-status overstay" style={{ fontSize: 13, padding: "5px 12px" }}>
          <AlertTriangle size={13} strokeWidth={2.3} />
          <span>{isTh ? "จอดเกินเวลา" : "Overstay"}</span>
        </span>
      );
    case "COMPLETED":
    case "CHECKED_OUT":
      return (
        <span className="booking-status completed" style={{ fontSize: 13, padding: "5px 12px" }}>
          <CheckCheck size={13} strokeWidth={2.3} />
          <span>{isTh ? "เสร็จสิ้น / เช็คเอาท์แล้ว" : "Completed / Checked Out"}</span>
        </span>
      );
    case "CANCELLED":
    case "REJECTED":
      return (
        <span className="booking-status cancelled" style={{ fontSize: 13, padding: "5px 12px" }}>
          <XCircle size={13} strokeWidth={2.3} />
          <span>{isTh ? "ยกเลิกแล้ว" : "Cancelled"}</span>
        </span>
      );
    case "NO_SHOW":
      return (
        <span className="booking-status no_show" style={{ fontSize: 13, padding: "5px 12px" }}>
          <CircleAlert size={13} strokeWidth={2.3} />
          <span>{isTh ? "ไม่มาใช้บริการ" : "No Show"}</span>
        </span>
      );
    case "EXPIRED":
      return (
        <span className="booking-status expired" style={{ fontSize: 13, padding: "5px 12px" }}>
          <Clock size={13} strokeWidth={2.3} />
          <span>{isTh ? "หมดอายุ" : "Expired"}</span>
        </span>
      );
    default:
      return (
        <span className="booking-status pending" style={{ fontSize: 13, padding: "5px 12px" }}>
          <span>{status}</span>
        </span>
      );
  }
}

export function BookingDetail({ locale, reference }: { locale: Locale; reference: string }) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const [booking, setBooking] = useState<BookingDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(true);

  // Edit modal state
  const [editing, setEditing] = useState(false);
  const [editPlate, setEditPlate] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const { confirm, notify } = useNotifications();

  const loadBooking = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setErrorMsg(isTh ? "กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดการจองนี้" : "Please sign in to view this booking");
        return;
      }

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          reference,
          booking_date,
          starts_at,
          ends_at,
          status,
          booking_mode,
          parking_area_id,
          parking_slot_id,
          vehicle_snapshot,
          created_at,
          updated_at,
          parking_areas ( id, code, name_th, name_en, latitude, longitude ),
          parking_slots ( slot_code, row_label )
        `)
        .eq("reference", reference)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErrorMsg(isTh ? "ไม่พบข้อมูลการจองนี้" : "Booking not found");
        return;
      }

      const formattedBooking = data as unknown as BookingDetailData;
      setBooking(formattedBooking);

      // Background ensure QR token exists
      void fetch("/api/bookings/issue-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: formattedBooking.id }),
      }).catch(() => {});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }, [reference, isTh, t.operationalData]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  const copyUrl = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      notify({
        title: isTh ? "คัดลอกลิงก์การจองแล้ว" : "Booking Link Copied",
        kind: "success",
      });
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    const confirmed = await confirm({
      title: t.cancel,
      message: isTh ? `ต้องการยกเลิกการจอง ${booking.reference} หรือไม่?` : `Cancel booking ${booking.reference}?`,
      confirmLabel: t.confirm,
      cancelLabel: t.close,
      danger: true,
    });
    if (!confirmed) return;

    try {
      const { error } = await createSupabaseBrowserClient()
        .from("bookings")
        .update({ status: "CANCELLED", cancellation_reason: "USER_REQUEST" })
        .eq("id", booking.id)
        .in("status", ["PENDING", "CONFIRMED", "RESERVED"]);

      if (error) throw error;
      setBooking((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
      notify({ title: t.cancel, kind: "success" });
    } catch (err) {
      notify({
        title: isTh ? "ไม่สามารถยกเลิกได้" : "Cancellation Failed",
        message: err instanceof Error ? err.message : "",
        kind: "error",
      });
    }
  };

  function parseLocalTime(isoString?: string | null): string {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "";
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    } catch {
      return "";
    }
  }

  const openEditModal = () => {
    if (!booking) return;
    setEditPlate(booking.vehicle_snapshot?.plate || booking.vehicle_snapshot?.plate_number || "");
    setEditStartsAt(parseLocalTime(booking.starts_at) || "10:00");
    setEditEndsAt(parseLocalTime(booking.ends_at) || "13:00");
    setEditing(true);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    if (editEndsAt <= editStartsAt) {
      notify({
        title: isTh ? "เวลาไม่ถูกต้อง" : "Invalid Time Range",
        message: isTh ? "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น" : "End time must be after start time",
        kind: "warning",
      });
      return;
    }
    setSavingEdit(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const bDate = booking.booking_date;
      const updatedStarts = `${bDate}T${editStartsAt || "10:00"}:00+07:00`;
      const updatedEnds = `${bDate}T${editEndsAt || "13:00"}:00+07:00`;
      const updatedSnapshot = { plate: editPlate.trim() };

      const { error } = await supabase
        .from("bookings")
        .update({
          starts_at: updatedStarts,
          ends_at: updatedEnds,
          vehicle_snapshot: updatedSnapshot,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .eq("status", "PENDING");

      if (error) throw error;

      setBooking((prev) =>
        prev
          ? {
              ...prev,
              starts_at: updatedStarts,
              ends_at: updatedEnds,
              vehicle_snapshot: updatedSnapshot,
            }
          : null
      );
      setEditing(false);
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
  };

  if (loading) {
    return (
      <div className="empty-card" style={{ padding: 40, textAlign: "center" }}>
        <p>{isTh ? "กำลังโหลดข้อมูลการจอง…" : "Loading booking details…"}</p>
      </div>
    );
  }

  if (errorMsg || !booking) {
    const isAuthError = errorMsg.includes("เข้าสู่ระบบ") || errorMsg.includes("sign in");
    return (
      <div className="empty-card" style={{ padding: 32, textAlign: "center" }}>
        <CircleAlert size={36} color="var(--red, #ef4444)" style={{ margin: "0 auto 12px" }} />
        <h2>{errorMsg || (isTh ? "ไม่พบข้อมูลการจอง" : "Booking not found")}</h2>
        <p style={{ margin: "10px 0 20px" }}>
          {isAuthError
            ? (isTh ? "กรุณาเข้าสู่ระบบด้วยบัญชีที่คุณใช้ทำการจอง" : "Please sign in with the account used for this booking.")
            : (isTh ? "รหัสการจองไม่ถูกต้อง หรือคุณไม่มีสิทธิ์เข้าถึง" : "Invalid reference or no access.")}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {isAuthError ? (
            <Link className="primary-button" href={`/${locale}/login`}>
              <span>{t.login}</span>
            </Link>
          ) : (
            <Link className="primary-button" href={`/${locale}/app/bookings`}>
              <ArrowLeft size={16} />
              <span>{isTh ? "กลับไปรายการจองของฉัน" : "Back to My Bookings"}</span>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const area = booking.parking_areas;
  const areaName = isTh ? area?.name_th : area?.name_en || area?.name_th || booking.parking_area_id;
  const navUrl = area?.latitude && area?.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${area.latitude},${area.longitude}`
    : "#";
  const canShowQr = ["PENDING", "CONFIRMED", "RESERVED", "CHECKED_IN", "OVERSTAY"].includes(booking.status);
  const isPending = booking.status === "PENDING";

  return (
    <div className="booking-detail-page" style={{ maxWidth: 640, margin: "0 auto", padding: "0 12px 36px" }}>
      {/* Back and Share Topbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link
          href={`/${locale}/app/bookings`}
          className="secondary-button"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 14px" }}
        >
          <ArrowLeft size={16} />
          <span>{isTh ? "การจองของฉัน" : "My Bookings"}</span>
        </Link>
        <button
          type="button"
          className="secondary-button"
          onClick={copyUrl}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 14px" }}
        >
          {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
          <span>{copied ? (isTh ? "คัดลอกแล้ว!" : "Copied!") : isTh ? "แชร์ลิงก์" : "Share URL"}</span>
        </button>
      </div>

      {/* Main Booking Card */}
      <article className="booking-card" style={{ padding: 20, borderRadius: 16, border: "1px solid var(--line)" }}>
        {/* Header reference & status */}
        <div className="booking-card-top" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 14, marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em", display: "block" }}>
              {isTh ? "รหัสอ้างอิงการจอง (Booking Reference)" : "Booking Reference"}
            </span>
            <strong style={{ fontSize: 20, letterSpacing: "0.02em" }}>{booking.reference}</strong>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {booking.booking_mode === "INDIVIDUAL_SLOT" ? t.individualSlot : t.areaOnly}
            </div>
          </div>
          {renderStatusBadge(booking.status, locale)}
        </div>

        {/* Info Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Area */}
          <div className="booking-card-line">
            <MapPin size={18} color="#f59e0b" />
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", fontSize: 15 }}>{areaName}</strong>
              <small style={{ color: "var(--muted)" }}>
                {area?.code ?? t.area}
                {booking.parking_slots ? ` · ช่องจอด ${booking.parking_slots.slot_code}` : ""}
              </small>
            </div>
            {area ? (
              <a
                className="booking-action-btn secondary"
                href={navUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, padding: "5px 10px" }}
              >
                <Navigation size={13} />
                <span>{isTh ? "นำทาง" : "Map"}</span>
                <ExternalLink size={11} />
              </a>
            ) : null}
          </div>

          {/* Date and Time */}
          <div className="booking-card-line">
            <CalendarDays size={18} color="#3b82f6" />
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", fontSize: 15 }}>{booking.booking_date}</strong>
              <small style={{ color: "var(--muted)" }}>{t.date}</small>
            </div>
            <Clock3 size={18} color="#3b82f6" />
            <div>
              <strong style={{ display: "block", fontSize: 15 }}>
                {formatTime(booking.starts_at, locale)} – {formatTime(booking.ends_at, locale)}
              </strong>
              <small style={{ color: "var(--muted)" }}>{t.selectTime}</small>
            </div>
          </div>

          {/* Vehicle */}
          <div className="booking-card-line">
            <Car size={18} color="#10b981" />
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", fontSize: 15 }}>
                {booking.vehicle_snapshot?.plate || booking.vehicle_snapshot?.plate_number || "—"}
              </strong>
              <small style={{ color: "var(--muted)" }}>
                {t.vehicle} {booking.vehicle_snapshot?.province ? `(${booking.vehicle_snapshot.province})` : ""}
              </small>
            </div>
          </div>
        </div>

        {/* QR Pass Section */}
        {canShowQr && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <QrCode size={18} />
                <strong style={{ fontSize: 14 }}>{isTh ? "บัตรผ่าน QR สำหรับสแกนเข้า/ออกพื้นที่" : "QR Pass (Entry / Exit)"}</strong>
              </div>
              <button
                type="button"
                className="booking-action-btn secondary"
                onClick={() => setShowQr((v) => !v)}
                style={{ fontSize: 12, padding: "4px 10px" }}
              >
                {showQr ? (isTh ? "ซ่อน QR" : "Hide") : isTh ? "แสดง QR" : "Show"}
              </button>
            </div>

            {showQr ? (
              <QrPass
                locale={locale}
                payload={booking.reference}
                reference={booking.reference}
                expiresAt={booking.ends_at}
              />
            ) : null}
          </div>
        )}

        {/* Smart Conditional Action buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          {/* Edit (PENDING / CONFIRMED / RESERVED only) */}
          {["PENDING", "CONFIRMED", "RESERVED"].includes(booking.status.toUpperCase()) ? (
            <button
              type="button"
              className="booking-action-btn secondary"
              onClick={openEditModal}
            >
              <Edit3 size={15} />
              <span>{isTh ? "แก้ไขข้อมูลการจอง" : "Edit Booking"}</span>
            </button>
          ) : null}

          {/* Cancel (PENDING / CONFIRMED / RESERVED only) */}
          {["PENDING", "CONFIRMED", "RESERVED"].includes(booking.status.toUpperCase()) ? (
            <button
              type="button"
              className="booking-action-btn danger"
              onClick={() => void handleCancel()}
            >
              <XCircle size={15} />
              <span>{isTh ? "ยกเลิกการจองนี้" : "Cancel Booking"}</span>
            </button>
          ) : null}

          {/* Book Again (COMPLETED / CHECKED_OUT / CANCELLED / EXPIRED) */}
          {(["COMPLETED", "CHECKED_OUT"].includes(booking.status.toUpperCase()) || ["CANCELLED", "REJECTED", "EXPIRED", "NO_SHOW"].includes(booking.status.toUpperCase())) && (
            <Link
              href={`/${locale}/parking/${area?.code?.toLowerCase() || ""}`}
              className={["COMPLETED", "CHECKED_OUT"].includes(booking.status.toUpperCase()) ? "booking-action-btn success" : "booking-action-btn primary"}
            >
              {["COMPLETED", "CHECKED_OUT"].includes(booking.status.toUpperCase()) ? <PlusCircle size={15} /> : <RotateCcw size={15} />}
              <span>{isTh ? "จองใหม่อีกครั้ง" : "Book Again"}</span>
            </Link>
          )}

          <button
            type="button"
            className="booking-action-btn secondary"
            onClick={copyUrl}
            style={{ marginLeft: "auto" }}
          >
            <Share2 size={15} />
            <span>{isTh ? "แชร์การจองนี้" : "Share"}</span>
          </button>
        </div>
      </article>

      {/* Edit Modal */}
      {editing ? (
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
                {isTh ? `แก้ไขข้อมูลการจอง: ${booking.reference}` : `Edit Booking: ${booking.reference}`}
              </strong>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{ border: 0, background: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label htmlFor="edit-plate-field">{t.vehiclePlate}</label>
                <input
                  id="edit-plate-field"
                  className="form-control"
                  value={editPlate}
                  onChange={(e) => setEditPlate(e.target.value)}
                  placeholder={isTh ? "เช่น กข 1234 สารคาม" : "e.g. 1AB 1234"}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label htmlFor="edit-starts-field">{isTh ? "เวลาเริ่ม" : "Start Time"}</label>
                  <input
                    id="edit-starts-field"
                    className="form-control"
                    type="time"
                    value={editStartsAt}
                    onChange={(e) => setEditStartsAt(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-ends-field">{isTh ? "เวลาสิ้นสุด" : "End Time"}</label>
                  <input
                    id="edit-ends-field"
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
                  onClick={() => setEditing(false)}
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
    : date.toLocaleTimeString(locale === "th" ? "th-TH" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
}
