import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Notifications" }; }

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="mobile-page page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.notifications} subtitle={t.operationalData} /><div className="empty-card"><div><div className="empty-icon"><Bell size={27} /></div><h2>{t.comingSoon}</h2><p>{t.operationalData}</p></div></div></div><BottomNav locale={locale} active="profile" /></div>;
}
