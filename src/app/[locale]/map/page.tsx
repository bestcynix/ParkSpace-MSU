import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { InteractiveCampusMap } from "@/components/map/InteractiveCampusMap";
import { parkingAreas } from "@/lib/parking/demo-data";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Campus parking map" }; }

export default async function MapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.map} subtitle={t.allAreas} /><InteractiveCampusMap locale={locale} areas={parkingAreas} /><PublicFooter locale={locale} /></div><BottomNav locale={locale} active="parking" /></div>;
}
