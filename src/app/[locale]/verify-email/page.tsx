import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Verify email" }; }

export default async function VerifyEmailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.verifyEmail} /><div className="empty-card"><div><div className="empty-icon"><MailCheck size={28} /></div><h2>{t.verifyEmail}</h2><p>{locale === "th" ? "กรุณาตรวจสอบกล่องจดหมายของคุณ และคลิกลิงก์เพื่อยืนยันอีเมล" : "Please check your inbox and click the verification link."}</p></div></div><PublicFooter locale={locale} /></div></div>;
}
