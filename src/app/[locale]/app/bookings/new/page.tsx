import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { BookingRoute } from "@/components/booking/BookingRoute";
import { MockupNotice } from "@/components/parking/MockupNotice";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Booking" }; }

export default async function NewBookingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><main><MockupNotice locale={locale} /><Suspense fallback={<div className="form-card"><p>Loading · กำลังโหลด</p></div>}><BookingRoute locale={locale} /></Suspense></main></div><BottomNav locale={locale} active="bookings" /></div>;
}
