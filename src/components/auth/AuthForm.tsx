"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ProjectCredits } from "@/components/project/ProjectCredits";

export function AuthForm({ locale, mode }: { locale: Locale; mode: "login" | "register" }) {
  const t = getCopy(locale);
  const isLogin = mode === "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
      const result = isLogin
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: name, preferred_locale: locale } } });
      if (result.error) throw result.error;
      setMessage(isLogin ? t.ready : t.verifyEmail);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    if (!isSupabaseConfigured()) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/${locale}/app` } });
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div style={{ display: "grid", justifyItems: "center", marginBottom: 20 }}>
        <Link href={`/${locale}`} aria-label="ParkSpace MSU"><span className="brand-mark"><svg width="34" height="34" viewBox="0 0 64 64" fill="none"><path d="M14 10h21c10 0 17 6 17 15s-7 15-17 15H24v13H14V10Zm10 9v12h10c5 0 8-2 8-6s-3-6-8-6H24Z" fill="white"/><path d="M46 10c6 0 9 4 9 9 0 8-9 17-9 17s-9-9-9-17c0-5 4-9 9-9Z" fill="#F8C928"/><circle cx="46" cy="19" r="3" fill="#222C38"/></svg></span></Link>
        <strong style={{ marginTop: 10, fontSize: 21 }}>ParkSpace <span style={{ color: "#dca900" }}>MSU</span></strong>
        <span className="page-subtitle" style={{ marginTop: 5 }}>{t.tagline} · {t.taglineEn}</span>
      </div>
      <h1>{isLogin ? t.login : t.register}</h1>
      <p>{isLogin ? t.welcomeSub : t.selectDestination}</p>
      {!isLogin ? <div className="form-group"><label htmlFor="name">{t.name}</label><div className="search-box"><UserRound size={17} color="#89919b" /><input id="name" className="form-control" style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }} value={name} onChange={(event) => setName(event.target.value)} required /></div></div> : null}
      <div className="form-group"><label htmlFor="email">{t.email}</label><div className="search-box"><Mail size={17} color="#89919b" /><input id="email" type="email" className="form-control" style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }} value={email} onChange={(event) => setEmail(event.target.value)} required /></div></div>
      <div className="form-group"><label htmlFor="password">{t.password}</label><div className="search-box"><LockKeyhole size={17} color="#89919b" /><input id="password" type={showPassword ? "text" : "password"} className="form-control" style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /><button type="button" className="search-clear" aria-label={showPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></div>
      {!isLogin ? <div className="form-note">{t.passwordHint}</div> : null}
      {message ? <div className="form-note" role="status">{message}</div> : null}
      <button className="primary-button" type="submit" disabled={loading}>{loading ? "…" : isLogin ? t.login : t.createAccount}</button>
      <button className="secondary-button" type="button" onClick={continueWithGoogle}>◉ &nbsp;{t.continueGoogle}</button>
      {isLogin ? <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 12 }}><Link className="text-link" href={`/${locale}/forgot-password`}>{t.forgotPassword}</Link><span>{t.noAccount} <Link className="text-link" href={`/${locale}/register`}>{t.createAccount}</Link></span></div> : <div style={{ marginTop: 16, textAlign: "center", fontSize: 12 }}>{t.login} <Link className="text-link" href={`/${locale}/login`}>{t.login}</Link></div>}
      <ProjectCredits locale={locale} compact />
    </form>
  );
}
