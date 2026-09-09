import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Reset password" }; }
export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) { const { locale: rawLocale } = await params; const locale: Locale = isLocale(rawLocale) ? rawLocale : "th"; const t = getCopy(locale); return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={locale === "th" ? "ตั้งรหัสผ่านใหม่" : "Reset password"} /><div className="form-card"><p>{t.operationalData}</p><div className="form-note">{t.accountNotConfigured} / {t.accountNotConfiguredEn}</div></div><PublicFooter locale={locale} /></div></div>; }
