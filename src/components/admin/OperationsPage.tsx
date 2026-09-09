import Link from "next/link";
import { Activity, AlertTriangle, Database, FileText, MapPinned, QrCode, ShieldCheck, Users } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { parkingAreas } from "@/lib/parking/demo-data";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusBadge } from "@/components/parking/StatusBadge";
import { RoleGate } from "@/components/auth/RoleGate";
import { StaffScanner } from "@/components/staff/StaffScanner";
import { IncidentForm } from "@/components/staff/IncidentForm";
import { FeedbackReview } from "@/components/support/FeedbackReview";
import { AreaManager } from "@/components/admin/AreaManager";
import { UserManager } from "@/components/admin/UserManager";
import { AnalyticsPanel } from "@/components/admin/AnalyticsPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";

type Role = "admin" | "staff" | "developer";

export function OperationsPage({ locale, role, section }: { locale: Locale; role: Role; section: string }) {
  const t = getCopy(locale);
  const title = role === "admin" ? t.admin : role === "staff" ? t.staff : t.developer;
  const subtitle = role === "admin" ? t.liveOperations : role === "staff" ? `${t.staff} · ${t.liveOperations}` : t.systemHealth;
  const kpis = role === "developer" ? [["Database", "—", Database], ["Auth", "—", ShieldCheck], ["Realtime", "—", Activity], ["Errors", "—", AlertTriangle]] as const : [[t.available, "—", Activity], [t.reserved, "—", QrCode], [t.occupied, "—", MapPinned], [t.incidents, "—", AlertTriangle]] as const;
  const sectionLabel = section === "dashboard" ? t.dashboard : section === "operations" ? t.liveOperations : section === "parking-areas" ? t.areas : section === "users" ? t.users : section === "analytics" ? t.analytics : section === "scan" ? t.scanQr : section === "audit-logs" ? t.audit : section.replaceAll("-", " ");

  const isFeedbackReview = role === "admin" && section === "feedback";
  const isDeveloperReview = role === "developer" && (section === "feedback" || section === "errors");
  const isAreaManager = (role === "admin" || role === "developer") && section === "parking-areas";
  const isUserManager = (role === "admin" || role === "developer") && section === "users";
  const isAnalytics = (role === "admin" || role === "developer") && section === "analytics";
  const isAudit = (role === "admin" || role === "developer") && section === "audit-logs";

  return <AdminShell locale={locale} role={role}><RoleGate locale={locale} role={role}><div className="dashboard-header"><div><p className="eyebrow">{title}</p><h1 className="page-title">{sectionLabel}</h1><p className="page-subtitle">{subtitle} · {t.operationalData}</p></div><Link className="primary-button" href={`/${locale}/${role === "admin" ? "admin" : role === "staff" ? "staff" : "developer"}/dashboard`}><Activity size={16} />{t.dashboard}</Link></div><div className="dashboard-grid">{kpis.map(([label, value, Icon]) => <div className="dashboard-card" key={label}><Icon size={18} color="#a27e00" /><p>{label}</p><strong>{value}</strong><small>{t.awaitingVerification}</small></div>)}</div>{isAreaManager ? <AreaManager locale={locale} role={role} /> : isUserManager ? <UserManager locale={locale} role={role} /> : isAnalytics ? <AnalyticsPanel locale={locale} role={role} /> : isAudit ? <AuditLogPanel locale={locale} role={role} /> : isFeedbackReview || isDeveloperReview ? <FeedbackReview locale={locale} role={role === "admin" ? "admin" : "developer"} includeErrors={role === "developer" && section === "errors"} /> : role === "admin" ? <><div className="section-heading"><div><h2>{t.liveOperations}</h2><p>{t.allAreas} · Supabase Realtime</p></div><Link className="text-link" href={`/${locale}/admin/parking-areas`}>{t.areas}</Link></div><div className="ops-grid">{parkingAreas.map((area) => <Link className="ops-card" href={`/${locale}/parking/${area.id}`} key={area.id}><header><strong>{area.code}</strong><StatusBadge status={area.status} locale={locale} /></header><p>{t.awaitingVerification}<br />{t.operationalData}</p></Link>)}</div></> : role === "staff" && section === "scan" ? <StaffScanner locale={locale} /> : role === "staff" && section === "incidents" ? <IncidentForm locale={locale} /> : role === "staff" ? <><div className="info-card" style={{ padding: 20, marginTop: 24 }}><h2 style={{ margin: 0, fontSize: 19 }}>{t.scanQr}</h2><p className="page-subtitle">{locale === "th" ? "สแกน QR แล้วตรวจสอบรถก่อนยืนยัน Check-in" : "Scan a QR, verify the vehicle, then confirm Check-in."}</p><Link className="primary-button" style={{ marginTop: 16 }} href={`/${locale}/staff/scan`}><QrCode size={16} />{t.scanQr}</Link></div><div className="status-list"><div className="status-list-row"><span>{t.reserved}</span><strong>—</strong></div><div className="status-list-row"><span>{t.occupied}</span><strong>—</strong></div><div className="status-list-row"><span>{t.incidents}</span><strong>—</strong></div></div></> : <><div className="info-card" style={{ padding: 20, marginTop: 24 }}><h2 style={{ margin: 0, fontSize: 19 }}>{t.systemHealth}</h2><p className="page-subtitle">{locale === "th" ? "ข้อมูลเชิงเทคนิคสำหรับผู้มีสิทธิ์เท่านั้น" : "Technical information for explicitly authorized users only."}</p><div className="status-list"><div className="status-list-row"><span>Database</span><strong>—</strong></div><div className="status-list-row"><span>Auth / RLS</span><strong>—</strong></div><div className="status-list-row"><span>API / Realtime</span><strong>—</strong></div></div></div><p className="footer-note"><FileText size={12} style={{ verticalAlign: "-2px" }} /> {t.noPrivateData}</p></>}</RoleGate></AdminShell>;
}
