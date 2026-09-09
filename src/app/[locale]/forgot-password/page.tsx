import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PasswordRecoveryForm } from "@/components/auth/PasswordRecoveryForm";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Reset password" }; }

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PasswordRecoveryForm locale={locale} /><PublicFooter locale={locale} /></div></div>;
}
