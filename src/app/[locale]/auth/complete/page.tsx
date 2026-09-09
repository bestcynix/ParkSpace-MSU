import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { GoogleAccountCompleteRoute } from "@/components/auth/GoogleAccountComplete";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Account setup", robots: { index: false, follow: false } }; }

export default async function AccountCompletePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.accountConnected} subtitle="Google" /><Suspense fallback={<div className="empty-card"><div><p>Loading · กำลังตรวจสอบ</p></div></div>}><GoogleAccountCompleteRoute locale={locale} /></Suspense><PublicFooter locale={locale} /></div></div>;
}
