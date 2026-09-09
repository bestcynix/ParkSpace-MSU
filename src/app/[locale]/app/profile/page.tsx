import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ProfileOverview } from "@/components/profile/ProfileOverview";

export async function generateMetadata(): Promise<Metadata> { return { title: "Profile" }; }

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="mobile-page page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.profile} subtitle={t.personalInfo} /><RequireAuth locale={locale} target={`/${locale}/app/profile`}><ProfileOverview locale={locale} /></RequireAuth><PublicFooter locale={locale} /></div><BottomNav locale={locale} active="profile" /></div>;
}
