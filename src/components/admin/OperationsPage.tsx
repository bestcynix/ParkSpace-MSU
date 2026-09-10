import Link from "next/link";
import { Activity } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { AdminShell } from "@/components/admin/AdminShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { StaffScanner } from "@/components/staff/StaffScanner";
import { IncidentForm } from "@/components/staff/IncidentForm";
import { FeedbackReview } from "@/components/support/FeedbackReview";
import { AreaManager } from "@/components/admin/AreaManager";
import { UserManager } from "@/components/admin/UserManager";
import { AnalyticsPanel } from "@/components/admin/AnalyticsPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { DatabaseExplorer } from "@/components/admin/DatabaseExplorer";
import { TraceExplorer } from "@/components/admin/TraceExplorer";
import { FeatureFlagsManager } from "@/components/admin/FeatureFlagsManager";
import { TeamDirectory } from "@/components/project/TeamDirectory";
import { AdminBookingsManager } from "@/components/admin/AdminBookingsManager";
import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";
import { SystemSettingsPanel } from "@/components/admin/SystemSettingsPanel";
import { ConsoleLiveData, type ConsoleView } from "@/components/admin/ConsoleLiveData";

type Role = "admin" | "staff";

export function OperationsPage({ locale, role, section }: { locale: Locale; role: Role; section: string }) {
  const t = getCopy(locale);
  const title = role === "admin" ? t.admin : t.staff;
  const subtitle = role === "admin" ? t.liveOperations : `${t.staff} · ${t.liveOperations}`;
  const isTh = locale === "th";
  const sectionLabel =
    section === "dashboard" ? t.dashboard
    : section === "operations" ? t.liveOperations
    : section === "parking-areas" ? t.areas
    : section === "bookings" ? (isTh ? "จัดการการจอง" : "Manage Bookings")
    : section === "users" ? t.users
    : section === "analytics" ? t.analytics
    : section === "scan" ? t.scanQr
    : section === "audit-logs" ? t.audit
    : section === "database" ? t.database
    : section === "traces" ? t.traceExplorer
    : section === "feature-flags" ? t.featureFlags
    : section === "errors" ? t.errors
    : section === "feedback" ? t.feedbackCenter
    : section === "team" ? t.teamMembersLabel
    : section === "health" ? (isTh ? "สุขภาพระบบ" : "System Health")
    : section === "settings" ? (isTh ? "ตั้งค่าระบบ" : "System Settings")
    : section.replaceAll("-", " ");

  const isBookings = role === "admin" && section === "bookings";
  const isHealth = role === "admin" && section === "health";
  const isSettings = role === "admin" && section === "settings";
  const isFeedbackReview = role === "admin" && section === "feedback";
  const isErrorReview = role === "admin" && section === "errors";
  const isAreaManager = role === "admin" && section === "parking-areas";
  const isUserManager = role === "admin" && section === "users";
  const isAnalytics = role === "admin" && section === "analytics";
  const isAudit = role === "admin" && section === "audit-logs";
  const isDatabase = role === "admin" && section === "database";
  const isTraces = role === "admin" && section === "traces";
  const isFeatureFlags = role === "admin" && section === "feature-flags";
  const isScan = section === "scan";
  const isTeam = role === "admin" && section === "team";
  const isIncidents = section === "incidents";

  const hasDedicatedSection =
    isBookings ||
    isHealth ||
    isSettings ||
    isAreaManager ||
    isUserManager ||
    isAnalytics ||
    isAudit ||
    isDatabase ||
    isTraces ||
    isFeatureFlags ||
    isFeedbackReview ||
    isErrorReview ||
    isScan ||
    isTeam ||
    isIncidents;

  const consoleView: ConsoleView = hasDedicatedSection ? "summary" : role === "admin" ? "operations" : "staff";
  const dashboardLink = `/${locale}/${role}/dashboard`;
  const dashboardLabel = t.dashboard;

  return (
    <AdminShell locale={locale} role={role}>
      <RoleGate locale={locale} role={role}>
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">{title}</p>
            <h1 className="page-title">{sectionLabel}</h1>
            <p className="page-subtitle">{subtitle}</p>
          </div>
          <Link className="primary-button" href={dashboardLink}><Activity size={16} />{dashboardLabel}</Link>
        </div>

        <ConsoleLiveData locale={locale} role={role} view={consoleView} />

        {isBookings ? <AdminBookingsManager locale={locale} />
          : isHealth ? <SystemHealthPanel locale={locale} />
          : isSettings ? <SystemSettingsPanel locale={locale} />
          : isAreaManager ? <AreaManager locale={locale} role={role} />
          : isUserManager ? <UserManager locale={locale} role={role} />
          : isAnalytics ? <AnalyticsPanel locale={locale} role={role} />
          : isAudit ? <AuditLogPanel locale={locale} role={role} />
          : isDatabase ? <DatabaseExplorer locale={locale} role="admin" />
          : isTraces ? <TraceExplorer locale={locale} role="admin" />
          : isFeatureFlags ? <FeatureFlagsManager locale={locale} role="admin" />
          : isFeedbackReview || isErrorReview ? <FeedbackReview locale={locale} role="admin" includeErrors={section === "errors"} />
          : isScan ? <StaffScanner locale={locale} role={role} />
          : isIncidents ? <IncidentForm locale={locale} role={role} />
          : isTeam ? <TeamDirectory locale={locale} />
          : null}
      </RoleGate>
    </AdminShell>
  );
}
