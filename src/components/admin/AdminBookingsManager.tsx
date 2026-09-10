"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  LoaderCircle,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  User,
  X,
  Edit3,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";
import { QrPass } from "@/components/booking/QrPass";

export type AdminBookingItem = {
  id: string;
  reference: string;
  status: "PENDING" | "CONFIRMED" | "RESERVED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "OVERSTAY";
  booking_date: string;
  starts_at: string;
  ends_at: string;
  booking_mode: string;
  parking_area_id: string;
  parking_slot_id: string | null;
  vehicle_snapshot: {
    plate?: string;
    plate_number?: string;
    province?: string;
    type?: string;
    brand?: string;
    color?: string;
  } | null;
  created_at: string;
  updated_at?: string;
  profiles?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    student_id?: string | null;
  } | null;
  parking_areas?: {
    id: string;
    code: string;
    name_th: string;
    name_en?: string;
  } | null;
  parking_slots?: {
    id: string;
    slot_code: string;
    row_label?: string;
  } | null;
};

export function AdminBookingsManager({ locale }: { locale: Locale }) {
  const isTh = locale === "th";
  const { notify } = useNotifications();

  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Inspect Modal
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingItem | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (areaFilter !== "ALL") params.set("area", areaFilter);

      const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bookings");

      setBookings(data.bookings || []);
      setTotal(data.total || 0);
    } catch (err) {
      notify({
        title: isTh ? "จัดการการจอง" : "Manage Bookings",
        message: err instanceof Error ? err.message : "Error loading bookings",
        kind: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter, areaFilter, isTh, notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBookings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBookings]);

  async function handleSaveStatus() {
    if (!selectedBooking || !editStatus) return;
    setSavingStatus(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/bookings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: selectedBooking.id,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      notify({
        title: isTh ? "เปลี่ยนสถานะสำเร็จ" : "Status Updated",
        message: `${selectedBooking.reference} -> ${editStatus}`,
        kind: "success",
      });

      setSelectedBooking(null);
      void loadBookings();
    } catch (err) {
      notify({
        title: isTh ? "ข้อผิดพลาด" : "Error",
        message: err instanceof Error ? err.message : "Update failed",
        kind: "error",
      });
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDelete(id: string, ref: string) {
    const confirmed = window.confirm(
      isTh
        ? `คุณแน่ใจหรือไม่ที่จะลบรายการจอง ${ref}? การกระทำนี้ไม่สามารถย้อนกลับได้`
        : `Are you sure you want to permanently delete booking ${ref}?`
    );
    if (!confirmed) return;

    setDeletingId(id);
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
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      notify({
        title: isTh ? "ลบรายการจองสำเร็จ" : "Booking Deleted",
        message: `${ref} was deleted`,
        kind: "success",
      });

      if (selectedBooking?.id === id) {
        setSelectedBooking(null);
      }
      void loadBookings();
    } catch (err) {
      notify({
        title: isTh ? "ไม่สามารถลบได้" : "Delete failed",
        message: err instanceof Error ? err.message : "Error deleting booking",
        kind: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Area options
  const areaOptions = useMemo(() => {
    const list: string[] = [];
    for (let i = 1; i <= 28; i++) {
      list.push(`P${String(i).padStart(2, "0")}`);
    }
    return list;
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Search and Filters Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 20px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 300px", maxWidth: 460 }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
              }}
            />
            <input
              type="text"
              className="form-control"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={
                isTh
                  ? "ค้นหารหัสจอง, ทะเบียนรถ, ชื่อ, เบอร์โทร..."
                  : "Search booking reference, license plate, user..."
              }
              style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Area filter */}
          <select
            className="form-control"
            value={areaFilter}
            onChange={(e) => {
              setAreaFilter(e.target.value);
              setPage(1);
            }}
            style={{ height: 38, fontSize: 12, width: 130 }}
          >
            <option value="ALL">{isTh ? "ทุกพื้นที่ (All Areas)" : "All Areas"}</option>
            {areaOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            type="button"
            className="icon-button"
            onClick={() => void loadBookings()}
            disabled={loading}
            title={isTh ? "รีเฟรชข้อมูล" : "Refresh"}
            style={{ width: 38, height: 38 }}
          >
            <RefreshCw size={16} className={loading ? "spin" : undefined} />
          </button>

          {/* Pagination Controls */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--canvas)",
              padding: "4px 10px",
              borderRadius: 20,
              border: "1px solid var(--line)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                background: "none",
                border: "none",
                cursor: page <= 1 ? "not-allowed" : "pointer",
                opacity: page <= 1 ? 0.3 : 1,
                display: "grid",
                placeItems: "center",
                padding: 2,
              }}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                background: "none",
                border: "none",
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                opacity: page >= totalPages ? 0.3 : 1,
                display: "grid",
                placeItems: "center",
                padding: 2,
              }}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {[
          { key: "ALL", label: isTh ? "ทั้งหมด" : "All" },
          { key: "PENDING", label: isTh ? "รอดำเนินการ" : "Pending" },
          { key: "CONFIRMED", label: isTh ? "ยืนยันแล้ว" : "Confirmed" },
          { key: "RESERVED", label: isTh ? "จองแล้ว" : "Reserved" },
          { key: "CHECKED_IN", label: isTh ? "กำลังจอด" : "Checked-in" },
          { key: "OVERSTAY", label: isTh ? "เลยเวลา" : "Overstay" },
          { key: "COMPLETED", label: isTh ? "เสร็จสิ้น" : "Completed" },
          { key: "CANCELLED", label: isTh ? "ยกเลิกแล้ว" : "Cancelled" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`chip ${statusFilter === tab.key ? "active" : ""}`}
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            style={{ cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings Table / Cards */}
      {loading ? (
        <div className="empty-card">
          <div>
            <LoaderCircle size={26} className="spin" />
            <p>Loading bookings · กำลังโหลดรายการจอง</p>
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-card">
          <div>
            <div className="empty-icon">
              <CalendarCheck size={27} />
            </div>
            <h2>{isTh ? "ไม่พบรายการจองตามเงื่อนไข" : "No bookings found"}</h2>
            <p>{isTh ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" : "Try adjusting your search or filters."}</p>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--canvas)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700 }}>{isTh ? "รหัสอ้างอิง" : "Reference"}</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700 }}>{isTh ? "ผู้จอง (Who)" : "Booker"}</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700 }}>{isTh ? "รถ (Vehicle)" : "Vehicle"}</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700 }}>{isTh ? "พื้นที่ & ช่องจอด (Where)" : "Area & Slot"}</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700 }}>{isTh ? "วัน & เวลา (When)" : "Time"}</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700 }}>{isTh ? "สถานะ" : "Status"}</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, textAlign: "right" }}>{isTh ? "จัดการ" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const plate = b.vehicle_snapshot?.plate || b.vehicle_snapshot?.plate_number || "—";
                  const bookerName = b.profiles?.full_name || b.profiles?.email || "—";
                  const areaCode = b.parking_areas?.code || "—";
                  const slot = b.parking_slots?.slot_code || (isTh ? "พื้นที่รวม" : "Area Level");

                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: "1px solid var(--line)",
                        fontSize: 12,
                        transition: "background 150ms",
                      }}
                    >
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700 }}>
                        <span style={{ color: "#1e40af" }}>{b.reference}</span>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ display: "block", fontSize: 13 }}>{bookerName}</strong>
                        {b.profiles?.phone ? (
                          <small style={{ color: "var(--muted)", display: "block" }}>📞 {b.profiles.phone}</small>
                        ) : null}
                        {b.profiles?.student_id ? (
                          <small style={{ color: "var(--muted)", display: "block" }}>ID: {b.profiles.student_id}</small>
                        ) : null}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            background: "var(--canvas)",
                            border: "1px solid var(--line)",
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          🚗 {plate}
                        </span>
                        {b.vehicle_snapshot?.brand ? (
                          <small style={{ display: "block", color: "var(--muted)", marginTop: 2 }}>
                            {b.vehicle_snapshot.brand} {b.vehicle_snapshot.color ?? ""}
                          </small>
                        ) : null}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <strong>{areaCode}</strong>
                        <span style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>
                          {b.parking_areas?.name_th ?? ""} · {slot}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={13} style={{ color: "var(--muted)" }} />
                          <span>{b.booking_date}</span>
                        </div>
                        <small style={{ color: "var(--muted)", display: "block", marginTop: 2 }}>
                          🕒 {b.starts_at ? new Date(b.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} –{" "}
                          {b.ends_at ? new Date(b.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </small>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <span
                          className={`booking-status ${b.status.toLowerCase()}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 11,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {b.status === "CHECKED_IN"
                            ? isTh ? "🟢 กำลังจอด" : "🟢 Checked-in"
                            : b.status === "OVERSTAY"
                            ? isTh ? "🚨 เลยเวลา" : "🚨 Overstay"
                            : b.status === "CONFIRMED"
                            ? isTh ? "🟡 ยืนยันแล้ว" : "🟡 Confirmed"
                            : b.status === "RESERVED"
                            ? isTh ? "🟡 จองแล้ว" : "🟡 Reserved"
                            : b.status === "COMPLETED"
                            ? isTh ? "🏁 เช็คเอาท์แล้ว" : "🏁 Completed"
                            : b.status === "CANCELLED"
                            ? isTh ? "❌ ยกเลิกแล้ว" : "❌ Cancelled"
                            : b.status === "NO_SHOW"
                            ? isTh ? "⚠️ ไม่มาตามนัด" : "⚠️ No-show"
                            : isTh ? "⏳ รอดำเนินการ" : "⏳ Pending"}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            className="secondary-button small-button"
                            onClick={() => {
                              setSelectedBooking(b);
                              setEditStatus(b.status);
                            }}
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            title={isTh ? "ดูรายละเอียดและแก้ไข" : "View & Edit"}
                          >
                            <Edit3 size={13} />
                            <span>{isTh ? "ตรวจสอบ" : "Inspect"}</span>
                          </button>

                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => void handleDelete(b.id, b.reference)}
                            disabled={deletingId === b.id}
                            style={{ width: 30, height: 30, color: "var(--red)" }}
                            title={isTh ? "ลบรายการจอง" : "Delete booking"}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: "12px 20px",
              background: "var(--canvas)",
              borderTop: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <span>
              {isTh ? `พบทั้งหมด ${total} รายการ` : `Total ${total} bookings`}
            </span>
            <span>
              {isTh ? `หน้า ${page} จาก ${totalPages}` : `Page ${page} of ${totalPages}`}
            </span>
          </div>
        </div>
      )}

      {/* Detailed Inspection & Edit Modal */}
      {selectedBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedBooking(null)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 20,
              width: "min(100%, 540px)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 48px rgba(0,0,0,0.3)",
              border: "1px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
                  {isTh ? "รายละเอียดการจอง" : "Booking Inspection"}
                </span>
                <h3 style={{ margin: 0, fontSize: 18, fontFamily: "monospace", color: "#1e40af" }}>
                  {selectedBooking.reference}
                </h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedBooking(null)}
                style={{ width: 34, height: 34 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* QR Pass Preview */}
            <div style={{ marginBottom: 16 }}>
              <QrPass
                locale={locale}
                payload={selectedBooking.reference}
                reference={selectedBooking.reference}
                expiresAt={selectedBooking.ends_at}
              />
            </div>

            {/* Information Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                background: "var(--canvas)",
                padding: 14,
                borderRadius: 14,
                border: "1px solid var(--line)",
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "ผู้จอง" : "User"}</span>
                <strong>{selectedBooking.profiles?.full_name || selectedBooking.profiles?.email || "—"}</strong>
                {selectedBooking.profiles?.phone ? (
                  <span style={{ display: "block", color: "var(--muted)" }}>📞 {selectedBooking.profiles.phone}</span>
                ) : null}
              </div>

              <div>
                <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "ทะเบียนรถ" : "Plate"}</span>
                <strong>🚗 {selectedBooking.vehicle_snapshot?.plate || selectedBooking.vehicle_snapshot?.plate_number || "—"}</strong>
              </div>

              <div>
                <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "พื้นที่ & ช่องจอด" : "Area & Slot"}</span>
                <strong>
                  {selectedBooking.parking_areas?.code} · {selectedBooking.parking_slots?.slot_code || (isTh ? "พื้นที่รวม" : "Area Level")}
                </strong>
              </div>

              <div>
                <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "วันที่และเวลา" : "Schedule"}</span>
                <strong>{selectedBooking.booking_date}</strong>
                <span style={{ display: "block", color: "var(--muted)" }}>
                  {new Date(selectedBooking.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {new Date(selectedBooking.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            {/* Status Change Control */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                {isTh ? "ปรับเปลี่ยนสถานะการจอง:" : "Change Status:"}
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <select
                  className="form-control"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ height: 40 }}
                >
                  <option value="PENDING">PENDING ({isTh ? "รอดำเนินการ" : "Pending"})</option>
                  <option value="CONFIRMED">CONFIRMED ({isTh ? "ยืนยันแล้ว" : "Confirmed"})</option>
                  <option value="RESERVED">RESERVED ({isTh ? "จองแล้ว" : "Reserved"})</option>
                  <option value="CHECKED_IN">CHECKED_IN ({isTh ? "เข้าจอดแล้ว" : "Checked-in"})</option>
                  <option value="OVERSTAY">OVERSTAY ({isTh ? "เลยเวลา" : "Overstay"})</option>
                  <option value="COMPLETED">COMPLETED ({isTh ? "เสร็จสิ้น" : "Completed"})</option>
                  <option value="CANCELLED">CANCELLED ({isTh ? "ยกเลิก" : "Cancelled"})</option>
                  <option value="NO_SHOW">NO_SHOW ({isTh ? "ไม่มาตามนัด" : "No-show"})</option>
                </select>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleSaveStatus()}
                  disabled={savingStatus || editStatus === selectedBooking.status}
                  style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {savingStatus ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                  <span>{isTh ? "บันทึกสถานะ" : "Save Status"}</span>
                </button>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 14,
                borderTop: "1px solid var(--line)",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => void handleDelete(selectedBooking.id, selectedBooking.reference)}
                style={{ color: "var(--red)", borderColor: "#fecaca" }}
              >
                <Trash2 size={14} />
                <span>{isTh ? "ลบรายการนี้" : "Delete"}</span>
              </button>

              <button
                type="button"
                className="ghost-button"
                onClick={() => setSelectedBooking(null)}
              >
                {isTh ? "ปิดหน้าต่าง" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
