"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [updated, setUpdated] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage(t.passwordMin);
      return;
    }
    if (password !== confirmation) {
      setMessage(t.passwordMismatch);
      return;
    }
    if (!isSupabaseConfigured()) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (error) throw error;
      setUpdated(true);
      setMessage(t.passwordUpdated);
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  return <form className="form-card support-form" onSubmit={(event) => void submit(event)}><div className="form-section-title"><LockKeyhole size={22} /><div><h1>{t.resetPasswordTitle}</h1><p>{t.passwordHint}</p></div></div><div className="form-group"><label htmlFor="reset-password">{t.newPassword}</label><input id="reset-password" className="form-control" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div><div className="form-group"><label htmlFor="reset-confirm-password">{t.confirmPassword}</label><input id="reset-confirm-password" className="form-control" type="password" minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></div>{message ? <div className="form-note" role={updated ? "status" : "alert"}>{message}</div> : null}<div className="support-form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "…" : t.save}</button>{updated ? <Link className="secondary-button" href={`/${locale}/login`}>{t.login}</Link> : null}</div></form>;
}
