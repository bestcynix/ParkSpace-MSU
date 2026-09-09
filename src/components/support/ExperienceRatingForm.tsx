"use client";

import Link from "next/link";
import { MessageSquare, Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function ExperienceRatingForm({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) {
      setStatus("error");
      setStatusMessage(locale === "th" ? "กรุณาเลือกคะแนน 1–5 ดาว" : "Please choose a 1–5 star rating.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setStatus("error");
      setStatusMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setStatus("sending");
    setStatusMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("evaluations").insert({
        user_id: userData.user?.id ?? null,
        overall_rating: rating,
        comment: comment || null,
        answers: { type: "SYSTEM_EXPERIENCE", locale },
      });
      if (error) throw error;
      setStatus("sent");
      setStatusMessage(t.feedbackSent);
      setRating(0);
      setComment("");
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : t.operationalData);
    }
  }

  return (
    <form className="form-card support-form rating-form" onSubmit={(event) => void submit(event)}>
      <div className="form-section-title"><MessageSquare size={22} /><div><h2>{t.ratingTitle}</h2><p>{t.ratingPrompt}</p></div></div>
      <div className="star-picker" role="radiogroup" aria-label={t.ratingPrompt}>
        {[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={value <= rating ? "active" : ""} onClick={() => setRating(value)} role="radio" aria-checked={rating === value} aria-label={`${value} / 5`}><Star size={27} fill={value <= rating ? "currentColor" : "none"} /></button>)}
      </div>
      <div className="rating-scale"><span>1</span><span>{locale === "th" ? "ควรปรับปรุง" : "Needs improvement"}</span><span>{locale === "th" ? "ดีมาก" : "Excellent"}</span><span>5</span></div>
      <div className="form-group"><label htmlFor="rating-comment">{t.ratingComment}</label><textarea className="form-control" id="rating-comment" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={3000} /></div>
      {statusMessage ? <div className="form-note" role={status === "error" ? "alert" : "status"}>{statusMessage}</div> : null}
      <div className="support-form-actions"><button className="primary-button" type="submit" disabled={status === "sending"}>{status === "sending" ? "…" : t.submitRating}</button><Link className="secondary-button" href={`/${locale}/report-bug`}>{t.reportBug}</Link></div>
    </form>
  );
}
