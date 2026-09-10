"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, LoaderCircle, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AnalyticsRole = "admin";
type MetricKey = "areas" | "slots" | "bookings" | "sessions" | "incidents" | "bugs" | "ratings";
type Metric = { key: MetricKey; label: string; value: number };

export function AnalyticsPanel({ locale, role }: { locale: Locale; role: AnalyticsRole }) {
  const t = getCopy(locale);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadMetrics = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      async function countRows(table: string) {
        const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
        if (error) throw error;
        return count ?? 0;
      }
      const [areas, slots, bookings, sessions, incidents, bugs, ratings] = await Promise.all([
        countRows("parking_areas"),
        countRows("parking_slots"),
        countRows("bookings"),
        countRows("parking_sessions"),
        countRows("incidents"),
        countRows("feedback"),
        countRows("evaluations"),
      ]);
      setMetrics([
        { key: "areas", label: t.areas, value: areas },
        { key: "slots", label: locale === "th" ? "ช่องจอด" : "Parking slots", value: slots },
        { key: "bookings", label: t.bookings, value: bookings },
        { key: "sessions", label: locale === "th" ? "เซสชันจอดรถ" : "Parking sessions", value: sessions },
        { key: "incidents", label: t.incidents, value: incidents },
        { key: "bugs", label: t.reportBug, value: bugs },
        { key: "ratings", label: t.rateExperience, value: ratings },
      ]);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }, [locale, t.accountNotConfigured, t.accountNotConfiguredEn, t.areas, t.bookings, t.incidents, t.operationalData, t.rateExperience, t.reportBug]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMetrics(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMetrics]);

  function exportCsv() {
    const rows = [["metric", "value"], ...metrics.map((metric) => [metric.label, String(metric.value)])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadFile(`parkspace-msu-analytics-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }

  function exportPng() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 760;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#f7f8f9";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#202a34";
    context.font = "700 32px Arial";
    context.fillText("ParkSpace MSU · Analytics", 52, 68);
    context.font = "16px Arial";
    context.fillStyle = "#71808c";
    context.fillText(`Admin · ${new Date().toLocaleString()}`, 52, 98);
    const maxValue = Math.max(...metrics.map((metric) => metric.value), 1);
    const barWidth = 120;
    const gap = 35;
    const chartTop = 160;
    metrics.forEach((metric, index) => {
      const x = 65 + index * (barWidth + gap);
      const height = Math.max(4, (metric.value / maxValue) * 430);
      const y = chartTop + 430 - height;
      context.fillStyle = "#f8c928";
      context.fillRect(x, y, barWidth, height);
      context.fillStyle = "#202a34";
      context.font = "700 18px Arial";
      context.fillText(String(metric.value), x + 8, y - 10);
      context.save();
      context.translate(x + barWidth / 2, chartTop + 465);
      context.rotate(-Math.PI / 7);
      context.font = "14px Arial";
      context.fillText(metric.label.slice(0, 18), -45, 0);
      context.restore();
    });
    context.fillStyle = "#71808c";
    context.font = "13px Arial";
    context.fillText("Source: ParkSpace MSU live data", 52, 710);
    downloadFile(`parkspace-msu-analytics-${new Date().toISOString().slice(0, 10)}.png`, canvas.toDataURL("image/png"), "image/png");
  }

  if (loading) return <div className="empty-card"><div><div className="empty-icon"><LoaderCircle size={26} className="spin" /></div><h2>Loading · กำลังโหลด</h2><p>{t.realMetrics}</p></div></div>;

  return <div className="analytics-panel"><div className="data-manager-heading"><div><p className="eyebrow">{t.admin}</p><h2>{t.analytics}</h2><p className="page-subtitle">{t.realMetrics} · {t.noPrivateData}</p></div><div className="inline-actions"><button className="secondary-button" type="button" onClick={() => void loadMetrics}><RefreshCw size={15} />{t.refreshAvailability}</button><button className="secondary-button" type="button" onClick={exportCsv}><Download size={15} />{t.exportCsv}</button><button className="secondary-button" type="button" onClick={exportPng}><Download size={15} />{t.exportPng}</button></div></div>{message ? <div className="form-note" role="alert">{message}</div> : null}<div className="analytics-grid">{metrics.map((metric) => <article className="analytics-card" key={metric.key}><div className="analytics-card-icon"><BarChart3 size={18} /></div><span>{metric.label}</span><strong>{metric.value.toLocaleString(locale === "th" ? "th-TH" : "en-US")}</strong><div className="analytics-bar"><i style={{ width: `${Math.min(100, Math.max(5, metrics.length && Math.max(...metrics.map((item) => item.value), 1) ? metric.value / Math.max(...metrics.map((item) => item.value), 1) * 100 : 5))}%` }} /></div></article>)}</div></div>;
}

function downloadFile(name: string, content: string, type: string) {
  const anchor = document.createElement("a");
  anchor.download = name;
  anchor.href = content.startsWith("data:") ? content : URL.createObjectURL(new Blob([content], { type }));
  anchor.click();
  if (!content.startsWith("data:")) window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}
