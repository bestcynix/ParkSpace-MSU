"use client";

import { Bug, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function BugReportForm({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [route, setRoute] = useState(() => typeof window === "undefined" ? "" : window.location.pathname);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const { notify } = useNotifications();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      const { error } = await supabase.from("feedback").insert({
        user_id: userData.user?.id ?? null,
        category: "BUG",
        subject,
        message,
        severity,
        route: route || null,
        metadata: { locale, source: "bug-report-form" },
      });
      if (error) throw error;
      setStatus("sent");
      setStatusMessage(t.bugSent);
      notify({ title: t.bugSent, kind: "success" });
      setSubject("");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : t.operationalData);
      notify({ title: t.reportBug, message: error instanceof Error ? error.message : t.operationalData, kind: "error" });
    }
  }

  return (
    <form className="form-card support-form" onSubmit={(event) => void submit(event)}>
      <div className="form-section-title"><Bug size={22} /><div><h2>{t.bugReportTitle}</h2><p>{t.bugReportIntro}</p></div></div>
      <div className="form-group"><label htmlFor="bug-subject">{t.bugSubject}</label><input className="form-control" id="bug-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={160} /></div>
      <div className="support-form-grid"><div className="form-group"><label htmlFor="bug-severity">{t.bugSeverity}</label><select className="form-control" id="bug-severity" value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}><option value="LOW">{t.low}</option><option value="MEDIUM">{t.medium}</option><option value="HIGH">{t.high}</option><option value="CRITICAL">{t.critical}</option></select></div><div className="form-group"><label htmlFor="bug-route">{t.route}</label><input className="form-control" id="bug-route" value={route} onChange={(event) => setRoute(event.target.value)} maxLength={240} /></div></div>
      <div className="form-group"><label htmlFor="bug-message">{t.bugDescription}</label><textarea className="form-control" id="bug-message" rows={6} value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={5000} /></div>
      <p className="privacy-inline"><ShieldCheck size={14} />{t.noPrivateData}</p>
      {statusMessage ? <div className="form-note" role={status === "error" ? "alert" : "status"}>{statusMessage}</div> : null}
      <div className="support-form-actions"><button className="primary-button" type="submit" disabled={status === "sending"}>{status === "sending" ? "…" : t.sendBug}</button></div>
    </form>
  );
}
