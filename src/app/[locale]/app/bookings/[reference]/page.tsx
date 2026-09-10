import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { BookingDetail } from "@/components/booking/BookingDetail";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PublicFooter } from "@/components/layout/PublicFooter";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; reference: string }> }): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Booking ${reference}` };
}

export default async function BookingDetailPage({ params }: { params: Promise<{ locale: string; reference: string }> }) {
  const { locale: rawLocale, reference } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return (
    <div className="app-frame">
      <div className="mobile-page page-wrap">
        <AppHeader locale={locale} />
        <PageTopbar locale={locale} title={`${t.bookings}: ${reference}`} />
        <RequireAuth locale={locale} target={`/${locale}/app/bookings/${reference}`}>
          <BookingDetail locale={locale} reference={reference} />
        </RequireAuth>
        <PublicFooter locale={locale} />
      </div>
      <BottomNav locale={locale} active="bookings" />
    </div>
  );
}
