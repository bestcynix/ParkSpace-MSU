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
import { ConsoleLiveData, type ConsoleView } from "@/components/admin/ConsoleLiveData";

type Role = "admin" | "staff" | "developer";

export function OperationsPage({ locale, role, section }: { locale: Locale; role: Role; section: string }) {
  const t = getCopy(locale);
  const title = role === "admin" ? t.admin : role === "staff" ? t.staff : t.developer;
  const subtitle = role === "admin" ? t.liveOperations : role === "staff" ? `${t.staff} · ${t.liveOperations}` : t.systemHealth;
  const sectionLabel =
    section === "dashboard" ? t.dashboard
    : section === "operations" ? t.liveOperations
    : section === "parking-areas" ? t.areas
    : section === "users" ? t.users
    : section === "analytics" ? t.analytics
    : section === "scan" ? t.scanQr
    : section === "audit-logs" ? t.audit
    : section === "database" ? t.database
    : section === "traces" ? t.traceExplorer
    : section === "feature-flags" ? t.featureFlags
    : section === "errors" ? t.errors
    : section === "feedback" ? t.feedbackCenter
    : section.replaceAll("-", " ");

  const isFeedbackReview = role === "admin" && section === "feedback";
  const isDeveloperReview = role === "developer" && (section === "feedback" || section === "errors");
  const isAreaManager = (role === "admin" || role === "developer") && section === "parking-areas";
  const isUserManager = (role === "admin" || role === "developer") && section === "users";
  const isAnalytics = (role === "admin" || role === "developer") && section === "analytics";
  const isAudit = (role === "admin" || role === "developer") && section === "audit-logs";
  const isDatabase = (role === "admin" || role === "developer") && section === "database";
  const isTraces = (role === "admin" || role === "developer") && section === "traces";
  const isFeatureFlags = (role === "admin" || role === "developer") && section === "feature-flags";

  const hasDedicatedSection =
    isAreaManager ||
    isUserManager ||
    isAnalytics ||
    isAudit ||
    isDatabase ||
    isTraces ||
    isFeatureFlags ||
    isFeedbackReview ||
    isDeveloperReview ||
    (role === "staff" && (section === "scan" || section === "incidents"));

  const consoleView: ConsoleView = hasDedicatedSection ? "summary" : role === "admin" ? "operations" : role === "staff" ? "staff" : "health";
  const dashboardLink = role === "developer" ? `/${locale}/developer/health` : `/${locale}/${role}/dashboard`;
  const dashboardLabel = role === "developer" ? t.systemHealth : t.dashboard;

  return (
    <AdminShell locale={locale} role={role}>
      <RoleGate locale={locale} role={role}>
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">{title}</p>
            <h1 className="page-title">{sectionLabel}</h1>
            <p className="page-subtitle">{subtitle} · {t.operationalData}</p>
          </div>
          <Link className="primary-button" href={dashboardLink}><Activity size={16} />{dashboardLabel}</Link>
        </div>

        <ConsoleLiveData locale={locale} role={role} view={consoleView} />

        {isAreaManager ? <AreaManager locale={locale} role={role} />
          : isUserManager ? <UserManager locale={locale} role={role} />
          : isAnalytics ? <AnalyticsPanel locale={locale} role={role} />
          : isAudit ? <AuditLogPanel locale={locale} role={role} />
          : isDatabase ? <DatabaseExplorer locale={locale} role={role === "admin" ? "admin" : "developer"} />
          : isTraces ? <TraceExplorer locale={locale} role={role === "admin" ? "admin" : "developer"} />
          : isFeatureFlags ? <FeatureFlagsManager locale={locale} role={role === "admin" ? "admin" : "developer"} />
          : isFeedbackReview || isDeveloperReview ? <FeedbackReview locale={locale} role={role === "admin" ? "admin" : "developer"} includeErrors={role === "developer" && section === "errors"} />
          : role === "staff" && section === "scan" ? <StaffScanner locale={locale} role={role} />
          : role === "staff" && section === "incidents" ? <IncidentForm locale={locale} />
          : null}
      </RoleGate>
    </AdminShell>
  );
}
