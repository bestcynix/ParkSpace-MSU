import type { Metadata } from "next";
import { ParkingDetailClient } from "@/components/parking/ParkingDetailClient";
import { getParkingArea } from "@/lib/parking/demo-data";
import { isLocale, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return Array.from({ length: 28 }, (_, index) => ({ id: `p${String(index + 1).padStart(2, "0")}` }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const area = getParkingArea(id);
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  return {
    title: locale === "th" ? `${area.code} ${area.th} | ParkSpace MSU` : `${area.code} ${area.en} | ParkSpace MSU`,
    description: locale === "th" ? "พื้นที่จอดรถจากประกาศกองอาคารสถานที่ มหาวิทยาลัยมหาสารคาม พร้อมระบบเลือกช่องและจองผ่าน Supabase" : "Mahasarakham University parking area from the official announcement, with Supabase-backed slot selection and booking.",
  };
}

export default async function ParkingDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  return <ParkingDetailClient locale={locale} area={getParkingArea(id)} />;
}
