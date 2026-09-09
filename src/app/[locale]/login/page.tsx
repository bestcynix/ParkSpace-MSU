import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "th" ? "เข้าสู่ระบบ" : "Log in" };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><main><AuthForm locale={locale} mode="login" /><PublicFooter locale={locale} /></main><p className="footer-note">{t.loginHint}</p></div></div>;
}
