"use client";

import Link from "next/link";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [updated, setUpdated] = useState(false);
  const [saving, setSaving] = useState(false);
  const { notify } = useNotifications();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage(t.passwordMin);
      notify({ title: t.passwordMin, kind: "warning" });
      return;
    }
    if (password !== confirmation) {
      setMessage(t.passwordMismatch);
      notify({ title: t.passwordMismatch, kind: "warning" });
      return;
    }
    if (!isSupabaseConfigured()) {
      setMessage(t.accountNotConfigured);
      notify({ title: t.accountNotConfigured, message: t.accountNotConfiguredEn, kind: "error", duration: 8000 });
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
      notify({ title: t.passwordUpdated, kind: "success" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.operationalData;
      setMessage(detail);
      notify({ title: t.resetPasswordTitle, message: detail, kind: "error", duration: 8000 });
    } finally {
      setSaving(false);
    }
  }

  return <form className="form-card support-form" onSubmit={(event) => void submit(event)}><div className="form-section-title"><LockKeyhole size={22} /><div><h1>{t.resetPasswordTitle}</h1><p>{t.passwordHint}</p></div></div><div className="form-group"><label htmlFor="reset-password">{t.newPassword}</label><div className="password-control"><input id="reset-password" className="form-control" type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}><>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</></button></div></div><div className="form-group"><label htmlFor="reset-confirm-password">{t.confirmPassword}</label><div className="password-control"><input id="reset-confirm-password" className="form-control" type={showConfirmation ? "text" : "password"} minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /><button className="password-toggle" type="button" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}><>{showConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}</></button></div></div>{message ? <div className="form-note" role={updated ? "status" : "alert"}>{message}</div> : null}<div className="support-form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "…" : t.save}</button>{updated ? <Link className="secondary-button" href={`/${locale}/login`}>{t.login}</Link> : null}</div></form>;
}
