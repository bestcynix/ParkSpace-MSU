"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

export function GoogleAccountComplete({ locale, next }: { locale: Locale; next: string }) {
  const t = getCopy(locale);
  const router = useRouter();
  const { notify } = useNotifications();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isSupabaseConfigured()) {
        window.location.replace(`/${locale}/login?error=setup`);
        return;
      }
      const { data } = await createSupabaseBrowserClient().auth.getUser();
      if (!data.user) {
        window.location.replace(`/${locale}/login?error=oauth`);
        return;
      }
      if (active) {
        setEmail(data.user.email ?? "");
        setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [locale]);

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
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (error) throw error;
      notify({ title: t.googleAccountReady, message: t.accountConnected, kind: "success" });
      setMessage(t.passwordUpdated);
      window.setTimeout(() => router.push(next), 450);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.oauthFailed;
      setMessage(detail);
      notify({ title: t.oauthFailed, message: detail, kind: "error", duration: 8000 });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-card"><div><p>Loading · กำลังตรวจสอบ</p></div></div>;

  return <form className="form-card support-form" onSubmit={(event) => void submit(event)}><div className="form-section-title"><CheckCircle2 size={22} /><div><h1>{t.googleAccountReady}</h1><p>{email}</p></div></div><div className="mockup-note"><LockKeyhole size={16} /><span>{t.setPasswordAfterGoogle}</span></div><div className="form-group"><label htmlFor="google-new-password">{t.newPassword}</label><input id="google-new-password" className="form-control" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></div><div className="form-group"><label htmlFor="google-confirm-password">{t.confirmPassword}</label><input id="google-confirm-password" className="form-control" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></div>{message ? <div className="form-note" role="status">{message}</div> : null}<button className="primary-button" type="submit" disabled={saving}>{saving ? "…" : t.save}</button><Link className="secondary-button" href={next}>{t.back}</Link></form>;
}

export function GoogleAccountCompleteRoute({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/app`;
  return <GoogleAccountComplete locale={locale} next={safeNext} />;
}
