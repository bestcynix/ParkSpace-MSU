import type { Metadata } from "next";
import { MapPin, Navigation, SlidersHorizontal } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { ParkingCard } from "@/components/parking/ParkingCard";
import { SearchCombobox } from "@/components/parking/SearchCombobox";
import { HeroActions } from "@/components/home/HeroActions";
import { RoleQuickActions } from "@/components/auth/RoleQuickActions";
import { getCopy, getLocalizedTagline, isLocale, type Locale } from "@/lib/i18n";
import { parkingAreas } from "@/lib/parking/demo-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const th = locale === "th";
  return {
    title: th ? "จองที่จอดรถ มหาวิทยาลัยมหาสารคาม" : "Mahasarakham University Parking Reservation",
    description: th ? "ParkSpace MSU ระบบค้นหาและจองพื้นที่จอดรถ มหาวิทยาลัยมหาสารคาม" : "ParkSpace MSU parking search and reservation for Mahasarakham University.",
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  const tagline = getLocalizedTagline(locale);

  return (
    <div className="app-frame">
      <div className="page-wrap">
        <AppHeader locale={locale} />
        <main>
          <RoleQuickActions locale={locale} />
          <section className="hero">
            <div className="hero-content">
              <p className="eyebrow">Mahasarakham University</p>
              <h1>{tagline.primary}</h1>
              <p>{tagline.secondary} · {t.selectDestination}</p>
              <HeroActions locale={locale} />
            </div>
          </section>

          <section className="relative" aria-label={t.searchPlaceholder}>
            <SearchCombobox locale={locale} />
          </section>

          <div className="location-strip" style={{ marginTop: 16 }}>
            <span className="location-icon"><MapPin size={20} /></span>
            <span className="location-copy"><strong>Mahasarakham University</strong><span>MSU Campus · {locale === "th" ? "เขตพื้นที่ขามเรียง" : "Khamriang Campus"}</span></span>
            <Navigation size={17} color="#89919b" style={{ marginLeft: "auto" }} />
          </div>

          <div className="section-heading">
            <div><h2>{t.nearby}</h2><p>{t.nearbyEn}</p></div>
            <a className="text-link" href={`/${locale}/parking`}>{t.viewAll} <SlidersHorizontal size={12} style={{ verticalAlign: "-2px" }} /></a>
          </div>

          <div className="parking-grid">
            {parkingAreas.slice(0, 3).map((area) => <ParkingCard area={area} locale={locale} key={area.id} />)}
          </div>

          <PublicFooter locale={locale} />
        </main>
      </div>
      <BottomNav locale={locale} active="home" />
    </div>
  );
}
