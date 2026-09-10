import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "th" ? "สมัครสมาชิก" : "Create account" };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  return <div className="app-frame"><div className="mobile-page page-wrap"><AppHeader locale={locale} /><main><AuthForm locale={locale} mode="register" /><PublicFooter locale={locale} /></main></div></div>;
}
