import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { ExperienceRatingForm } from "@/components/support/ExperienceRatingForm";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "th" ? "ศูนย์ความคิดเห็น" : "Feedback center", robots: { index: false, follow: false } };
}

export default async function FeedbackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.feedbackCenter} subtitle={t.rateExperience} /><main className="support-page"><ExperienceRatingForm locale={locale} /></main><PublicFooter locale={locale} /></div><BottomNav locale={locale} active="profile" /></div>;
}
