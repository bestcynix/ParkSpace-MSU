"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, Clock3, LoaderCircle, MessageSquare, Star } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ReviewRole = "admin" | "developer";
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

type RatingRow = {
  id: string;
  overall_rating: number | null;
  comment: string | null;
  created_at: string;
};

type ErrorRow = {
  id: string;
  route: string | null;
  severity: string;
  message: string;
  created_at: string;
};

export function FeedbackReview({ locale, role, includeErrors = false }: { locale: Locale; role: ReviewRole; includeErrors?: boolean }) {
  const t = getCopy(locale);
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");

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
        supabase.from("feedback").select("id, subject, message, severity, route, status, created_at").eq("category", "BUG").order("created_at", { ascending: false }).limit(100),
        supabase.from("evaluations").select("id, overall_rating, comment, created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      if (bugResult.error) throw bugResult.error;
      if (ratingResult.error) throw ratingResult.error;
      setBugs((bugResult.data ?? []) as BugRow[]);
      setRatings((ratingResult.data ?? []) as RatingRow[]);
      if (includeErrors) {
        const errorResult = await supabase.from("error_logs").select("id, route, severity, message, created_at").order("created_at", { ascending: false }).limit(100);
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

  if (loading) return <div className="empty-card"><div><div className="empty-icon"><LoaderCircle size={26} /></div><h2>Loading · กำลังโหลด</h2><p>{t.reviewFeedback}</p></div></div>;
  if (message && !bugs.length && !ratings.length && !errors.length) return <div className="empty-card"><div><div className="empty-icon"><AlertTriangle size={26} /></div><h2>{message}</h2><p>{role === "admin" ? t.admin : t.developer}</p></div></div>;

  const rated = ratings.filter((rating) => typeof rating.overall_rating === "number");
  const average = rated.length ? (rated.reduce((sum, rating) => sum + (rating.overall_rating ?? 0), 0) / rated.length).toFixed(1) : "—";

  return (
    <div className="review-center">
      <div className="review-summary-grid">
        <div className="dashboard-card"><Bug size={18} color="#a27e00" /><p>{t.reportBug}</p><strong>{bugs.length}</strong><small>{t.feedbackStatus}</small></div>
        <div className="dashboard-card"><Star size={18} color="#a27e00" /><p>{t.averageRating}</p><strong>{average}</strong><small>{rated.length} {t.ratingCount}</small></div>
        <div className="dashboard-card"><MessageSquare size={18} color="#a27e00" /><p>{t.feedbackCenter}</p><strong>{ratings.length}</strong><small>{t.operationalData}</small></div>
        {includeErrors ? <div className="dashboard-card"><AlertTriangle size={18} color="#a27e00" /><p>{t.errorLogs}</p><strong>{errors.length}</strong><small>{t.developer}</small></div> : null}
      </div>

      <section className="review-panel">
        <div className="section-heading"><div><h2>{t.reportBug}</h2><p>{t.reviewFeedback} · {t.noPrivateData}</p></div><span className="data-badge"><Clock3 size={13} />{role === "admin" ? t.admin : t.developer}</span></div>
        {bugs.length ? <div className="review-list">{bugs.map((bug) => <article className="review-item" key={bug.id}><div className="review-item-heading"><div><strong>{bug.subject}</strong><small>{bug.route || "—"} · {formatDate(bug.created_at, locale)}</small></div><span className={`severity-badge ${bug.severity.toLowerCase()}`}>{bug.severity}</span></div><p>{bug.message}</p><div className="review-item-actions"><label htmlFor={`bug-status-${bug.id}`}>{t.feedbackStatus}</label><select id={`bug-status-${bug.id}`} className="review-status-select" value={bug.status} disabled={updatingId === bug.id} onChange={(event) => void updateBugStatus(bug.id, event.target.value as FeedbackStatus)}><option value="NEW">{t.newFeedback}</option><option value="REVIEWING">{t.reviewing}</option><option value="IN_PROGRESS">{t.inProgress}</option><option value="RESOLVED">{t.resolved}</option></select><CheckCircle2 size={15} /></div></article>)}</div> : <p className="review-empty">{t.noFeedback}</p>}
      </section>

      <section className="review-panel">
        <div className="section-heading"><div><h2>{t.rateExperience}</h2><p>{t.ratingCount} · {t.averageRating}: {average}</p></div><Star size={20} color="#a27e00" /></div>
        {ratings.length ? <div className="review-list">{ratings.map((rating) => <article className="review-item rating-review-item" key={rating.id}><div className="rating-stars" aria-label={`${rating.overall_rating ?? 0} / 5`}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={16} fill={value <= (rating.overall_rating ?? 0) ? "currentColor" : "none"} />)}</div><p>{rating.comment || t.anonymousFeedback}</p><small>{formatDate(rating.created_at, locale)}</small></article>)}</div> : <p className="review-empty">{t.noFeedback}</p>}
      </section>

      {includeErrors ? <section className="review-panel"><div className="section-heading"><div><h2>{t.errorLogs}</h2><p>{t.systemHealth} · {t.developer}</p></div><AlertTriangle size={20} color="#a27e00" /></div>{errors.length ? <div className="review-list">{errors.map((error) => <article className="review-item" key={error.id}><div className="review-item-heading"><div><strong>{error.route || "—"}</strong><small>{formatDate(error.created_at, locale)}</small></div><span className={`severity-badge ${error.severity.toLowerCase()}`}>{error.severity}</span></div><p>{error.message}</p></article>)}</div> : <p className="review-empty">{t.noErrors}</p>}</section> : null}
      {message ? <div className="form-note" role="alert">{message}</div> : null}
    </div>
  );
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}
