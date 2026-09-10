"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  Car,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  LoaderCircle,
  Search,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type NotificationRow = {
  id: string;
  notification_type: string;
  title_th: string;
  title_en: string;
  body_th: string | null;
  body_en: string | null;
  read_at: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type FilterType = "all" | "unread" | "booking" | "alert" | "system";

const PAGE_SIZE = 8;

function getNotificationVisual(item: NotificationRow, isTh: boolean) {
  const type = (item.notification_type || "").toLowerCase();
  const text = `${item.title_th} ${item.title_en} ${item.body_th ?? ""} ${item.body_en ?? ""}`.toLowerCase();

  if (type.includes("overstay") || text.includes("overstay") || text.includes("เลยเวลา") || text.includes("เกินเวลา")) {
    return {
      icon: AlertTriangle,
      badgeLabel: isTh ? "เลยเวลา / เตือน" : "Overstay / Alert",
      bgBadge: "#fee2e2",
      colorBadge: "#dc2626",
      borderBadge: "#fecaca",
      iconBg: "rgba(239, 68, 68, 0.14)",
      iconColor: "#dc2626",
      cardBorder: "#fca5a5",
    };
  }

  if (type.includes("check_in") || text.includes("check_in") || text.includes("เช็คอิน") || text.includes("เข้าจอด")) {
    return {
      icon: Car,
      badgeLabel: isTh ? "เช็คอินแล้ว / กำลังจอด" : "Checked-in / Parked",
      bgBadge: "#dcfce7",
      colorBadge: "#15803d",
      borderBadge: "#bbf7d0",
      iconBg: "rgba(22, 163, 74, 0.14)",
      iconColor: "#16a34a",
      cardBorder: "#86efac",
    };
  }

  if (type.includes("check_out") || text.includes("check_out") || text.includes("เช็คเอาท์") || text.includes("เสร็จสิ้น")) {
    return {
      icon: CheckCircle2,
      badgeLabel: isTh ? "เช็คเอาท์แล้ว / เสร็จสิ้น" : "Checked-out / Completed",
      bgBadge: "#ecfdf5",
      colorBadge: "#047857",
      borderBadge: "#a7f3d0",
      iconBg: "rgba(5, 150, 105, 0.14)",
      iconColor: "#059669",
      cardBorder: "#6ee7b7",
    };
  }

  if (type.includes("cancel") || text.includes("cancel") || text.includes("ยกเลิก")) {
    return {
      icon: XCircle,
      badgeLabel: isTh ? "ยกเลิกแล้ว" : "Cancelled",
      bgBadge: "#f3f4f6",
      colorBadge: "#6b7280",
      borderBadge: "#e5e7eb",
      iconBg: "rgba(107, 114, 128, 0.14)",
      iconColor: "#6b7280",
      cardBorder: "#d1d5db",
    };
  }

  if (type.includes("booking") || text.includes("booking") || text.includes("จอง") || text.includes("msupk")) {
    return {
      icon: CalendarCheck,
      badgeLabel: isTh ? "การจองสำเร็จ" : "Booking Confirmed",
      bgBadge: "#fef3c7",
      colorBadge: "#92400e",
      borderBadge: "#fde68a",
      iconBg: "rgba(245, 158, 11, 0.14)",
      iconColor: "#d97706",
      cardBorder: "#fcd34d",
    };
  }

  return {
    icon: Bell,
    badgeLabel: isTh ? "ระบบ" : "System",
    bgBadge: "#f1f5f9",
    colorBadge: "#475569",
    borderBadge: "#e2e8f0",
    iconBg: "rgba(71, 85, 105, 0.1)",
    iconColor: "#64748b",
    cardBorder: "var(--line)",
  };
}

export function NotificationList({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const { notify } = useNotifications();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("id, notification_type, title_th, title_en, body_th, body_en, read_at, created_at")
        .eq("user_id", sessionData.session.user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setItems((data ?? []) as NotificationRow[]);
    } catch (error) {
      notify({
        title: t.notifications,
        message: error instanceof Error ? error.message : t.operationalData,
        kind: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [notify, t.notifications, t.operationalData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function markRead(item: NotificationRow) {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    const { error } = await createSupabaseBrowserClient()
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", item.id);

    if (error) {
      notify({ title: t.notifications, message: error.message, kind: "error" });
      return;
    }
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, read_at: readAt } : entry))
    );
  }

  async function markAllRead() {
    const unreadIds = items.filter((i) => !i.read_at).map((i) => i.id);
    if (unreadIds.length === 0) return;

    setMarkingAll(true);
    const readAt = new Date().toISOString();
    try {
      const { error } = await createSupabaseBrowserClient()
        .from("notifications")
        .update({ read_at: readAt })
        .in("id", unreadIds);

      if (error) throw error;

      setItems((current) => current.map((entry) => ({ ...entry, read_at: readAt })));
      notify({
        title: t.notifications,
        message: isTh ? "อ่านการแจ้งเตือนทั้งหมดแล้ว" : "All notifications marked as read",
        kind: "success",
      });
    } catch (err) {
      notify({
        title: t.notifications,
        message: err instanceof Error ? err.message : "Error marking all as read",
        kind: "error",
      });
    } finally {
      setMarkingAll(false);
    }
  }

  // Extract booking reference from text or metadata
  function extractBookingRef(item: NotificationRow): string | null {
    if (item.metadata?.booking_reference) {
      return String(item.metadata.booking_reference);
    }
    const fullText = `${item.title_th} ${item.title_en} ${item.body_th ?? ""} ${item.body_en ?? ""}`;
    const match = fullText.match(/MSUPK-(?:BKG-)?[0-9A-Za-z_-]+/i);
    return match ? match[0] : null;
  }

  // Filter and search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filter tab
      if (filter === "unread" && item.read_at) return false;
      if (filter === "booking" && !item.notification_type?.toLowerCase().includes("booking") && !extractBookingRef(item)) return false;
      if (filter === "alert") {
        const fullText = `${item.title_th} ${item.title_en} ${item.body_th ?? ""} ${item.body_en ?? ""}`.toLowerCase();
        const ntype = (item.notification_type || "").toLowerCase();
        if (!ntype.includes("overstay") && !fullText.includes("overstay") && !fullText.includes("เลยเวลา") && !fullText.includes("เกินเวลา") && !ntype.includes("warning")) return false;
      }
      if (filter === "system") {
        const isBkg = item.notification_type?.toLowerCase().includes("booking") || Boolean(extractBookingRef(item));
        const isAlert = item.notification_type?.toLowerCase().includes("overstay");
        if (isBkg || isAlert) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const ref = extractBookingRef(item)?.toLowerCase() ?? "";
        const title = (isTh ? item.title_th : item.title_en).toLowerCase();
        const body = (isTh ? item.body_th ?? "" : item.body_en ?? "").toLowerCase();
        return title.includes(q) || body.includes(q) || ref.includes(q);
      }
      return true;
    });
  }, [items, filter, searchQuery, isTh]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  const unreadCount = items.filter((i) => !i.read_at).length;

  if (loading) {
    return (
      <div className="empty-card">
        <div>
          <LoaderCircle size={26} className="spin" />
          <p>Loading · กำลังโหลด</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Search & Actions Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 16,
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
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
            placeholder={isTh ? "ค้นหาการแจ้งเตือน, รหัสจอง..." : "Search notifications, booking ref..."}
            style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="ghost-button"
              onClick={() => void markAllRead()}
              disabled={markingAll}
              style={{ fontSize: 12, height: 36, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <CheckCheck size={15} />
              {markingAll ? (isTh ? "กำลังบันทึก..." : "Saving...") : isTh ? "อ่านแล้วทั้งหมด" : "Mark all as read"}
            </button>
          ) : null}

          {/* Pagination Controls */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--canvas)",
              padding: "4px 8px",
              borderRadius: 20,
              border: "1px solid var(--line)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{
                background: "none",
                border: "none",
                cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                opacity: currentPage <= 1 ? 0.3 : 1,
                display: "grid",
                placeItems: "center",
                padding: 2,
              }}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                background: "none",
                border: "none",
                cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                opacity: currentPage >= totalPages ? 0.3 : 1,
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

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        <button
          type="button"
          className={`chip ${filter === "all" ? "active" : ""}`}
          onClick={() => {
            setFilter("all");
            setPage(1);
          }}
          style={{ cursor: "pointer" }}
        >
          {isTh ? "ทั้งหมด" : "All"} ({items.length})
        </button>
        <button
          type="button"
          className={`chip ${filter === "unread" ? "active" : ""}`}
          onClick={() => {
            setFilter("unread");
            setPage(1);
          }}
          style={{ cursor: "pointer" }}
        >
          {isTh ? "ยังไม่ได้อ่าน" : "Unread"} ({unreadCount})
        </button>
        <button
          type="button"
          className={`chip ${filter === "booking" ? "active" : ""}`}
          onClick={() => {
            setFilter("booking");
            setPage(1);
          }}
          style={{ cursor: "pointer" }}
        >
          <CalendarCheck size={13} style={{ display: "inline", marginRight: 4 }} />
          {isTh ? "การจอง" : "Bookings"}
        </button>
        <button
          type="button"
          className={`chip ${filter === "alert" ? "active" : ""}`}
          onClick={() => {
            setFilter("alert");
            setPage(1);
          }}
          style={{ cursor: "pointer" }}
        >
          <AlertTriangle size={13} style={{ display: "inline", marginRight: 4, color: "#dc2626" }} />
          {isTh ? "เลยเวลา / แจ้งเตือน" : "Alerts"}
        </button>
        <button
          type="button"
          className={`chip ${filter === "system" ? "active" : ""}`}
          onClick={() => {
            setFilter("system");
            setPage(1);
          }}
          style={{ cursor: "pointer" }}
        >
          <Info size={13} style={{ display: "inline", marginRight: 4 }} />
          {isTh ? "ระบบ" : "System"}
        </button>
      </div>

      {/* Notifications List */}
      {paginatedItems.length === 0 ? (
        <div className="empty-card">
          <div>
            <div className="empty-icon">
              <Bell size={27} />
            </div>
            <h2>{searchQuery || filter !== "all" ? (isTh ? "ไม่พบการแจ้งเตือนตามเงื่อนไข" : "No matching notifications") : t.noNotifications}</h2>
            <p>{t.notificationNote}</p>
          </div>
        </div>
      ) : (
        <section className="notification-list" style={{ display: "grid", gap: 12 }}>
          {paginatedItems.map((item) => {
            const bookingRef = extractBookingRef(item);
            const isUnread = !item.read_at;
            const visual = getNotificationVisual(item, isTh);
            const VisualIcon = visual.icon;

            return (
              <article
                className={`notification-card ${item.read_at ? "read" : "unread"}`}
                key={item.id}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  padding: "16px 18px",
                  background: "var(--surface)",
                  border: isUnread ? `1.5px solid ${visual.cardBorder}` : "1px solid var(--line)",
                  borderRadius: 16,
                  boxShadow: isUnread ? "0 4px 16px rgba(0, 0, 0, 0.08)" : "none",
                  position: "relative",
                }}
              >
                <div
                  className="notification-card-icon"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    background: visual.iconBg,
                    color: visual.iconColor,
                    flexShrink: 0,
                  }}
                >
                  <VisualIcon size={20} />
                </div>

                <div className="notification-card-copy" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <strong style={{ fontSize: 14 }}>{isTh ? item.title_th : item.title_en}</strong>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: visual.colorBadge,
                        background: visual.bgBadge,
                        border: `1px solid ${visual.borderBadge}`,
                        padding: "2px 8px",
                        borderRadius: 8,
                      }}
                    >
                      {visual.badgeLabel}
                    </span>
                    {isUnread ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#9a7800",
                          background: "var(--gold-soft)",
                          padding: "2px 8px",
                          borderRadius: 8,
                        }}
                      >
                        {isTh ? "ใหม่" : "NEW"}
                      </span>
                    ) : null}
                  </div>

                  <p style={{ margin: "4px 0 8px", fontSize: 13, color: "var(--ink)", lineHeight: 1.45 }}>
                    {isTh ? item.body_th : item.body_en}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <small style={{ color: "var(--muted)", fontSize: 11 }}>
                      {formatDate(item.created_at, locale)}
                    </small>

                    {/* Direct Booking Link button */}
                    {bookingRef ? (
                      <Link
                        href={`/${locale}/app/bookings/${bookingRef}`}
                        className="ghost-button"
                        style={{
                          fontSize: 11,
                          padding: "4px 10px",
                          height: 28,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#1e3a8a",
                          borderColor: "#bfdbfe",
                          background: "#eff6ff",
                          borderRadius: 8,
                          fontWeight: 600,
                        }}
                      >
                        {isTh ? "ดูรายละเอียดการจอง" : "View Booking Details"}
                        <ExternalLink size={12} />
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div style={{ flexShrink: 0, alignSelf: "center" }}>
                  {item.read_at ? (
                    <span title={isTh ? "อ่านแล้ว" : "Read"} style={{ color: "var(--green)" }}>
                      <Check size={18} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void markRead(item)}
                      style={{ fontSize: 11, padding: "5px 12px", height: 30, borderRadius: 8 }}
                    >
                      {t.markRead}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(locale === "th" ? "th-TH" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}
