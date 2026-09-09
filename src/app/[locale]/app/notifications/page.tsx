import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { NotificationList } from "@/components/profile/NotificationList";

export async function generateMetadata(): Promise<Metadata> { return { title: "Notifications" }; }

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="mobile-page page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.notifications} subtitle={t.operationalData} /><RequireAuth locale={locale} target={`/${locale}/app/notifications`}><NotificationList locale={locale} /></RequireAuth><PublicFooter locale={locale} /></div><BottomNav locale={locale} active="profile" /></div>;
}
