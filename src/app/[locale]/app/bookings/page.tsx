import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { BookingsList } from "@/components/booking/BookingsList";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "My bookings" }; }

export default async function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="mobile-page page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.bookings} subtitle={t.operationalData} /><BookingsList locale={locale} /></div><BottomNav locale={locale} active="bookings" /></div>;
}
