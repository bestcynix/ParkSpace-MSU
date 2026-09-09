import type { Metadata } from "next";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { MockupNotice } from "@/components/parking/MockupNotice";
import { StatusBadge } from "@/components/parking/StatusBadge";
import { getAreaName, parkingAreas } from "@/lib/parking/demo-data";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Campus parking map" }; }

const officialMapImage = "https://building.msu.ac.th/uploads/news/news_img_20260623_041630_d386e933.png";

export default async function MapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.map} subtitle={t.allAreas} /><MockupNotice locale={locale} /><div className="source-map-card"><div className="source-map-heading"><MapPinned size={18} /><div><strong>{t.realSource}</strong><span>{locale === "th" ? "ประกาศแผนผัง MSU Car Park จากกองอาคารสถานที่" : "MSU Car Park announcement from the Building and Grounds Division"}</span></div></div><img src={officialMapImage} alt={locale === "th" ? "แผนผัง MSU Car Park 28 พื้นที่" : "MSU Car Park map with 28 areas"} loading="lazy" /><a className="text-link" href="https://building.msu.ac.th/news-detail.php?id=23" target="_blank" rel="noreferrer">{t.realSource}</a></div><div className="map-placeholder"><div><MapPinned size={42} /><strong>{t.mapPending}</strong><span>{t.realDataNote}</span><a className="text-link" href="https://building.msu.ac.th/news-detail.php?id=23" target="_blank" rel="noreferrer">{t.realSource}</a></div></div><div className="area-list">{parkingAreas.map((area) => <Link className="area-row" href={`/${locale}/parking/${area.id}`} key={area.id}><span className="area-pin">{area.code}</span><span><strong>{getAreaName(area, locale)}</strong><span>{t.awaitingVerification}</span></span><StatusBadge status={area.status} locale={locale} /></Link>)}</div><PublicFooter locale={locale} /></div><BottomNav locale={locale} active="parking" /></div>;
}
