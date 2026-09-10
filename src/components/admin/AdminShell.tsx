import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, BookOpen, CalendarCheck, Database, FileText, HeartPulse, LayoutDashboard, MapPinned, MessageSquare, QrCode, Settings, ShieldCheck, Users, Wrench } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { AdminDemoBanner } from "@/components/admin/AdminDemoBanner";

export function AdminShell({ locale, role, children }: { locale: Locale; role: "admin" | "staff"; children: React.ReactNode }) {
  const t = getCopy(locale);
  const prefix = `/${locale}/${role}`;
  const isTh = locale === "th";
  const items = role === "admin" ? [
    ["dashboard", t.dashboard, LayoutDashboard, "/dashboard"],
    ["health", isTh ? "สุขภาพระบบ" : "System Health", HeartPulse, "/health"],
    ["operations", isTh ? "ปฏิบัติการเรียลไทม์" : "Live Operations", Activity, "/operations"],
    ["scan", isTh ? "สแกนบัตรผ่าน" : "Scan QR Pass", QrCode, "/scan"],
    ["areas", isTh ? "พื้นที่จอดรถ" : "Parking Areas", MapPinned, "/parking-areas"],
    ["bookings", isTh ? "จัดการการจอง" : "Manage Bookings", CalendarCheck, "/bookings"],
    ["incidents", isTh ? "จัดการเหตุการณ์" : "Incidents", AlertTriangle, "/incidents"],
    ["users", isTh ? "ผู้ใช้งาน" : "Users", Users, "/users"],
    ["database", isTh ? "ฐานข้อมูล" : "Database", Database, "/database"],
    ["traces", isTh ? "ติดตาม Trace & Latency" : "Trace & Latency", Wrench, "/traces"],
    ["analytics", isTh ? "สถิติการใช้งาน" : "Analytics", BarChart3, "/analytics"],
    ["errors", isTh ? "บันทึกข้อผิดพลาด" : "Error Logs", FileText, "/errors"],
    ["feedback", isTh ? "ศูนย์ความคิดเห็น" : "Feedback Center", MessageSquare, "/feedback"],
    ["audit", isTh ? "ประวัติการทำรายการ" : "Audit Logs", ShieldCheck, "/audit-logs"],
    ["flags", isTh ? "ควบคุมฟีเจอร์" : "Feature Flags", Settings, "/feature-flags"],
    ["team", isTh ? "สมาชิกทีม" : "Team Members", Users, "/team"],
    ["settings", isTh ? "ตั้งค่าระบบ" : "Settings", Settings, "/settings"],
  ] : [
    ["dashboard", t.dashboard, LayoutDashboard, "/dashboard"],
    ["scan", isTh ? "สแกน QR Pass" : "Scan QR Pass", QrCode, "/scan"],
    ["operations", isTh ? "ปฏิบัติการเรียลไทม์" : "Live Operations", Activity, "/operations"],
    ["incidents", isTh ? "รายงานเหตุการณ์" : "Incidents", FileText, "/incidents"],
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingRight: 4 }}>
          <Logo locale={locale} dark />
          <ThemeToggle locale={locale} />
        </div>
        <nav className="admin-nav" aria-label={`${role} navigation`}>
          {items.map(([key, label, Icon, path]) => {
            const ItemIcon = Icon as typeof LayoutDashboard;
            return <Link href={`${prefix}${path}`} key={key as string}><ItemIcon size={16} /><span>{label as string}</span></Link>;
          })}
          <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "8px 0" }} />
          <Link href={`/${locale}/guide`} style={{ color: "var(--gold)" }}>
            <BookOpen size={16} />
            <span>{isTh ? "คู่มือ & ผังพรีเซนต์" : "Guide & Sitemap"}</span>
          </Link>
        </nav>
      </aside>
      <main className="admin-main"><AdminDemoBanner locale={locale} />{children}<PublicFooter locale={locale} /></main>
    </div>
  );
}
