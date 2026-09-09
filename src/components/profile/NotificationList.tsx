"use client";

import { Bell, Check, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type NotificationRow = { id: string; notification_type: string; title_th: string; title_en: string; body_th: string | null; body_en: string | null; read_at: string | null; created_at: string };

export function NotificationList({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const { notify } = useNotifications();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const { data, error } = await supabase.from("notifications").select("id, notification_type, title_th, title_en, body_th, body_en, read_at, created_at").eq("user_id", sessionData.session.user.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      setItems((data ?? []) as NotificationRow[]);
    } catch (error) {
      notify({ title: t.notifications, message: error instanceof Error ? error.message : t.operationalData, kind: "error" });
    } finally {
      setLoading(false);
    }
  }, [notify, t.notifications, t.operationalData]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function markRead(item: NotificationRow) {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    const { error } = await createSupabaseBrowserClient().from("notifications").update({ read_at: readAt }).eq("id", item.id);
    if (error) {
      notify({ title: t.notifications, message: error.message, kind: "error" });
      return;
    }
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
  }

  if (loading) return <div className="empty-card"><div><LoaderCircle size={26} className="spin" /><p>Loading · กำลังโหลด</p></div></div>;
  if (!items.length) return <div className="empty-card"><div><div className="empty-icon"><Bell size={27} /></div><h2>{t.noNotifications}</h2><p>{t.notificationNote}</p></div></div>;

  return <section className="notification-list">{items.map((item) => <article className={`notification-card ${item.read_at ? "read" : "unread"}`} key={item.id}><div className="notification-card-icon"><Bell size={17} /></div><div className="notification-card-copy"><strong>{locale === "th" ? item.title_th : item.title_en}</strong><p>{locale === "th" ? item.body_th : item.body_en}</p><small>{formatDate(item.created_at, locale)}</small></div>{item.read_at ? <Check size={16} className="notification-read" /> : <button type="button" className="text-link" onClick={() => void markRead(item)}>{t.markRead}</button>}</article>)}</section>;
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}
