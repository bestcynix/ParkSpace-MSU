"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

export function PasswordRecoveryForm({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { notify } = useNotifications();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      setMessage(t.accountNotConfigured);
      notify({ title: t.accountNotConfigured, message: t.accountNotConfiguredEn, kind: "error", duration: 8000 });
      return;
    }
    const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/${locale}/reset-password` });
    setMessage(error ? error.message : t.verifyEmail);
    notify({ title: error ? t.forgotPassword : t.verifyEmail, message: error?.message, kind: error ? "error" : "success", duration: 8000 });
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <h1>{t.forgotPassword}</h1>
      <p>{t.email}</p>
      <div className="form-group"><label htmlFor="recovery-email">{t.email}</label><div className="search-box"><Mail size={17} color="#89919b" /><input id="recovery-email" type="email" className="form-control" style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }} value={email} onChange={(event) => setEmail(event.target.value)} required /></div></div>
      {message ? <div className="form-note" role="status">{message}</div> : null}
      <button className="primary-button" type="submit">{t.confirm}</button>
      <Link className="secondary-button" href={`/${locale}/login`}>{t.back}</Link>
    </form>
  );
}
