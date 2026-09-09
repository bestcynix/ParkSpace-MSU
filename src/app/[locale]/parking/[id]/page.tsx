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
    title: locale === "th" ? `${area.code} ${area.th} | ข้อมูลรอตรวจสอบ` : `${area.code} ${area.en} | Awaiting verification`,
    description: locale === "th" ? "รายละเอียดพื้นที่จอดรถ ParkSpace MSU โดยข้อมูลสถานที่จริงจะแสดงหลังการตรวจสอบ" : "ParkSpace MSU parking area details; verified location data will be published after review.",
  };
}

export default async function ParkingDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  return <ParkingDetailClient locale={locale} area={getParkingArea(id)} />;
}
