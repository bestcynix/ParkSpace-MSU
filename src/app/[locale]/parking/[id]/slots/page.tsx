import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { SlotSelector } from "@/components/parking/SlotSelector";
import { getAreaName, getParkingArea } from "@/lib/parking/demo-data";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return Array.from({ length: 28 }, (_, index) => ({ id: `p${String(index + 1).padStart(2, "0")}` }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const area = getParkingArea(id);
  return { title: `${area.code} ${getAreaName(area, locale)} · ${getCopy(locale).selectSlot}` };
}

export default async function SlotSelectionPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const area = getParkingArea(id);
  const t = getCopy(locale);
  return <div className="app-frame"><div className="mobile-page page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.selectSlot} subtitle={`${area.code} · ${getAreaName(area, locale)}`} /><SlotSelector locale={locale} area={area} /></div><BottomNav locale={locale} active="parking" /></div>;
}
