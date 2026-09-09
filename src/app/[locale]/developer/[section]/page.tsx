import type { Metadata } from "next";
import { OperationsPage } from "@/components/admin/OperationsPage";
import { isLocale, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return ["health", "database", "traces", "errors", "feature-flags"].map((section) => ({ section }));
}

export async function generateMetadata(): Promise<Metadata> { return { title: "Developer Console", robots: { index: false, follow: false } }; }
export default async function DeveloperSectionPage({ params }: { params: Promise<{ locale: string; section: string }> }) { const { locale: rawLocale, section } = await params; const locale: Locale = isLocale(rawLocale) ? rawLocale : "th"; return <OperationsPage locale={locale} role="developer" section={section} />; }
