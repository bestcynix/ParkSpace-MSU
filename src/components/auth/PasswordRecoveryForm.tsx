"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle, Mail } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

export function PasswordRecoveryForm({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { notify } = useNotifications();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      setMessage(t.accountNotConfigured);
      notify({ title: t.accountNotConfigured, message: t.accountNotConfiguredEn, kind: "error", duration: 8000 });
      return;
    }
    const cleanEmail = normalizeLoginIdentifier(email);
    setLoading(true);
    setMessage("");
    try {
      const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/${locale}/reset-password`,
      });
      if (error) {
        setMessage(error.message);
        notify({ title: t.forgotPassword, message: error.message, kind: "error", duration: 8000 });
      } else {
        setMessage(t.verifyEmail);
        notify({ title: t.verifyEmail, kind: "success", duration: 8000 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      setMessage(msg);
      notify({ title: t.forgotPassword, message: msg, kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <h1>{t.forgotPassword}</h1>
      <p>{t.email}</p>
      <div className="form-group">
        <label htmlFor="recovery-email">{t.email}</label>
        <div className="search-box">
          <Mail size={17} color="#89919b" />
          <input
            id="recovery-email"
            type="text"
            className="form-control"
            style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={locale === "th" ? "อีเมลมหาวิทยาลัย หรือ รหัสนิสิต 11 หลัก" : "MSU email or 11-digit Student ID"}
            required
          />
        </div>
      </div>
      {message ? <div className="form-note" role="status">{message}</div> : null}
      <button className="primary-button" type="submit" disabled={loading} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <LoaderCircle size={16} className="spin" /> : null}
        <span>{loading ? "…" : t.confirm}</span>
      </button>
      <Link className="secondary-button" href={`/${locale}/login`}>{t.back}</Link>
    </form>
  );
}

function normalizeLoginIdentifier(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "staff") return "staff@msu.ac.th";
  if (normalized === "admin") return "admin@msu.ac.th";
  if (/^\d{11}$/.test(normalized)) return `${normalized}@msu.ac.th`;
  if (normalized.endsWith("@msu.a.th")) return `${normalized.slice(0, -"@msu.a.th".length)}@msu.ac.th`;
  return normalized;
}

