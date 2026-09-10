"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

function isIdenticalPasswordError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : "";
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status: unknown }).status
      : undefined;

  if (status === 422 && (msg.includes("different") || msg.includes("password") || msg.includes("old"))) {
    return true;
  }
  return (
    msg.includes("different from the old password") ||
    msg.includes("different from old password") ||
    msg.includes("same as the old password") ||
    msg.includes("same as old password") ||
    msg.includes("new password should be different") ||
    (status === 422 && msg.includes("password"))
  );
}

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

  async function markCompletedAndProceed() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const metadata = sessionData.session?.user.user_metadata ?? {};
      await supabase.auth.updateUser({
        data: {
          ...metadata,
          parkspace_google_password_setup_completed_at: new Date().toISOString(),
        },
      });
    } catch {
      // Proceed even if metadata update fails
    }
    notify({ title: t.googleAccountReady, message: t.accountConnected, kind: "success" });
    setMessage(t.passwordUpdated);
    window.setTimeout(() => router.push(next), 350);
  }

  async function handleSkip() {
    setSaving(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const metadata = sessionData.session?.user.user_metadata ?? {};
      await supabase.auth.updateUser({
        data: {
          ...metadata,
          parkspace_google_password_setup_completed_at: new Date().toISOString(),
        },
      });
    } catch {
      // Proceed even if metadata update fails
    }
    notify({
      title: locale === "th" ? "เข้าสู่ระบบสำเร็จ" : "Signed in",
      message: locale === "th" ? "ดำเนินการต่อด้วยบัญชี Google ทันที" : "Continuing with Google account directly",
      kind: "success",
    });
    router.push(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || password.length < 8) {
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
      const { error } = await supabase.auth.updateUser({
        password,
        data: {
          ...metadata,
          parkspace_google_password_setup_completed_at: new Date().toISOString(),
        },
      });
      if (error) {
        if (isIdenticalPasswordError(error)) {
          await markCompletedAndProceed();
          return;
        }
        throw error;
      }
      notify({ title: t.googleAccountReady, message: t.accountConnected, kind: "success" });
      setMessage(t.passwordUpdated);
      window.setTimeout(() => router.push(next), 450);
    } catch (error) {
      if (isIdenticalPasswordError(error)) {
        await markCompletedAndProceed();
        return;
      }
      const detail = error instanceof Error ? error.message : t.oauthFailed;
      setMessage(detail);
      notify({ title: t.oauthFailed, message: detail, kind: "error", duration: 8000 });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !needsPasswordSetup) return <div className="empty-card"><div><p>Loading · กำลังตรวจสอบ</p></div></div>;

  return (
    <form className="form-card support-form google-account-complete-card" onSubmit={(event) => void submit(event)}>
      <div className="form-section-title">
        <CheckCircle2 size={22} />
        <div>
          <h1>{t.googleAccountReady}</h1>
          <p>{email}</p>
        </div>
      </div>

      <div className="mockup-note">
        <LockKeyhole size={16} />
        <span>{t.setPasswordAfterGoogle}</span>
      </div>

      <div className="form-group">
        <label htmlFor="google-new-password">{t.newPassword}</label>
        <div className="password-control">
          <LockKeyhole size={16} aria-hidden="true" />
          <input
            id="google-new-password"
            className="form-control"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="google-confirm-password">{t.confirmPassword}</label>
        <div className="password-control">
          <LockKeyhole size={16} aria-hidden="true" />
          <input
            id="google-confirm-password"
            className="form-control"
            type={showConfirmation ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showConfirmation ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}
            onClick={() => setShowConfirmation((value) => !value)}
          >
            {showConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {message ? <div className="form-note" role="status">{message}</div> : null}

      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? "…" : t.save}
      </button>

      <button
        type="button"
        className="secondary-button google-skip-button"
        onClick={() => void handleSkip()}
        disabled={saving}
        style={{
          marginTop: 12,
          padding: "13px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontWeight: 700,
          fontSize: "13px",
          border: "2px solid #e3b341",
          background: "#fffbf0",
          color: "#7d5e00",
          borderRadius: 14,
          cursor: "pointer",
          width: "100%",
          boxShadow: "0 2px 8px rgba(227, 179, 65, 0.15)",
        }}
      >
        <span>{locale === "th" ? "ข้ามขั้นตอนนี้ / ดำเนินการต่อด้วยบัญชี Google ทันที" : "Skip this step / Continue directly to app"}</span>
        <ArrowRight size={17} />
      </button>

      <Link className="secondary-button" href={next} style={{ marginTop: 8 }}>
        {t.back}
      </Link>
    </form>
  );
}

export function GoogleAccountCompleteRoute({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/app`;
  return <GoogleAccountComplete locale={locale} next={safeNext} />;
}
