import type { Metadata } from "next";
import { Map, MapPin } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { MockupNotice } from "@/components/parking/MockupNotice";
import { ParkingBrowser } from "@/components/parking/ParkingBrowser";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "th" ? "พื้นที่จอดรถทั้ง 28 แห่ง" : "All 28 parking areas", description: "ค้นหาพื้นที่จอดรถ ParkSpace MSU" };
}

export default async function ParkingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return (
    <div className="app-frame">
      <div className="page-wrap">
        <AppHeader locale={locale} />
        <PageTopbar locale={locale} title={t.parking} subtitle={t.allAreas} />
        <ParkingBrowser locale={locale} />
        <MockupNotice locale={locale} />
        <div className="location-strip" style={{ marginTop: 18 }}><span className="location-icon"><Map size={19} /></span><span className="location-copy"><strong>{t.realMap}</strong><span>{t.mapPending}</span></span><MapPin size={17} color="#89919b" style={{ marginLeft: "auto" }} /></div>
        <PublicFooter locale={locale} />
      </div>
      <BottomNav locale={locale} active="parking" />
    </div>
  );
}
