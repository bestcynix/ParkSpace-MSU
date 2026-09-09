import Link from "next/link";
import { Activity, BarChart3, ClipboardList, Database, FileText, LayoutDashboard, MapPinned, MessageSquare, QrCode, Settings, ShieldCheck, Users, Wrench } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { Logo } from "@/components/brand/Logo";
import { PublicFooter } from "@/components/layout/PublicFooter";

export function AdminShell({ locale, role, children }: { locale: Locale; role: "admin" | "staff" | "developer"; children: React.ReactNode }) {
  const t = getCopy(locale);
  const prefix = `/${locale}/${role === "admin" ? "admin" : role === "staff" ? "staff" : "developer"}`;
  const items = role === "admin" ? [
    ["dashboard", t.dashboard, LayoutDashboard, "/dashboard"],
    ["operations", t.liveOperations, Activity, "/operations"],
    ["areas", t.areas, MapPinned, "/parking-areas"],
    ["bookings", t.bookings, ClipboardList, "/bookings"],
    ["users", t.users, Users, "/users"],
    ["analytics", t.analytics, BarChart3, "/analytics"],
    ["feedback", t.feedbackCenter, MessageSquare, "/feedback"],
    ["audit", t.audit, ShieldCheck, "/audit-logs"],
    ["settings", t.settings, Settings, "/settings"],
  ] : role === "staff" ? [
    ["dashboard", t.dashboard, LayoutDashboard, "/dashboard"],
    ["scan", "Scan QR", QrCode, "/scan"],
    ["operations", t.liveOperations, Activity, "/operations"],
    ["incidents", "Incidents", FileText, "/incidents"],
  ] : [
    ["health", t.systemHealth, Activity, "/health"],
    ["database", t.database, Database, "/database"],
    ["areas", t.areas, MapPinned, "/parking-areas"],
    ["users", t.users, Users, "/users"],
    ["analytics", t.analytics, BarChart3, "/analytics"],
    ["traces", t.traceExplorer, Wrench, "/traces"],
    ["errors", t.errors, FileText, "/errors"],
    ["feedback", t.feedbackCenter, MessageSquare, "/feedback"],
    ["settings", t.featureFlags, Settings, "/feature-flags"],
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Logo locale={locale} dark />
        <nav className="admin-nav" aria-label={`${role} navigation`}>
          {items.map(([key, label, Icon, path]) => {
            const ItemIcon = Icon as typeof LayoutDashboard;
            return <Link href={`${prefix}${path}`} key={key as string}><ItemIcon size={16} /><span>{label as string}</span></Link>;
          })}
        </nav>
      </aside>
      <main className="admin-main">{children}<PublicFooter locale={locale} /></main>
    </div>
  );
}
