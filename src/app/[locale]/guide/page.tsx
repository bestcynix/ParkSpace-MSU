import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { SystemGuidePresentation } from "@/components/presentation/SystemGuidePresentation";
import { isLocale, type Locale, getCopy } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const isTh = locale === "th";

  return {
    title: isTh
      ? "คู่มือการใช้งานระบบ & สไลด์นำเสนอโครงการ | ParkSpace MSU"
      : "System Guide & Project Presentation Slides | ParkSpace MSU",
    description: isTh
      ? "เอกสารคู่มือวิธีใช้งานระบบ ParkSpace MSU สำหรับคนทั่วไป เจ้าหน้าที่ลานจอด และแอดมิน พร้อมผังเว็บไซต์และสไลด์นำเสนอขั้นตอนจริง"
      : "Comprehensive system guide for ParkSpace MSU covering users, staff, and admins with live presentation slides and complete URL sitemap.",
  };
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const isTh = locale === "th";
  const t = getCopy(locale);

  return (
    <div className="app-frame">
      <div className="page-wrap">
        <AppHeader locale={locale} />
        <PageTopbar
          locale={locale}
          title={isTh ? "คู่มือและผังเว็บไซต์นำเสนอโครงการ" : "System Guide & Presentation Architecture"}
          subtitle={isTh ? "ParkSpace MSU · มหาวิทยาลัยมหาสารคาม" : "ParkSpace MSU · Mahasarakham University"}
        />

        <main style={{ marginTop: 16 }}>
          <SystemGuidePresentation locale={locale} />
        </main>

        <PublicFooter locale={locale} />
      </div>
    </div>
  );
}
