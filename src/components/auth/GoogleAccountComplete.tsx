"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isSupabaseConfigured()) {
        window.location.replace(`/${locale}/login?error=setup`);
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.replace(`/${locale}/login?error=oauth`);
        return;
      }
      if (active) {
        setEmail(data.session.user.email ?? "");
        const completed = Boolean(data.session.user.user_metadata?.parkspace_google_password_setup_completed_at);
        if (completed) {
          router.replace(next);
          return;
        }
        setNeedsPasswordSetup(true);
        setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [locale, next, router]);

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
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const metadata = sessionData.session?.user.user_metadata ?? {};
      const { error } = await supabase.auth.updateUser({ password, data: { ...metadata, parkspace_google_password_setup_completed_at: new Date().toISOString() } });
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

  if (loading || !needsPasswordSetup) return <div className="empty-card"><div><p>Loading · กำลังตรวจสอบ</p></div></div>;

  return <form className="form-card support-form google-account-complete-card" onSubmit={(event) => void submit(event)}><div className="form-section-title"><CheckCircle2 size={22} /><div><h1>{t.googleAccountReady}</h1><p>{email}</p></div></div><div className="mockup-note"><LockKeyhole size={16} /><span>{t.setPasswordAfterGoogle}</span></div><div className="form-group"><label htmlFor="google-new-password">{t.newPassword}</label><div className="password-control"><LockKeyhole size={16} aria-hidden="true" /><input id="google-new-password" className="form-control" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" className="password-toggle" aria-label={showPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div><div className="form-group"><label htmlFor="google-confirm-password">{t.confirmPassword}</label><div className="password-control"><LockKeyhole size={16} aria-hidden="true" /><input id="google-confirm-password" className="form-control" type={showConfirmation ? "text" : "password"} autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /><button type="button" className="password-toggle" aria-label={showConfirmation ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")} onClick={() => setShowConfirmation((value) => !value)}>{showConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>{message ? <div className="form-note" role="status">{message}</div> : null}<button className="primary-button" type="submit" disabled={saving}>{saving ? "…" : t.save}</button><Link className="secondary-button" href={next}>{t.back}</Link></form>;
}

export function GoogleAccountCompleteRoute({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/app`;
  return <GoogleAccountComplete locale={locale} next={safeNext} />;
}
