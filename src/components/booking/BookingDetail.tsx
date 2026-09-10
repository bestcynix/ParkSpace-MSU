"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  Check,
  CircleAlert,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  MapPin,
  Navigation,
  QrCode,
  Share2,
  X,
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
    id: string;
    code: string;
    name_th: string;
    name_en: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  parking_slots?: {
    slot_code: string;
    row_label: string;
  } | null;
};

function statusLabel(status: string, locale: Locale): string {
  if (locale === "en") return status.replace("_", " ");
  switch (status.toUpperCase()) {
    case "PENDING":
      return "รอดำเนินการ";
    case "CONFIRMED":
      return "ยืนยันแล้ว";
    case "RESERVED":
      return "จองแล้ว";
    case "CHECKED_IN":
      return "เช็คอินแล้ว";
    case "COMPLETED":
      return "เสร็จสิ้น";
    case "CANCELLED":
      return "ยกเลิกแล้ว";
    case "NO_SHOW":
      return "ไม่มาใช้บริการ";
    case "OVERSTAY":
      return "จอดเกินเวลา";
    default:
      return status;
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
        .eq("status", "PENDING");

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

  const openEditModal = () => {
    if (!booking) return;
    setEditPlate(booking.vehicle_snapshot?.plate || booking.vehicle_snapshot?.plate_number || "");
    setEditStartsAt(booking.starts_at ? booking.starts_at.slice(11, 16) : "");
    setEditEndsAt(booking.ends_at ? booking.ends_at.slice(11, 16) : "");
    setEditing(true);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setSavingEdit(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const bDate = booking.booking_date;
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
    return (
      <div className="empty-card" style={{ padding: 32, textAlign: "center" }}>
        <CircleAlert size={36} color="var(--red, #ef4444)" style={{ margin: "0 auto 12px" }} />
        <h2>{errorMsg || (isTh ? "ไม่พบข้อมูลการจอง" : "Booking not found")}</h2>
        <p style={{ margin: "10px 0 20px" }}>{isTh ? "รหัสการจองไม่ถูกต้อง หรือคุณไม่มีสิทธิ์เข้าถึง" : "Invalid reference or no access."}</p>
        <Link className="primary-button" href={`/${locale}/app/bookings`}>
          <ArrowLeft size={16} />
          <span>{isTh ? "กลับไปรายการจองของฉัน" : "Back to My Bookings"}</span>
        </Link>
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
          <span className={`booking-status ${booking.status.toLowerCase()}`} style={{ fontSize: 13, padding: "5px 12px" }}>
            {statusLabel(booking.status, locale)}
          </span>
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
                className="secondary-button small-button"
                href={navUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
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
                <strong style={{ fontSize: 14 }}>{isTh ? "บัตรผ่าน QR สำหรับสแกนเข้าพื้นที่" : "QR Entry Pass"}</strong>
              </div>
              <button
                type="button"
                className="secondary-button small-button"
                onClick={() => setShowQr((v) => !v)}
                style={{ fontSize: 12 }}
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

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          {isPending ? (
            <button
              type="button"
              className="secondary-button"
              onClick={openEditModal}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Edit3 size={15} />
              <span>{isTh ? "แก้ไขข้อมูลการจอง" : "Edit Booking"}</span>
            </button>
          ) : null}

          {isPending ? (
            <button
              type="button"
              className="secondary-button danger"
              onClick={() => void handleCancel()}
              style={{ color: "var(--red, #ef4444)", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <X size={15} />
              <span>{t.cancel}</span>
            </button>
          ) : null}

          <button
            type="button"
            className="secondary-button"
            onClick={copyUrl}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
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
