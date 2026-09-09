import type { Metadata } from "next";
import { BottomNav } from "@/components/layout/BottomNav";
import { VehicleManager } from "@/components/profile/VehicleManager";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "My vehicles" }; }

export default async function VehiclesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  return <div className="app-frame"><main className="page-wrap mobile-page"><VehicleManager locale={locale} /></main><BottomNav locale={locale} active="profile" /></div>;
}
