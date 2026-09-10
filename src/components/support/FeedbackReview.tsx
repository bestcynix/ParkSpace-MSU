"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  LoaderCircle,
  MessageSquare,
  Search,
  Star,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ReviewRole = "admin";
type FeedbackStatus = "NEW" | "REVIEWING" | "IN_PROGRESS" | "RESOLVED";

type BugRow = {
  id: string;
  subject: string;
  message: string;
  severity: string;
  route: string | null;
  status: FeedbackStatus;
  created_at: string;
};

type EvaluationAnswers = {
  type?: string;
  locale?: string;
  systems?: {
    overall?: number;
    login?: number;
    parking?: number;
    booking?: number;
    profile?: number;
  };
};

type RatingRow = {
  id: string;
  overall_rating: number | null;
  comment: string | null;
  answers: EvaluationAnswers | null;
  created_at: string;
};

type ErrorRow = {
  id: string;
  route: string | null;
  severity: string;
  message: string;
  created_at: string;
};

const ITEMS_PER_PAGE = 6;

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function FeedbackReview({ locale, role, includeErrors = false }: { locale: Locale; role: ReviewRole; includeErrors?: boolean }) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  // Pagination states
  const [bugPage, setBugPage] = useState(1);
  const [ratingPage, setRatingPage] = useState(1);
  const [errorPage, setErrorPage] = useState(1);
  const [errorSearch, setErrorSearch] = useState("");
  const [errorSeverity, setErrorSeverity] = useState("ALL");

  const loadReview = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setMessage(t.signInRequired);
        return;
      }
      const [bugResult, ratingResult] = await Promise.all([
        supabase.from("feedback").select("id, subject, message, severity, route, status, created_at").eq("category", "BUG").order("created_at", { ascending: false }).limit(200),
        supabase.from("evaluations").select("id, overall_rating, comment, answers, created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      if (bugResult.error) throw bugResult.error;
      if (ratingResult.error) throw ratingResult.error;
      setBugs((bugResult.data ?? []) as BugRow[]);
      setRatings((ratingResult.data ?? []) as RatingRow[]);
      if (includeErrors) {
        const errorResult = await supabase.from("error_logs").select("id, route, severity, message, created_at").order("created_at", { ascending: false }).limit(200);
        if (errorResult.error) throw errorResult.error;
        setErrors((errorResult.data ?? []) as ErrorRow[]);
      }
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }, [includeErrors, t.accountNotConfigured, t.accountNotConfiguredEn, t.operationalData, t.signInRequired]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReview(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReview]);

  async function updateBugStatus(id: string, status: FeedbackStatus) {
    setUpdatingId(id);
    try {
      const { error } = await createSupabaseBrowserClient().from("feedback").update({ status }).eq("id", id);
      if (error) throw error;
      setBugs((current) => current.map((bug) => bug.id === id ? { ...bug, status } : bug));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setUpdatingId("");
    }
  }

  // Analytics Computations
  const rated = useMemo(() => ratings.filter((r) => typeof r.overall_rating === "number" && r.overall_rating > 0), [ratings]);
  const overallAverage = rated.length ? (rated.reduce((sum, r) => sum + (r.overall_rating ?? 0), 0) / rated.length).toFixed(1) : "—";

  const categories = useMemo(() => [
    { key: "overall", labelTh: "ภาพรวมระบบ", labelEn: "Overall Experience" },
    { key: "login", labelTh: "การเข้าสู่ระบบ", labelEn: "Authentication" },
    { key: "parking", labelTh: "ค้นหาข้อมูลลานจอด", labelEn: "Parking Discovery" },
    { key: "booking", labelTh: "การจองช่องจอด", labelEn: "Slot Booking" },
    { key: "profile", labelTh: "โปรไฟล์และข้อมูลรถ", labelEn: "Profile & Vehicles" },
  ] as const, []);

  const categoryScores = useMemo(() => {
    return categories.map((cat) => {
      const scores = ratings
        .map((r) => {
          const sysVal = r.answers?.systems?.[cat.key];
          if (typeof sysVal === "number" && sysVal > 0) {
            return sysVal;
          }
          if (cat.key === "overall" && typeof r.overall_rating === "number" && r.overall_rating > 0) {
            return r.overall_rating;
          }
          return null;
        })
        .filter((v): v is number => v !== null);

      const count = scores.length;
      const average = count ? (scores.reduce((a, b) => a + b, 0) / count).toFixed(1) : "—";
      const percentage = count ? Math.round((Number(average) / 5) * 100) : 0;
      return { ...cat, count, average, percentage };
    });
  }, [categories, ratings]);

  const starDistribution = useMemo(() => {
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = rated.filter((r) => r.overall_rating === stars).length;
      const percentage = rated.length ? Math.round((count / rated.length) * 100) : 0;
      return { stars, count, percentage };
    });
  }, [rated]);

  // Export handlers
  function exportEvaluationsCsv() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const headers = [
      "ID",
      "Created At",
      "Overall Rating",
      "Login Rating",
      "Parking Rating",
      "Booking Rating",
      "Profile Rating",
      "Comment",
    ];
    const dataRows = ratings.map((r) => [
      `"${r.id}"`,
      `"${r.created_at}"`,
      r.overall_rating ?? "",
      r.answers?.systems?.login ?? "",
      r.answers?.systems?.parking ?? "",
      r.answers?.systems?.booking ?? "",
      r.answers?.systems?.profile ?? "",
      `"${(r.comment ?? "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...dataRows.map((r) => r.join(","))].join("\r\n");
    downloadFile(csvContent, `parkspace_evaluations_${timestamp}.csv`, "text/csv;charset=utf-8;");
  }

  function exportEvaluationsJson() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const jsonContent = JSON.stringify(ratings, null, 2);
    downloadFile(jsonContent, `parkspace_evaluations_${timestamp}.json`, "application/json;charset=utf-8;");
  }

  function exportBugsCsv() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const headers = ["ID", "Created At", "Subject", "Severity", "Route", "Status", "Message"];
    const dataRows = bugs.map((b) => [
      `"${b.id}"`,
      `"${b.created_at}"`,
      `"${b.subject.replace(/"/g, '""')}"`,
      `"${b.severity}"`,
      `"${(b.route ?? "").replace(/"/g, '""')}"`,
      `"${b.status}"`,
      `"${b.message.replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...dataRows.map((r) => r.join(","))].join("\r\n");
    downloadFile(csvContent, `parkspace_bugs_${timestamp}.csv`, "text/csv;charset=utf-8;");
  }

  function exportBugsJson() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const jsonContent = JSON.stringify(bugs, null, 2);
    downloadFile(jsonContent, `parkspace_bugs_${timestamp}.json`, "application/json;charset=utf-8;");
  }

  function exportErrorsCsv() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const headers = ["ID", "Created At", "Route", "Severity", "Message"];
    const dataRows = filteredErrors.map((e) => [
      `"${e.id}"`,
      `"${e.created_at}"`,
      `"${(e.route ?? "").replace(/"/g, '""')}"`,
      `"${e.severity}"`,
      `"${e.message.replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...dataRows.map((r) => r.join(","))].join("\r\n");
    downloadFile(csvContent, `parkspace_errors_${timestamp}.csv`, "text/csv;charset=utf-8;");
  }

  function exportErrorsJson() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const jsonContent = JSON.stringify(filteredErrors, null, 2);
    downloadFile(jsonContent, `parkspace_errors_${timestamp}.json`, "application/json;charset=utf-8;");
  }

  const filteredErrors = useMemo(() => {
    const q = errorSearch.trim().toLowerCase();
    return errors.filter((err) => {
      if (errorSeverity !== "ALL" && err.severity.toUpperCase() !== errorSeverity) return false;
      if (q) {
        const matchRoute = (err.route || "").toLowerCase().includes(q);
        const matchMsg = (err.message || "").toLowerCase().includes(q);
        if (!matchRoute && !matchMsg) return false;
      }
      return true;
    });
  }, [errors, errorSearch, errorSeverity]);

  const errorSeverityCounts = useMemo(() => ({
    all: errors.length,
    critical: errors.filter((e) => e.severity.toUpperCase() === "CRITICAL").length,
    high: errors.filter((e) => e.severity.toUpperCase() === "HIGH").length,
    medium: errors.filter((e) => e.severity.toUpperCase() === "MEDIUM").length,
    low: errors.filter((e) => e.severity.toUpperCase() === "LOW").length,
  }), [errors]);

  // Paginated Slices
  const totalBugPages = Math.max(1, Math.ceil(bugs.length / ITEMS_PER_PAGE));
  const paginatedBugs = bugs.slice((bugPage - 1) * ITEMS_PER_PAGE, bugPage * ITEMS_PER_PAGE);

  const totalRatingPages = Math.max(1, Math.ceil(ratings.length / ITEMS_PER_PAGE));
  const paginatedRatings = ratings.slice((ratingPage - 1) * ITEMS_PER_PAGE, ratingPage * ITEMS_PER_PAGE);

  const totalErrorPages = Math.max(1, Math.ceil(filteredErrors.length / ITEMS_PER_PAGE));
  const paginatedErrors = filteredErrors.slice((errorPage - 1) * ITEMS_PER_PAGE, errorPage * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="empty-card">
        <div>
          <div className="empty-icon"><LoaderCircle size={26} className="spin" /></div>
          <h2>Loading · กำลังโหลด</h2>
          <p>{t.reviewFeedback}</p>
        </div>
      </div>
    );
  }

  if (message && !bugs.length && !ratings.length && !errors.length) {
    return (
      <div className="empty-card">
        <div>
          <div className="empty-icon"><AlertTriangle size={26} /></div>
          <h2>{message}</h2>
          <p>{t.admin}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-center">
      {/* Top Stat Summary Grid */}
      <div className="review-summary-grid">
        <div className="dashboard-card">
          <Bug size={18} color="#a27e00" />
          <p>{t.reportBug}</p>
          <strong>{bugs.length}</strong>
          <small>{t.feedbackStatus}</small>
        </div>
        <div className="dashboard-card">
          <Star size={18} color="#a27e00" />
          <p>{t.averageRating}</p>
          <strong>{overallAverage}</strong>
          <small>{rated.length} {t.ratingCount}</small>
        </div>
        <div className="dashboard-card">
          <MessageSquare size={18} color="#a27e00" />
          <p>{t.feedbackCenter}</p>
          <strong>{ratings.length}</strong>
          <small>{t.operationalData}</small>
        </div>
        {includeErrors ? (
          <div className="dashboard-card">
            <AlertTriangle size={18} color="#a27e00" />
            <p>{t.errorLogs}</p>
            <strong>{errors.length}</strong>
            <small>{t.admin}</small>
          </div>
        ) : null}
      </div>

      {/* Dedicated Error Review Section when section === 'errors' */}
      {includeErrors ? (
        <section className="review-panel" aria-labelledby="error-logs-heading">
          <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 id="error-logs-heading" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={20} color="#dc2626" />
                {t.errorLogs} ({filteredErrors.length} / {errors.length})
              </h2>
              <p>{isTh ? "ติดตามข้อผิดพลาด ล็อกเส้นทาง และระดับความรุนแรงของระบบ" : "Track system error logs, route exceptions, and severity metrics"}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: 11, padding: "5px 10px", height: "auto" }}
                onClick={exportErrorsCsv}
                disabled={!filteredErrors.length}
              >
                <FileSpreadsheet size={14} />
                Export CSV
              </button>
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: 11, padding: "5px 10px", height: "auto" }}
                onClick={exportErrorsJson}
                disabled={!filteredErrors.length}
              >
                <Download size={14} />
                Export JSON
              </button>
            </div>
          </div>

          {/* Search & Severity Filter Bar */}
          <div className="inline-actions" style={{ marginTop: 12, marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
            <div className="user-search-box" style={{ flex: "1 1 220px", margin: 0 }}>
              <Search size={16} />
              <input
                aria-label={isTh ? "ค้นหา Error (Route, ข้อความ)..." : "Search errors (route, message)..."}
                placeholder={isTh ? "ค้นหา Error (Route, ข้อความ)..." : "Search errors (route, message)..."}
                value={errorSearch}
                onChange={(event) => {
                  setErrorSearch(event.target.value);
                  setErrorPage(1);
                }}
              />
            </div>
            <label className="user-search-box" style={{ flex: "0 1 190px", margin: 0 }}>
              <Filter size={16} />
              <select
                aria-label={isTh ? "กรองระดับความรุนแรง" : "Filter by severity"}
                value={errorSeverity}
                onChange={(event) => {
                  setErrorSeverity(event.target.value);
                  setErrorPage(1);
                }}
                style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit", font: "inherit", cursor: "pointer" }}
              >
                <option value="ALL">{isTh ? "ทุกระดับความรุนแรง" : "All Severities"} ({errorSeverityCounts.all})</option>
                <option value="CRITICAL">CRITICAL ({errorSeverityCounts.critical})</option>
                <option value="HIGH">HIGH ({errorSeverityCounts.high})</option>
                <option value="MEDIUM">MEDIUM ({errorSeverityCounts.medium})</option>
                <option value="LOW">LOW ({errorSeverityCounts.low})</option>
              </select>
            </label>
          </div>

          {filteredErrors.length ? (
            <>
              <div className="review-list">
                {paginatedErrors.map((error) => (
                  <article
                    className="review-item"
                    key={error.id}
                    style={{
                      borderLeft: error.severity.toUpperCase() === "CRITICAL" || error.severity.toUpperCase() === "HIGH"
                        ? "4px solid var(--red)"
                        : "4px solid var(--amber)",
                    }}
                  >
                    <div className="review-item-heading">
                      <div>
                        <strong style={{ fontFamily: "monospace", fontSize: 13 }}>{error.route || "/"}</strong>
                        <small>{formatDate(error.created_at, locale)}</small>
                      </div>
                      <span className={`severity-badge ${error.severity.toLowerCase()}`}>{error.severity}</span>
                    </div>
                    <p style={{ fontFamily: "monospace", fontSize: 11.5, background: "var(--canvas)", padding: "8px 10px", borderRadius: 8, marginTop: 8, wordBreak: "break-all" }}>
                      {error.message}
                    </p>
                  </article>
                ))}
              </div>
              {totalErrorPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
                  <button
                    className="secondary-button small-button"
                    type="button"
                    disabled={errorPage <= 1}
                    onClick={() => setErrorPage((p) => Math.max(1, p - 1))}
                    aria-label={isTh ? "หน้าก่อนหน้า" : "Previous page"}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {isTh ? `หน้า ${errorPage} / ${totalErrorPages}` : `Page ${errorPage} of ${totalErrorPages}`} ({filteredErrors.length} {isTh ? "รายการ" : "items"})
                  </span>
                  <button
                    className="secondary-button small-button"
                    type="button"
                    disabled={errorPage >= totalErrorPages}
                    onClick={() => setErrorPage((p) => Math.min(totalErrorPages, p + 1))}
                    aria-label={isTh ? "หน้าถัดไป" : "Next page"}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="review-empty">
              {errors.length
                ? (isTh ? "ไม่พบ Error ตามเงื่อนไขการค้นหา" : "No errors matching the filter criteria")
                : t.noErrors}
            </p>
          )}
        </section>
      ) : null}

      {/* Analytics & Rating Breakdown Section */}
      <section className="review-panel" aria-labelledby="analytics-heading">
        <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 id="analytics-heading" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart3 size={20} color="#e5ae00" />
              {isTh ? "สถิติผลการประเมินความพึงพอใจ 5 ด้าน" : "Evaluation Analytics (5 Categories)"}
            </h2>
            <p>{isTh ? "วิเคราะห์ผลการใช้งานจริงจากแบบประเมินผู้ใช้" : "Real user satisfaction metrics from submitted evaluations"}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="secondary-button small-button"
              type="button"
              onClick={exportEvaluationsCsv}
              title={isTh ? "ส่งออกข้อมูลแบบประเมินเป็น CSV (รองรับ Excel ภาษาไทย)" : "Export evaluations to CSV with UTF-8 BOM"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <FileSpreadsheet size={14} />
              <span>{isTh ? "ส่งออก CSV" : "Export CSV"}</span>
            </button>
            <button
              className="secondary-button small-button"
              type="button"
              onClick={exportEvaluationsJson}
              title={isTh ? "ส่งออกข้อมูลแบบประเมินเป็น JSON" : "Export evaluations to JSON"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <FileText size={14} />
              <span>{isTh ? "ส่งออก JSON" : "Export JSON"}</span>
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 12 }}>
          {/* Category Averages */}
          <div style={{ background: "#fbfcfc", padding: 16, borderRadius: 14, border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              {isTh ? "คะแนนเฉลี่ยแยกตามระบบ" : "Average Score by Category"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categoryScores.map((cat) => (
                <div key={cat.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, fontSize: 11 }}>
                    <span style={{ fontWeight: 600, color: "var(--ink)" }}>{isTh ? cat.labelTh : cat.labelEn}</span>
                    <span style={{ fontWeight: 700, color: "#957000", fontFamily: "monospace" }}>
                      {cat.average} / 5.0 <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 10 }}>({cat.count})</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#eceff1", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${cat.percentage}%`,
                        background: "linear-gradient(90deg, #f8c928, #e5ae00)",
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Star Distribution Breakdown */}
          <div style={{ background: "#fbfcfc", padding: 16, borderRadius: 14, border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              {isTh ? "การกระจายตัวของดาว (ภาพรวม)" : "Overall Star Distribution"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {starDistribution.map((item) => (
                <div key={item.stars} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                  <span style={{ minWidth: 46, fontWeight: 700, display: "flex", alignItems: "center", gap: 3, color: "#a27e00" }}>
                    {item.stars} <Star size={12} fill="currentColor" />
                  </span>
                  <div style={{ flex: 1, height: 8, background: "#eceff1", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${item.percentage}%`,
                        background: "#f8c928",
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span style={{ minWidth: 60, textAlign: "right", fontFamily: "monospace", color: "var(--muted)", fontSize: 10 }}>
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bug Reports Section */}
      <section className="review-panel">
        <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2>{t.reportBug} ({bugs.length})</h2>
            <p>{t.reviewFeedback} · {t.noPrivateData}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              className="secondary-button small-button"
              type="button"
              onClick={exportBugsCsv}
              title={isTh ? "ส่งออกรายการแจ้งปัญหาเป็น CSV" : "Export bug reports to CSV"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
            <button
              className="secondary-button small-button"
              type="button"
              onClick={exportBugsJson}
              title={isTh ? "ส่งออกรายการแจ้งปัญหาเป็น JSON" : "Export bug reports to JSON"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <FileText size={13} />
              <span>JSON</span>
            </button>
            <span className="data-badge"><Clock3 size={13} />{t.admin}</span>
          </div>
        </div>

        {bugs.length ? (
          <>
            <div className="review-list">
              {paginatedBugs.map((bug) => (
                <article className="review-item" key={bug.id}>
                  <div className="review-item-heading">
                    <div>
                      <strong>{bug.subject}</strong>
                      <small>{bug.route || "—"} · {formatDate(bug.created_at, locale)}</small>
                    </div>
                    <span className={`severity-badge ${bug.severity.toLowerCase()}`}>{bug.severity}</span>
                  </div>
                  <p>{bug.message}</p>
                  <div className="review-item-actions">
                    <label htmlFor={`bug-status-${bug.id}`}>{t.feedbackStatus}</label>
                    <select
                      id={`bug-status-${bug.id}`}
                      className="review-status-select"
                      value={bug.status}
                      disabled={updatingId === bug.id}
                      onChange={(event) => void updateBugStatus(bug.id, event.target.value as FeedbackStatus)}
                    >
                      <option value="NEW">{t.newFeedback}</option>
                      <option value="REVIEWING">{t.reviewing}</option>
                      <option value="IN_PROGRESS">{t.inProgress}</option>
                      <option value="RESOLVED">{t.resolved}</option>
                    </select>
                    <CheckCircle2 size={15} />
                  </div>
                </article>
              ))}
            </div>

            {totalBugPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
                <button
                  className="secondary-button small-button"
                  type="button"
                  disabled={bugPage <= 1}
                  onClick={() => setBugPage((p) => Math.max(1, p - 1))}
                  aria-label={isTh ? "หน้าก่อนหน้า" : "Previous page"}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {isTh ? `หน้า ${bugPage} / ${totalBugPages}` : `Page ${bugPage} of ${totalBugPages}`} ({bugs.length} {isTh ? "รายการ" : "items"})
                </span>
                <button
                  className="secondary-button small-button"
                  type="button"
                  disabled={bugPage >= totalBugPages}
                  onClick={() => setBugPage((p) => Math.min(totalBugPages, p + 1))}
                  aria-label={isTh ? "หน้าถัดไป" : "Next page"}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="review-empty">{t.noFeedback}</p>
        )}
      </section>

      {/* Evaluations & User Reviews Section */}
      <section className="review-panel">
        <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>{t.rateExperience} ({ratings.length})</h2>
            <p>{t.ratingCount} · {t.averageRating}: {overallAverage}</p>
          </div>
          <Star size={20} color="#a27e00" />
        </div>

        {ratings.length ? (
          <>
            <div className="review-list">
              {paginatedRatings.map((rating) => {
                const sys = rating.answers?.systems;
                return (
                  <article className="review-item rating-review-item" key={rating.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div className="rating-stars" aria-label={`${rating.overall_rating ?? 0} / 5`}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star key={value} size={16} fill={value <= (rating.overall_rating ?? 0) ? "currentColor" : "none"} />
                        ))}
                        <span style={{ fontWeight: 700, fontSize: 12, marginLeft: 4, color: "var(--ink)" }}>
                          {rating.overall_rating ? `${rating.overall_rating}.0` : "—"}
                        </span>
                      </div>
                      <small>{formatDate(rating.created_at, locale)}</small>
                    </div>

                    {sys ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0" }}>
                        {sys.login ? (
                          <span style={{ fontSize: 10, padding: "2px 8px", background: "#f0f3f6", borderRadius: 6, color: "#374151" }}>
                            {isTh ? "เข้าสู่ระบบ" : "Login"}: {sys.login}★
                          </span>
                        ) : null}
                        {sys.parking ? (
                          <span style={{ fontSize: 10, padding: "2px 8px", background: "#f0f3f6", borderRadius: 6, color: "#374151" }}>
                            {isTh ? "ข้อมูลที่จอด" : "Parking"}: {sys.parking}★
                          </span>
                        ) : null}
                        {sys.booking ? (
                          <span style={{ fontSize: 10, padding: "2px 8px", background: "#f0f3f6", borderRadius: 6, color: "#374151" }}>
                            {isTh ? "การจอง" : "Booking"}: {sys.booking}★
                          </span>
                        ) : null}
                        {sys.profile ? (
                          <span style={{ fontSize: 10, padding: "2px 8px", background: "#f0f3f6", borderRadius: 6, color: "#374151" }}>
                            {isTh ? "โปรไฟล์" : "Profile"}: {sys.profile}★
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <p style={{ margin: "4px 0 0", color: "#4b5660", fontSize: 12 }}>{rating.comment || t.anonymousFeedback}</p>
                  </article>
                );
              })}
            </div>

            {totalRatingPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
                <button
                  className="secondary-button small-button"
                  type="button"
                  disabled={ratingPage <= 1}
                  onClick={() => setRatingPage((p) => Math.max(1, p - 1))}
                  aria-label={isTh ? "หน้าก่อนหน้า" : "Previous page"}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {isTh ? `หน้า ${ratingPage} / ${totalRatingPages}` : `Page ${ratingPage} of ${totalRatingPages}`} ({ratings.length} {isTh ? "รายการ" : "items"})
                </span>
                <button
                  className="secondary-button small-button"
                  type="button"
                  disabled={ratingPage >= totalRatingPages}
                  onClick={() => setRatingPage((p) => Math.min(totalRatingPages, p + 1))}
                  aria-label={isTh ? "หน้าถัดไป" : "Next page"}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="review-empty">{t.noFeedback}</p>
        )}
      </section>



      {message ? <div className="form-note" role="alert">{message}</div> : null}
    </div>
  );
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}

