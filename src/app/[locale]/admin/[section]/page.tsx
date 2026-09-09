import type { Metadata } from "next";
import { OperationsPage } from "@/components/admin/OperationsPage";
import { isLocale, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return ["dashboard", "operations", "parking-areas", "bookings", "users", "analytics", "feedback", "audit-logs", "settings"].map((section) => ({ section }));
}

export async function generateMetadata(): Promise<Metadata> { return { title: "Admin" , robots: { index: false, follow: false } }; }
export default async function AdminSectionPage({ params }: { params: Promise<{ locale: string; section: string }> }) { const { locale: rawLocale, section } = await params; const locale: Locale = isLocale(rawLocale) ? rawLocale : "th"; return <OperationsPage locale={locale} role="admin" section={section} />; }
