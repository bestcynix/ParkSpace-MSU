import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { BugReportForm } from "@/components/support/BugReportForm";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Report a system bug", robots: { index: false, follow: false } };
}

export default async function ReportBugPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.reportBug} subtitle={t.help} /><main className="support-page"><BugReportForm locale={locale} /></main><PublicFooter locale={locale} /></div><BottomNav locale={locale} active="profile" /></div>;
}
