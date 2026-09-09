"use client";

import { MessageSquare, Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type RatingKey = "overall" | "login" | "parking" | "booking" | "profile";

export function ExperienceRatingForm({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({ overall: 0, login: 0, parking: 0, booking: 0, profile: 0 });
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const { notify } = useNotifications();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Object.values(ratings).some((value) => value === 0)) {
      setStatus("error");
      setStatusMessage(t.ratingRequired);
      notify({ title: t.ratingRequired, kind: "warning" });
      return;
    }
    if (!isSupabaseConfigured()) {
      setStatus("error");
      setStatusMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      notify({ title: t.accountNotConfigured, kind: "error" });
      return;
    }
    setStatus("sending");
    setStatusMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const { error } = await supabase.from("evaluations").insert({
        user_id: sessionData.session?.user.id ?? null,
        overall_rating: ratings.overall,
        comment: comment || null,
        answers: { type: "SYSTEM_EXPERIENCE", locale, systems: ratings },
      });
      if (error) throw error;
      setStatus("sent");
      setStatusMessage(t.feedbackSent);
      setRatings({ overall: 0, login: 0, parking: 0, booking: 0, profile: 0 });
      setComment("");
      notify({ title: t.feedbackSent, kind: "success" });
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : t.operationalData);
      notify({ title: t.feedbackCenter, message: error instanceof Error ? error.message : t.operationalData, kind: "error" });
    }
  }

  return (
    <form className="form-card support-form rating-form" onSubmit={(event) => void submit(event)}>
      <div className="form-section-title"><MessageSquare size={22} /><div><h2>{t.ratingTitle}</h2><p>{t.ratingPrompt}</p></div></div>
      <p className="rating-section-label">{t.systemRatings}</p>
      <div className="system-rating-list">{(["overall", "login", "parking", "booking", "profile"] as const).map((key) => <div className="system-rating-row" key={key}><span>{key === "overall" ? t.ratingPrompt : key === "login" ? t.rateLogin : key === "parking" ? t.rateParking : key === "booking" ? t.rateBooking : t.rateProfile}</span><div className="star-picker" role="radiogroup" aria-label={key === "overall" ? t.ratingPrompt : key}><span className="rating-stars-label">1–5</span>{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={value <= ratings[key] ? "active" : ""} onClick={() => setRatings((current) => ({ ...current, [key]: value }))} role="radio" aria-checked={ratings[key] === value} aria-label={`${value} / 5`}><Star size={21} fill={value <= ratings[key] ? "currentColor" : "none"} /></button>)}</div></div>)}</div>
      <div className="form-group"><label htmlFor="rating-comment">{t.ratingComment}</label><textarea className="form-control" id="rating-comment" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={3000} /></div>
      {statusMessage ? <div className="form-note" role={status === "error" ? "alert" : "status"}>{statusMessage}</div> : null}
      <div className="support-form-actions"><button className="primary-button" type="submit" disabled={status === "sending"}>{status === "sending" ? "…" : t.submitRating}</button></div>
    </form>
  );
}
