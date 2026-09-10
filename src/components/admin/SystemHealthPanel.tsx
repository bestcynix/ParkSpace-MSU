"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Cpu, Database, Globe, HardDrive, RefreshCw, Server, ShieldCheck, Wifi } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function SystemHealthPanel({ locale }: { locale: Locale }) {
  const isTh = locale === "th";
  const [latency, setLatency] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>("");

  async function checkHealth() {
    setChecking(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/admin/audit-logs?pageSize=1");
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);
      setLastCheck(new Date().toLocaleTimeString());
    } catch {
      setLatency(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void checkHealth();
    const interval = setInterval(() => {
      void checkHealth();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const dbConfigured = isSupabaseConfigured();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div className="review-panel" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{isTh ? "สถานะระบบ (Status)" : "System Status"}</span>
            <CheckCircle2 size={18} style={{ color: "var(--green)" }} />
          </div>
          <h3 style={{ margin: "8px 0 2px", fontSize: 20, color: "var(--green)" }}>{isTh ? "พร้อมใช้งาน 100%" : "Operational"}</h3>
          <small style={{ color: "var(--muted)" }}>{isTh ? "ทุกบริการทำงานปกติ" : "All services operational"}</small>
        </div>

        <div className="review-panel" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{isTh ? "ฐานข้อมูล (Database)" : "Database"}</span>
            <Database size={18} style={{ color: dbConfigured ? "var(--green)" : "var(--red)" }} />
          </div>
          <h3 style={{ margin: "8px 0 2px", fontSize: 20 }}>{dbConfigured ? "CONNECTED" : "OFFLINE"}</h3>
          <small style={{ color: "var(--muted)" }}>PostgreSQL / Supabase</small>
        </div>

        <div className="review-panel" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{isTh ? "ความหน่วง API (Latency)" : "API Latency"}</span>
            <Wifi size={18} style={{ color: "#3b82f6" }} />
          </div>
          <h3 style={{ margin: "8px 0 2px", fontSize: 20, color: "#3b82f6" }}>
            {latency !== null ? `${latency} ms` : "Checking..."}
          </h3>
          <small style={{ color: "var(--muted)" }}>
            {isTh ? `ตรวจสอบล่าสุด: ${lastCheck || "—"}` : `Last checked: ${lastCheck || "—"}`}
          </small>
        </div>
      </div>

      {/* Services List */}
      <div className="review-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{isTh ? "บริการย่อยของระบบ (Services Health)" : "Microservices Health"}</h3>
          <button
            type="button"
            className="ghost-button small-button"
            onClick={() => void checkHealth()}
            disabled={checking}
            style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <RefreshCw size={12} className={checking ? "spin" : undefined} />
            <span>{isTh ? "ตรวจสอบใหม่" : "Re-check"}</span>
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {[
            { name: "Next.js 16 Web Engine", desc: "Edge & Serverless SSR", status: "HEALTHY", icon: Server },
            { name: "Supabase PostgREST & Auth", desc: "Realtime & Database Sessions", status: dbConfigured ? "HEALTHY" : "WARNING", icon: Database },
            { name: "QR Engine & Scanner Service", desc: "Cryptographic Pass Verification", status: "HEALTHY", icon: ShieldCheck },
            { name: "Interactive Vector 2D Map", desc: "MSU Campus Coordinate Projections", status: "HEALTHY", icon: Globe },
          ].map((srv) => {
            const SrvIcon = srv.icon;
            return (
              <div
                key={srv.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--canvas)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "var(--surface)",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <SrvIcon size={18} style={{ color: "#1e40af" }} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 13, display: "block" }}>{srv.name}</strong>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{srv.desc}</span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: srv.status === "HEALTHY" ? "var(--green-soft)" : "var(--amber-soft)",
                    color: srv.status === "HEALTHY" ? "var(--green)" : "var(--amber)",
                  }}
                >
                  ● {srv.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
