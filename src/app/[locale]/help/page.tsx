import type { Metadata } from "next";
import { PolicyPage } from "@/components/content/PolicyPage";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Help & contact" }; }
export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) { const { locale: rawLocale } = await params; const locale: Locale = isLocale(rawLocale) ? rawLocale : "th"; return <PolicyPage locale={locale} kind="help" />; }
