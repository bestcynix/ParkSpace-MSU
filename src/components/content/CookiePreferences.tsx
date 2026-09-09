"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Cookie, LoaderCircle } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Preferences = { necessary: boolean; analytics: boolean; preferences: boolean; performance: boolean };
const storageKey = "parkspace-msu-cookie-preferences";
const cookieKey = "parkspace_cookie_preferences";
const defaultPreferences: Preferences = { necessary: true, analytics: false, preferences: false, performance: false };

export function CookiePreferences({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadPreferences = useCallback(async () => {
    let next = defaultPreferences;
    try {
      const stored = window.localStorage.getItem(storageKey);
      const cookie = document.cookie.split("; ").find((item) => item.startsWith(`${cookieKey}=`))?.split("=").slice(1).join("=");
      const storedValue = cookie ? decodeURIComponent(cookie) : stored;
      if (storedValue) next = { ...next, ...(JSON.parse(storedValue) as Partial<Preferences>) };
      if (isSupabaseConfigured()) {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { data } = await supabase.from("cookie_preferences").select("necessary, analytics, preferences, performance").eq("user_id", sessionData.session.user.id).maybeSingle();
          if (data) next = { ...next, ...(data as Partial<Preferences>), necessary: true };
        }
      }
    } catch {
      next = defaultPreferences;
    }
    setPreferences(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadPreferences(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPreferences]);

  function toggle(key: keyof Omit<Preferences, "necessary">) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const next = { ...preferences, necessary: true };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      document.cookie = `${cookieKey}=${encodeURIComponent(JSON.stringify(next))}; Max-Age=31536000; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
      if (isSupabaseConfigured()) {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { error } = await supabase.from("cookie_preferences").upsert({ user_id: sessionData.session.user.id, ...next, updated_at: new Date().toISOString() });
          if (error) throw error;
        }
      }
      setPreferences(next);
      setMessage(t.preferencesSaved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="cookie-preferences"><LoaderCircle size={18} className="spin" />Loading</div>;

  const options: Array<[keyof Preferences, string, string, boolean]> = [["necessary", t.necessary, locale === "th" ? "จำเป็นต่อความปลอดภัยและการทำงานหลัก" : "Required for security and core functions.", true], ["analytics", t.analytics, locale === "th" ? "ช่วยวัดการใช้งานโดยไม่เก็บข้อมูลส่วนตัวเกินจำเป็น" : "Helps measure usage without unnecessary personal data.", false], ["preferences", t.preferences, locale === "th" ? "จดจำภาษาและตัวเลือกของคุณ" : "Remembers language and your choices.", false], ["performance", t.performance, locale === "th" ? "ช่วยปรับปรุงประสิทธิภาพของบริการ" : "Helps improve service performance.", false]];

  return <form className="form-card cookie-preferences" onSubmit={(event) => void save(event)}><div className="form-section-title"><Cookie size={22} /><div><h2>{t.cookieSettings}</h2><p>{t.signInToSync}</p></div></div><div className="cookie-option-list">{options.map(([key, label, description, required]) => <label className="cookie-option" key={key}><span className="cookie-option-copy"><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={preferences[key]} disabled={required} onChange={() => { if (!required) toggle(key as keyof Omit<Preferences, "necessary">); }} /><span className="cookie-toggle" aria-hidden="true"><i /></span></label>)}</div>{message ? <div className="form-note" role="status">{message}</div> : null}<button className="primary-button" type="submit" disabled={saving}>{saving ? "…" : t.savePreferences}</button></form>;
}
