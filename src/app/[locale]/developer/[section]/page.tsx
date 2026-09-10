import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return ["health", "dashboard", "operations", "scan", "database", "parking-areas", "bookings", "users", "analytics", "audit-logs", "traces", "errors", "feedback", "feature-flags", "team", "settings", "incidents"].map((section) => ({ section }));
}

export default async function DeveloperSectionPage({ params }: { params: Promise<{ locale: string; section: string }> }) {
  const { locale: rawLocale, section } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  redirect(`/${locale}/admin/${section}`);
}
