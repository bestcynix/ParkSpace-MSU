"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileWarning,
  Filter,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type IncidentRole = "admin" | "staff";
type IncidentStatus = "NEW" | "REVIEWING" | "IN_PROGRESS" | "RESOLVED";

type IncidentItem = {
  id: string;
  category: string;
  notes: string;
  status: IncidentStatus;
  created_at: string;
  updated_at?: string;
  parking_area_id: string;
  parking_slot_id: string | null;
  reported_by?: string;
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
  profiles?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

const CATEGORIES: Array<{ key: string; labelTh: string; labelEn: string }> = [
  { key: "BLOCKED_EXIT", labelTh: "สิ่งกีดขวาง / จอดขวางทาง", labelEn: "Blocked Exit / Obstacle" },
  { key: "WRONG_AREA", labelTh: "จอดผิดพื้นที่ / ผิดประเภทรถ", labelEn: "Wrong Area / Vehicle Type" },
  { key: "OVERSTAY", labelTh: "จอดเกินเวลา / ไม่เช็คเอาท์", labelEn: "Overstay / Unchecked Out" },
  { key: "VEHICLE", labelTh: "ปัญหารถ / ลืมปิดไฟ / น้ำมันรั่ว", labelEn: "Vehicle Issue / Lights / Leak" },
  { key: "QR_CODE", labelTh: "ปัญหาเกี่ยวกับ QR Code / บัตรผ่าน", labelEn: "QR Code / Pass Issue" },
  { key: "ACCIDENT", labelTh: "อุบัติเหตุ / เฉี่ยวชน", labelEn: "Accident / Collision" },
  { key: "EQUIPMENT", labelTh: "อุปกรณ์ / ป้ายบอกทางชำรุด", labelEn: "Equipment / Facility Damage" },
  { key: "OTHER", labelTh: "เหตุการณ์อื่นๆ", labelEn: "Other Incident" },
];

function statusColor(status: IncidentStatus) {
  switch (status) {
    case "NEW":
      return { bg: "rgba(239, 68, 68, 0.12)", color: "#dc2626", border: "#fca5a5" };
    case "REVIEWING":
      return { bg: "rgba(245, 158, 11, 0.12)", color: "#d97706", border: "#fcd34d" };
    case "IN_PROGRESS":
      return { bg: "rgba(59, 130, 246, 0.12)", color: "#2563eb", border: "#93c5fd" };
    case "RESOLVED":
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#16a34a", border: "#86efac" };
  }
}

function statusLabel(status: IncidentStatus, locale: Locale) {
  const isTh = locale === "th";
  switch (status) {
    case "NEW":
      return isTh ? "รอตรวจสอบ (New)" : "New";
    case "REVIEWING":
      return isTh ? "กำลังตรวจสอบ (Reviewing)" : "Reviewing";
    case "IN_PROGRESS":
      return isTh ? "กำลังดำเนินการ (In Progress)" : "In Progress";
    case "RESOLVED":
      return isTh ? "แก้ไขแล้ว (Resolved)" : "Resolved";
  }
}

function categoryLabel(catKey: string, locale: Locale) {
  const isTh = locale === "th";
  const found = CATEGORIES.find((c) => c.key === catKey);
  if (found) return isTh ? found.labelTh : found.labelEn;
  return catKey;
}

export function IncidentForm({ locale, role = "staff" }: { locale: Locale; role?: IncidentRole }) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const { confirm, notify } = useNotifications();

  // Mode: "history" (default to show all records) or "report"
  const [activeTab, setActiveTab] = useState<"history" | "report">("history");

  // Incidents List state
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, new: 0, reviewing: 0, in_progress: 0, resolved: 0, unresolved: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Areas list for dropdown
  const [areas, setAreas] = useState<Array<{ id: string; code: string; name_th: string }>>([]);

  // Report Form state
  const [formCategory, setFormCategory] = useState("BLOCKED_EXIT");
  const [formAreaId, setFormAreaId] = useState("");
  const [formSlotCode, setFormSlotCode] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch areas on mount
  useEffect(() => {
    async function loadAreasList() {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.from("parking_areas").select("id, code, name_th").order("code");
        if (data && data.length > 0) {
          setAreas(data);
          setFormAreaId((current) => current || data[0].id);
        }
      } catch {
        // silent
      }
    }
    void loadAreasList();
  }, []);

  // Fetch incidents list
  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (areaFilter !== "ALL") params.set("areaId", areaFilter);

      const res = await fetch(`/api/incidents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load incidents");
      const data = await res.json();
      setIncidents(data.incidents || []);
      setTotal(data.total || 0);
      if (data.counts) setCounts(data.counts);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [areaFilter, categoryFilter, page, searchQuery, statusFilter]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  // Handle report submission
  async function handleSubmitReport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formNotes.trim()) {
      notify({
        title: isTh ? "กรุณากรอกรายละเอียดเหตุการณ์" : "Please provide incident notes",
        kind: "error",
      });
      return;
    }
    if (!formAreaId) {
      notify({
        title: isTh ? "กรุณาเลือกพื้นที่" : "Please select parking area",
        kind: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          category: formCategory,
          notes: formNotes.trim(),
          parking_area_id: formAreaId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit incident report");

      notify({
        title: isTh ? "บันทึกรายงานเหตุการณ์สำเร็จ" : "Incident reported successfully",
        message: isTh ? "ระบบได้บันทึกรายงานและแจ้งเตือนผู้ดูแลเรียบร้อยแล้ว" : "Report saved and logged.",
        kind: "success",
      });

      setFormNotes("");
      setActiveTab("history");
      void loadIncidents();
    } catch (err) {
      notify({
        title: isTh ? "เกิดข้อผิดพลาดในการบันทึก" : "Report error",
        message: err instanceof Error ? err.message : "Error submitting report",
        kind: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Handle status update
  async function handleStatusChange(id: string, newStatus: IncidentStatus) {
    setUpdatingId(id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/incidents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update incident status");

      setIncidents((current) =>
        current.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );

      notify({
        title: isTh ? "อัปเดตสถานะสำเร็จ" : "Status updated",
        message: `${statusLabel(newStatus, locale)}`,
        kind: "success",
      });
      void loadIncidents();
    } catch (err) {
      notify({
        title: isTh ? "ไม่สามารถเปลี่ยนสถานะได้" : "Update failed",
        message: err instanceof Error ? err.message : "Error",
        kind: "error",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  // Handle incident deletion (Admin only)
  async function handleDeleteIncident(id: string) {
    const ok = await confirm({
      title: isTh ? "ยืนยันการลบรายงานเหตุการณ์?" : "Confirm Delete Incident?",
      message: isTh
        ? "คุณแน่ใจหรือไม่ว่าต้องการลบรายการเหตุการณ์นี้ออกจากประวัติระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
        : "Are you sure you want to permanently delete this incident? This action cannot be undone.",
      confirmLabel: isTh ? "ลบรายการ" : "Delete",
      cancelLabel: isTh ? "ยกเลิก" : "Cancel",
      danger: true,
    });
    if (!ok) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/incidents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Delete failed");

      setIncidents((current) => current.filter((item) => item.id !== id));
      notify({
        title: isTh ? "ลบรายการเหตุการณ์สำเร็จ" : "Incident deleted",
        kind: "success",
      });
      void loadIncidents();
    } catch (err) {
      notify({
        title: isTh ? "เกิดข้อผิดพลาดในการลบ" : "Delete error",
        message: err instanceof Error ? err.message : "Failed to delete incident",
        kind: "error",
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header & Mode Switcher */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "16px 20px",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--line)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileWarning size={22} color="#f59e0b" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {isTh ? "รายงานและจัดการเหตุการณ์หน้างาน" : "On-site Incident Management"}
            </h2>
          </div>
          <p className="page-subtitle" style={{ margin: "4px 0 0" }}>
            {isTh
              ? `เหตุการณ์รอดำเนินการ: ${counts.unresolved} รายการ · ประวัติทั้งหมด: ${counts.total} รายการ`
              : `Unresolved: ${counts.unresolved} · Total: ${counts.total}`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className={activeTab === "history" ? "primary-button" : "secondary-button"}
            onClick={() => setActiveTab("history")}
            style={{ fontSize: 13 }}
          >
            {isTh ? "รายการเหตุการณ์ & ประวัติทั้งหมด" : "All Incidents & History"}
            {counts.unresolved > 0 ? (
              <span
                style={{
                  background: activeTab === "history" ? "rgba(255,255,255,0.25)" : "#ef4444",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: 11,
                  marginLeft: 4,
                  fontWeight: 700,
                }}
              >
                {counts.unresolved}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={activeTab === "report" ? "primary-button" : "secondary-button"}
            onClick={() => setActiveTab("report")}
            style={{ fontSize: 13 }}
          >
            <Plus size={15} />
            {isTh ? "รายงานเหตุการณ์ใหม่" : "Report Incident"}
          </button>
        </div>
      </div>

      {activeTab === "report" ? (
        /* Report Form Card */
        <form
          className="form-card"
          onSubmit={(e) => void handleSubmitReport(e)}
          style={{ maxWidth: 700, margin: "0 auto", width: "100%" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <AlertTriangle size={24} color="#ef4444" />
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {isTh ? "แบบฟอร์มรายงานเหตุการณ์หน้างาน" : "Report New Incident"}
              </h3>
              <p className="page-subtitle" style={{ margin: "2px 0 0" }}>
                {isTh
                  ? "ระบุประเภทเหตุการณ์ พื้นที่เกิดเหตุ และรายละเอียดเพื่อให้ทีมเจ้าหน้าที่เข้าช่วยเหลือ"
                  : "Specify incident type, location, and observations for swift operational dispatch."}
              </p>
            </div>
          </div>

          <div className="support-form-grid">
            <div className="form-group">
              <label htmlFor="incident-category">
                {isTh ? "ประเภทเหตุการณ์" : "Incident Category"} *
              </label>
              <select
                className="form-control"
                id="incident-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                required
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {isTh ? cat.labelTh : cat.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="incident-area">
                {isTh ? "พื้นที่เกิดเหตุ" : "Parking Area"} *
              </label>
              <select
                className="form-control"
                id="incident-area"
                value={formAreaId}
                onChange={(e) => setFormAreaId(e.target.value)}
                required
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name_th}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label htmlFor="incident-notes">
              {isTh ? "บันทึกรายละเอียดเหตุการณ์" : "Incident Notes & Observations"} *
            </label>
            <textarea
              className="form-control"
              id="incident-notes"
              rows={4}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder={
                isTh
                  ? "เช่น: รถยนต์เก๋งสีขาวจอดขวางทางลาดขึ้นลงแถว B เจ้าหน้าที่แจ้งเตือนแล้ว..."
                  : "e.g. White sedan blocking ramp on Row B, security informed..."
              }
              required
              style={{ paddingTop: 10, lineHeight: 1.5 }}
            />
          </div>

          <div className="support-form-actions" style={{ marginTop: 16 }}>
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
              {submitting ? (isTh ? "กำลังบันทึก…" : "Submitting…") : isTh ? "ส่งรายงานเหตุการณ์" : "Submit Report"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setActiveTab("history")}
            >
              {isTh ? "ยกเลิก" : "Cancel"}
            </button>
          </div>
        </form>
      ) : (
        /* History & Filter View */
        <div style={{ display: "grid", gap: 16 }}>
          {/* Filters Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "16px 20px",
              background: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 260px", maxWidth: 400 }}>
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
                  placeholder={isTh ? "ค้นหาในบันทึกเหตุการณ์, ประเภท..." : "Search incident notes, category..."}
                  style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Category filter */}
              <select
                className="form-control"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                style={{ height: 38, fontSize: 12, minWidth: 140 }}
                aria-label={isTh ? "กรองประเภทเหตุการณ์" : "Filter category"}
              >
                <option value="ALL">{isTh ? "ทุกประเภทเหตุการณ์" : "All Categories"}</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {isTh ? cat.labelTh : cat.labelEn}
                  </option>
                ))}
              </select>

              {/* Area filter */}
              <select
                className="form-control"
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setPage(1);
                }}
                style={{ height: 38, fontSize: 12, width: 130 }}
                aria-label={isTh ? "กรองพื้นที่" : "Filter area"}
              >
                <option value="ALL">{isTh ? "ทุกพื้นที่ (All)" : "All Areas"}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code}
                  </option>
                ))}
              </select>

              {/* Refresh button */}
              <button
                type="button"
                className="icon-button"
                onClick={() => void loadIncidents()}
                disabled={loading}
                title={isTh ? "รีเฟรชข้อมูล" : "Refresh"}
                style={{ width: 38, height: 38 }}
              >
                <RefreshCw size={16} className={loading ? "spin" : undefined} />
              </button>

              {/* Pagination */}
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
                <span>{page} / {totalPages}</span>
              </div>
            </div>
          </div>

          {/* Quick Status Chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {[
              { key: "ALL", label: isTh ? "ทั้งหมด" : "All", count: counts.total },
              { key: "NEW", label: isTh ? "รอตรวจสอบ" : "New", count: counts.new, color: "#dc2626" },
              { key: "REVIEWING", label: isTh ? "กำลังตรวจสอบ" : "Reviewing", count: counts.reviewing, color: "#d97706" },
              { key: "IN_PROGRESS", label: isTh ? "กำลังดำเนินการ" : "In Progress", count: counts.in_progress, color: "#2563eb" },
              { key: "RESOLVED", label: isTh ? "แก้ไขแล้ว" : "Resolved", count: counts.resolved, color: "#16a34a" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`chip ${statusFilter === tab.key ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter(tab.key);
                  setPage(1);
                }}
                style={{ cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "0 5px",
                    borderRadius: 8,
                    background: statusFilter === tab.key ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)",
                    color: statusFilter === tab.key ? "inherit" : tab.color || "inherit",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Incidents Cards List */}
          {loading ? (
            <div className="empty-card">
              <div>
                <LoaderCircle size={26} className="spin" />
                <p>{isTh ? "กำลังโหลดรายการเหตุการณ์…" : "Loading incidents…"}</p>
              </div>
            </div>
          ) : incidents.length === 0 ? (
            <div className="empty-card">
              <div>
                <CheckCircle2 size={32} color="#16a34a" />
                <h2>{isTh ? "ไม่พบเหตุการณ์ตามเงื่อนไข" : "No incidents found"}</h2>
                <p className="page-subtitle">
                  {isTh
                    ? "ไม่มีรายงานเหตุการณ์ที่ตรงกับตัวกรอง หรือทุกเหตุการณ์ได้รับการแก้ไขแล้ว"
                    : "No incident reports match your query, or all incidents are resolved."}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {incidents.map((incident) => {
                const colors = statusColor(incident.status);
                const areaInfo = incident.parking_areas;
                const reporter = incident.profiles;
                const createdDate = new Date(incident.created_at).toLocaleString(
                  locale === "th" ? "th-TH" : "en-US",
                  { dateStyle: "medium", timeStyle: "short" }
                );

                return (
                  <article
                    key={incident.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderLeft: `4px solid ${colors.color}`,
                      borderRadius: 14,
                      padding: "16px 20px",
                      display: "grid",
                      gap: 10,
                      transition: "box-shadow 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            background: colors.bg,
                            color: colors.color,
                            fontWeight: 700,
                            fontSize: 12,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {statusLabel(incident.status, locale)}
                        </span>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            background: "var(--canvas)",
                            border: "1px solid var(--line)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {categoryLabel(incident.category, locale)}
                        </span>
                        {areaInfo ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 12,
                              color: "var(--muted)",
                            }}
                          >
                            <MapPin size={13} />
                            <strong>{areaInfo.code}</strong> · {isTh ? areaInfo.name_th : areaInfo.name_en}
                          </span>
                        ) : null}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={13} color="var(--muted)" />
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{createdDate}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--foreground)" }}>
                      {incident.notes}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                        paddingTop: 8,
                        borderTop: "1px solid var(--line)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                        <User size={14} />
                        <span>
                          {isTh ? "ผู้รายงาน: " : "Reported by: "}
                          <strong>{reporter?.full_name || reporter?.email || (isTh ? "เจ้าหน้าที่ระบบ" : "Staff")}</strong>
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Status dropdown to update status directly */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {isTh ? "ปรับสถานะ:" : "Status:"}
                          </span>
                          <select
                            className="form-control"
                            value={incident.status}
                            disabled={updatingId === incident.id}
                            onChange={(e) => void handleStatusChange(incident.id, e.target.value as IncidentStatus)}
                            style={{ height: 32, fontSize: 12, padding: "0 8px", width: 140 }}
                          >
                            <option value="NEW">{isTh ? "รอตรวจสอบ (New)" : "New"}</option>
                            <option value="REVIEWING">{isTh ? "กำลังตรวจสอบ" : "Reviewing"}</option>
                            <option value="IN_PROGRESS">{isTh ? "กำลังดำเนินการ" : "In Progress"}</option>
                            <option value="RESOLVED">{isTh ? "แก้ไขแล้ว (Resolved)" : "Resolved"}</option>
                          </select>
                        </div>

                        {/* Admin delete button */}
                        {role === "admin" ? (
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => void handleDeleteIncident(incident.id)}
                            title={isTh ? "ลบรายงานเหตุการณ์" : "Delete incident"}
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
      )}
    </div>
  );
}
