"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit3,
  Eye,
  Filter,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type AuditRole = "admin";

type AuditLog = {
  id: string;
  action: string;
  actor_type: string | null;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  result: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function AuditLogPanel({ locale }: { locale: Locale; role: AuditRole }) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const { confirm, notify } = useNotifications();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [actorFilter, setActorFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Detail / expand modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Edit modal
  const [editingLog, setEditingLog] = useState<AuditLog | null>(null);
  const [editAction, setEditAction] = useState("");
  const [editResult, setEditResult] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (query.trim()) params.set("q", query.trim());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      setLogs((data.logs ?? []) as AuditLog[]);
      setTotalCount(data.total ?? 0);
    } catch (error) {
      console.error("[AuditLogPanel] Failed to fetch audit logs", error);
      notify({
        title: isTh ? "โหลดประวัติไม่สำเร็จ" : "Failed to load audit logs",
        message: error instanceof Error ? error.message : "",
        kind: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, query, pageSize, isTh, notify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadLogs]);

  // Client-side filtering by result and actor
  const displayedLogs = useMemo(() => {
    return logs.filter((log) => {
      if (resultFilter !== "ALL") {
        const r = (log.result || "").toUpperCase();
        if (resultFilter === "SUCCESS" && !r.includes("SUCCESS") && !r.includes("OK")) return false;
        if (resultFilter === "FAILED" && !r.includes("FAIL") && !r.includes("ERROR")) return false;
      }
      if (actorFilter !== "ALL") {
        const a = (log.actor_type || "").toUpperCase();
        if (!a.includes(actorFilter)) return false;
      }
      return true;
    });
  }, [logs, resultFilter, actorFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Delete handler
  const handleDeleteLog = async (log: AuditLog) => {
    const confirmed = await confirm({
      title: isTh ? "ยืนยันการลบประวัติรายการ" : "Delete Audit Log",
      message: isTh
        ? `ต้องการลบประวัติรายการ "${log.action}" (${log.id.slice(0, 8)}…) ถาวรหรือไม่?`
        : `Permanently delete log "${log.action}"?`,
      confirmLabel: isTh ? "ลบรายการ" : "Delete",
      cancelLabel: t.close,
      danger: true,
    });
    if (!confirmed) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/audit-logs", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: log.id }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to delete");
      }
      notify({
        title: isTh ? "ลบประวัติรายการเรียบร้อย" : "Log deleted successfully",
        kind: "success",
      });
      if (selectedLog?.id === log.id) setSelectedLog(null);
      void loadLogs();
    } catch (err) {
      notify({
        title: isTh ? "ไม่สามารถลบรายการได้" : "Failed to delete log",
        message: err instanceof Error ? err.message : "",
        kind: "error",
      });
    }
  };

  // Open Edit Modal
  const openEditModal = (log: AuditLog) => {
    setEditingLog(log);
    setEditAction(log.action || "");
    setEditResult(log.result || "SUCCESS");
    setEditNote(typeof log.metadata?.note === "string" ? log.metadata.note : "");
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    setSavingEdit(true);
    try {
      const updatedMetadata = {
        ...(editingLog.metadata || {}),
        note: editNote.trim(),
        admin_edited_at: new Date().toISOString(),
      };

      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/audit-logs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: editingLog.id,
          action: editAction.trim(),
          result: editResult.trim(),
          metadata: updatedMetadata,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update log");
      }

      notify({
        title: isTh ? "แก้ไขประวัติรายการเรียบร้อย" : "Audit log updated",
        kind: "success",
      });
      setEditingLog(null);
      void loadLogs();
    } catch (err) {
      notify({
        title: isTh ? "ไม่สามารถแก้ไขได้" : "Failed to update",
        message: err instanceof Error ? err.message : "",
        kind: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    notify({
      title: isTh ? `คัดลอก ${label} แล้ว` : `Copied ${label}`,
      kind: "success",
    });
  };

  return (
    <div className="audit-log-panel data-manager" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div className="data-manager-heading">
        <div>
          <p className="eyebrow">{t.admin}</p>
          <h2>{isTh ? "ประวัติการทำรายการทั้งหมดในระบบ" : "System-wide Audit Logs"}</h2>
          <p className="page-subtitle">
            {isTh
              ? "ประวัติการปฏิบัติงานของทุกบัญชีผู้ใช้ ทุกบทบาท และทุกสถานะในระบบ"
              : "Audit trail of all accounts, roles, and actions in the system"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="secondary-button small-button"
            onClick={() => void loadLogs()}
            disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            title={isTh ? "รีเฟรชข้อมูล" : "Refresh"}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>{isTh ? "รีเฟรช" : "Refresh"}</span>
          </button>
          <span className="data-badge" style={{ fontSize: 13 }}>
            <History size={14} />
            {totalCount} {isTh ? "รายการ" : "records"}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="user-search-box" style={{ flex: "1 1 240px", margin: 0 }}>
          <Search size={16} />
          <input
            aria-label={isTh ? "ค้นหาประวัติการทำรายการ" : "Search audit logs"}
            placeholder={isTh ? "ค้นหา Action, ID บัญชี, Entity หรือผลลัพธ์…" : "Search action, actor ID, entity…"}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{ border: 0, background: "none", cursor: "pointer", color: "var(--muted)" }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Filter Result */}
        <label className="user-search-box" style={{ flex: "0 1 150px", margin: 0 }}>
          <Filter size={15} />
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit", font: "inherit" }}
            aria-label="Filter by result"
          >
            <option value="ALL">{isTh ? "ทุกผลลัพธ์" : "All Results"}</option>
            <option value="SUCCESS">{isTh ? "สำเร็จ (Success)" : "Success"}</option>
            <option value="FAILED">{isTh ? "ล้มเหลว (Failed)" : "Failed"}</option>
          </select>
        </label>

        {/* Filter Actor */}
        <label className="user-search-box" style={{ flex: "0 1 150px", margin: 0 }}>
          <Filter size={15} />
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit", font: "inherit" }}
            aria-label="Filter by actor"
          >
            <option value="ALL">{isTh ? "ทุกผู้ปฏิบัติ" : "All Actors"}</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
            <option value="USER">USER</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>
        </label>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="empty-card" role="status" style={{ padding: 36 }}>
          <LoaderCircle size={28} className="spin" style={{ margin: "0 auto 10px" }} />
          <p>{isTh ? "กำลังโหลดประวัติการทำรายการ…" : "Loading audit logs…"}</p>
        </div>
      ) : displayedLogs.length === 0 ? (
        /* Empty State */
        <div className="empty-card compact-empty" style={{ padding: 36, textAlign: "center" }}>
          <History size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
          <h2>
            {query || resultFilter !== "ALL" || actorFilter !== "ALL"
              ? isTh ? "ไม่พบประวัติรายการที่ตรงกับการค้นหา" : "No matching audit logs"
              : isTh ? "ยังไม่มีประวัติการทำรายการในระบบ" : "No audit history in the system"}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            {isTh ? "บันทึกการกระทำต่างๆ ของผู้ใช้และ Admin จะแสดงที่นี่โดยอัตโนมัติ" : "Actions performed across the system will appear here."}
          </p>
        </div>
      ) : (
        /* Logs List */
        <div className="audit-log-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayedLogs.map((log) => {
            const isSuccess = (log.result || "").toUpperCase().includes("SUCCESS") || (log.result || "").toUpperCase().includes("OK");
            const isFailure = (log.result || "").toUpperCase().includes("FAIL") || (log.result || "").toUpperCase().includes("ERROR");

            return (
              <article
                key={log.id}
                className="history-item"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "var(--card-bg, #ffffff)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.02em" }}>
                      {log.action}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontWeight: 600,
                        background: isSuccess ? "#dcfce7" : isFailure ? "#fee2e2" : "#f3f4f6",
                        color: isSuccess ? "#15803d" : isFailure ? "#b91c1c" : "#4b5563",
                        border: `1px solid ${isSuccess ? "#86efac" : isFailure ? "#fca5a5" : "#e5e7eb"}`,
                      }}
                    >
                      {log.result || "RECORDED"}
                    </span>
                    <span style={{ fontSize: 11, background: "var(--bg-muted, #f1f5f9)", padding: "2px 6px", borderRadius: 4, color: "var(--muted)" }}>
                      {log.actor_type || "UNKNOWN"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                      title={isTh ? "ดูรายละเอียดเพิ่มเติม" : "Inspect details"}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      <Eye size={14} />
                      <span style={{ marginLeft: 4 }}>{isTh ? "รายละเอียด" : "Inspect"}</span>
                    </button>

                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => openEditModal(log)}
                      title={isTh ? "แก้ไขข้อมูลรายการนี้" : "Edit log"}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      <Edit3 size={14} />
                      <span style={{ marginLeft: 4 }}>{isTh ? "แก้ไข" : "Edit"}</span>
                    </button>

                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void handleDeleteLog(log)}
                      title={isTh ? "ลบประวัติรายการนี้" : "Delete log"}
                      style={{ color: "var(--red, #ef4444)", padding: "4px 8px" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Sub-line */}
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                  <span>
                    <strong>Actor:</strong> {log.actor_id ? `${log.actor_id.slice(0, 10)}…` : "—"}
                  </span>
                  <span>
                    <strong>Entity:</strong> {log.entity_type || "—"} {log.entity_id ? `(${log.entity_id.slice(0, 10)}…)` : ""}
                  </span>
                  <span style={{ marginLeft: "auto" }}>
                    {formatDate(log.created_at, locale)}
                  </span>
                </div>

                {/* Expanded Details */}
                {selectedLog?.id === log.id ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: "var(--bg-muted, #f8fafc)",
                      borderRadius: 8,
                      border: "1px dashed var(--line)",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <strong style={{ fontSize: 13 }}>{isTh ? "รายละเอียดเชิงลึก (Metadata & Trace)" : "Deep Inspection"}</strong>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => copyToClipboard(JSON.stringify(log, null, 2), "JSON")}
                        style={{ fontSize: 11, padding: "2px 8px" }}
                      >
                        <Copy size={12} />
                        <span>{isTh ? "คัดลอก JSON" : "Copy JSON"}</span>
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div><strong>ID:</strong> {log.id}</div>
                      <div><strong>Created At:</strong> {log.created_at}</div>
                      <div><strong>Actor ID:</strong> {log.actor_id || "—"}</div>
                      <div><strong>Entity ID:</strong> {log.entity_id || "—"}</div>
                    </div>
                    {log.metadata ? (
                      <div>
                        <strong>Metadata:</strong>
                        <pre style={{ margin: "4px 0 0", padding: 8, background: "#1e293b", color: "#f8fafc", borderRadius: 6, overflowX: "auto", fontSize: 11 }}>
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>{isTh ? "ไม่มี metadata เพิ่มเติม" : "No metadata"}</span>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Bar: < Page / TotalPages > */}
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
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
          <span>{isTh ? "ก่อนหน้า" : "Prev"}</span>
        </button>

        <span style={{ fontSize: 13, fontWeight: 700, padding: "0 8px" }}>
          &lt; {totalCount === 0 ? "0" : `${page} / ${totalPages}`} &gt;
        </span>

        <button
          className="secondary-button small-button"
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          aria-label="Next page"
        >
          <span>{isTh ? "ถัดไป" : "Next"}</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Edit Modal */}
      {editingLog ? (
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
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>
                {isTh ? "แก้ไขข้อมูลประวัติการทำรายการ" : "Edit Audit Log Record"}
              </strong>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                style={{ border: 0, background: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label htmlFor="edit-action">{isTh ? "ชื่อ Action" : "Action Name"}</label>
                <input
                  id="edit-action"
                  className="form-control"
                  value={editAction}
                  onChange={(e) => setEditAction(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-result">{isTh ? "สถานะ / ผลลัพธ์ (Result)" : "Result Status"}</label>
                <select
                  id="edit-result"
                  className="form-control"
                  value={editResult}
                  onChange={(e) => setEditResult(e.target.value)}
                >
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILED">FAILED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="WARNING">WARNING</option>
                  <option value="RECORDED">RECORDED</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-note">{isTh ? "บันทึกโน้ตเพิ่มเติม (Admin Note)" : "Admin Note"}</label>
                <input
                  id="edit-note"
                  className="form-control"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder={isTh ? "ระบุเหตุผลหรือรายละเอียดการแก้ไข" : "Add note or rationale"}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditingLog(null)}
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

function formatDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
