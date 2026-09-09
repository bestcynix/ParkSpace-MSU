import type { Metadata } from "next";
import { PolicyPage } from "@/components/content/PolicyPage";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Privacy Center" }; }
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) { const { locale: rawLocale } = await params; const locale: Locale = isLocale(rawLocale) ? rawLocale : "th"; return <PolicyPage locale={locale} kind="privacy" />; }
