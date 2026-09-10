"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy, getLocalizedTagline } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

export function AuthForm({ locale, mode }: { locale: Locale; mode: "login" | "register" }) {
  const t = getCopy(locale);
  const tagline = getLocalizedTagline(locale);
  const isLogin = mode === "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { notify } = useNotifications();
  const notifiedError = useRef<string | null>(null);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (!error || notifiedError.current === error) return;
    notifiedError.current = error;
    const title = error === "oauth" ? t.oauthFailed : `${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`;
    notify({ title, kind: "error", duration: 8000 });
  }, [notify, t.accountNotConfigured, t.accountNotConfiguredEn, t.oauthFailed]);

  function getNextPath() {
    if (typeof window === "undefined") return `/${locale}/app`;
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/app`;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!isSupabaseConfigured()) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const authEmail = normalizeLoginIdentifier(email);

      // Automatically initialize central staff account if staff/staff123 is used
      if (isLogin && authEmail === "staff@msu.ac.th" && password === "staff123") {
        try {
          await fetch("/api/auth/staff-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "staff", password: "staff123" }),
          });
        } catch {
          // continue to sign in
        }
      }

      const result = isLogin
        ? await supabase.auth.signInWithPassword({ email: authEmail, password })
        : await supabase.auth.signUp({ email: authEmail, password, options: { data: { full_name: name, preferred_locale: locale }, emailRedirectTo: `${window.location.origin}/${locale}/verify-email` } });
      if (result.error) throw result.error;
      if (isLogin && result.data.user && !result.data.user.user_metadata?.parkspace_google_password_setup_completed_at) {
        await supabase.auth.updateUser({ data: { ...result.data.user.user_metadata, parkspace_google_password_setup_completed_at: new Date().toISOString() } });
      }
      setMessage(isLogin ? t.ready : t.verifyEmail);
      notify({ title: isLogin ? t.accountConnected : t.verifyEmail, kind: "success" });
      if (isLogin) {
        const destination = authEmail === "staff@msu.ac.th" && getNextPath() === `/${locale}/app`
          ? `/${locale}/staff/dashboard`
          : getNextPath();
        window.location.assign(destination);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Authentication failed";
      setMessage(detail);
      notify({ title: isLogin ? t.oauthFailed : t.register, message: detail, kind: "error", duration: 8000 });
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    if (!isSupabaseConfigured()) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNextPath())}` } });
      if (error) throw error;
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.oauthFailed;
      setMessage(detail);
      notify({ title: t.oauthFailed, message: detail, kind: "error", duration: 8000 });
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div style={{ display: "grid", justifyItems: "center", marginBottom: 20 }}>
        <Link href={`/${locale}`} aria-label="ParkSpace MSU"><span className="brand-mark"><svg width="34" height="34" viewBox="0 0 64 64" fill="none"><path d="M14 10h21c10 0 17 6 17 15s-7 15-17 15H24v13H14V10Zm10 9v12h10c5 0 8-2 8-6s-3-6-8-6H24Z" fill="white"/><path d="M46 10c6 0 9 4 9 9 0 8-9 17-9 17s-9-9-9-17c0-5 4-9 9-9Z" fill="#F8C928"/><circle cx="46" cy="19" r="3" fill="#222C38"/></svg></span></Link>
        <strong style={{ marginTop: 10, fontSize: 21 }}>ParkSpace <span style={{ color: "#dca900" }}>MSU</span></strong>
        <span className="page-subtitle" style={{ marginTop: 5 }}>{tagline.primary} · {tagline.secondary}</span>
      </div>
      <h1>{isLogin ? t.login : t.register}</h1>
      <p>{isLogin ? t.welcomeSub : t.selectDestination}</p>
      {!isLogin ? <div className="form-group"><label htmlFor="name">{t.name}</label><div className="search-box"><UserRound size={17} color="#89919b" /><input id="name" className="form-control" style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }} value={name} onChange={(event) => setName(event.target.value)} required /></div></div> : null}
      <div className="form-group"><label htmlFor="email">{t.email}</label><div className="search-box"><Mail size={17} color="#89919b" /><input id="email" type="email" className="form-control" style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }} value={email} onChange={(event) => setEmail(event.target.value)} required /></div></div>
      <div className="form-group">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label htmlFor="password">{t.password}</label>
          {isLogin ? (
            <Link className="text-link" href={`/${locale}/forgot-password`} style={{ fontSize: 12 }}>
              {t.forgotPassword}?
            </Link>
          ) : null}
        </div>
        <div className="search-box">
          <LockKeyhole size={17} color="#89919b" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className="form-control"
            style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <button
            type="button"
            className="search-clear"
            aria-label={showPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      {!isLogin ? <div className="form-note">{t.passwordHint}</div> : null}
      {message ? <div className="form-note" role="status">{message}</div> : null}
      <button className="primary-button" type="submit" disabled={loading}>{loading ? "…" : isLogin ? t.login : t.createAccount}</button>
      <button className="secondary-button" type="button" onClick={continueWithGoogle}>◉ &nbsp;{t.continueGoogle}</button>
      {isLogin ? <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 12 }}><Link className="text-link" href={`/${locale}/forgot-password`}>{t.forgotPassword}</Link><span>{t.noAccount} <Link className="text-link" href={`/${locale}/register`}>{t.createAccount}</Link></span></div> : <div style={{ marginTop: 16, textAlign: "center", fontSize: 12 }}>{t.login} <Link className="text-link" href={`/${locale}/login`}>{t.login}</Link></div>}
    </form>
  );
}

function normalizeLoginIdentifier(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "staff") return "staff@msu.ac.th";
  if (/^\d{11}$/.test(normalized)) return `${normalized}@msu.ac.th`;
  if (normalized.endsWith("@msu.a.th")) return `${normalized.slice(0, -"@msu.a.th".length)}@msu.ac.th`;
  return normalized;
}
