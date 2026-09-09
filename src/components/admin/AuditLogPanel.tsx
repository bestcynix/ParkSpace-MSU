"use client";

import { History, LoaderCircle, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuditRole = "admin" | "developer";
type AuditLog = {
  id: string;
  action: string;
  actor_type: string | null;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  result: string | null;
  created_at: string;
};

export function AuditLogPanel({ locale, role }: { locale: Locale; role: AuditRole }) {
  const t = getCopy(locale);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadLogs = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await createSupabaseBrowserClient()
        .from("audit_logs")
        .select("id, action, actor_type, actor_id, entity_type, entity_id, result, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setLogs((data ?? []) as AuditLog[]);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }, [t.accountNotConfigured, t.accountNotConfiguredEn, t.operationalData]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLogs(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return logs;
    return logs.filter((log) => [log.action, log.actor_type, log.actor_id, log.entity_type, log.entity_id, log.result]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery)));
  }, [logs, query]);

  return <div className="audit-log-panel data-manager">
    <div className="data-manager-heading"><div><p className="eyebrow">{role === "admin" ? t.admin : t.developer}</p><h2>{t.audit}</h2><p className="page-subtitle">{t.auditHistory} · {t.noPrivateData}</p></div><span className="data-badge"><History size={13} />{logs.length}</span></div>
    <div className="user-search-box"><Search size={16} /><input aria-label={locale === "th" ? "ค้นหาประวัติการทำรายการ" : "Search audit history"} placeholder={locale === "th" ? "ค้นหา Action, บัญชี หรือรายการ" : "Search action, account, or entity"} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    {message ? <div className="form-note" role="alert">{message}</div> : null}
    {loading ? <div className="empty-card" role="status"><div><LoaderCircle size={24} className="spin" /><p>Loading</p></div></div> : filteredLogs.length ? <div className="history-list audit-log-list">{filteredLogs.map((log) => <article className="history-item" key={log.id}><strong>{log.action}</strong><span>{log.actor_type || "—"} · {log.entity_type || "—"} · {log.result || "—"}</span><small>{log.entity_id || log.actor_id || "—"} · {formatDate(log.created_at, locale)}</small></article>)}</div> : <div className="empty-card compact-empty"><div><History size={24} /><h2>{query ? t.noResults : t.noHistory}</h2></div></div>}
  </div>;
}

function formatDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}
