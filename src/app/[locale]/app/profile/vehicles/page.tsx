import type { Metadata } from "next";
import { BottomNav } from "@/components/layout/BottomNav";
import { VehicleManager } from "@/components/profile/VehicleManager";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppHeader } from "@/components/layout/AppHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export async function generateMetadata(): Promise<Metadata> { return { title: "My vehicles" }; }

export default async function VehiclesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  return <div className="app-frame"><div className="page-wrap mobile-page"><AppHeader locale={locale} /><main><RequireAuth locale={locale} target={`/${locale}/app/profile/vehicles`}><VehicleManager locale={locale} /></RequireAuth></main><PublicFooter locale={locale} /></div><BottomNav locale={locale} active="profile" /></div>;
}
