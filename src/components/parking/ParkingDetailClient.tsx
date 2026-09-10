"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Clock3, ExternalLink, Navigation, ParkingSquare, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { getGoogleMapsNavigationUrl, officialSource, parkingAreas, type ParkingArea } from "@/lib/parking/demo-data";
import { InteractiveCampusMap } from "@/components/map/InteractiveCampusMap";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { LiveAreaStatus } from "@/components/parking/LiveAreaStatus";
import { AreaImage } from "@/components/parking/AreaImage";
import { CapacitySummary } from "@/components/parking/CapacitySummary";
import { PublicFooter } from "@/components/layout/PublicFooter";

export function ParkingDetailClient({ locale, area }: { locale: Locale; area: ParkingArea }) {
  const t = getCopy(locale);
  const [tab, setTab] = useState<"overview" | "map" | "photos" | "details">("overview");
  const [slotMode, setSlotMode] = useState(area.slotMode);
  const [verifiedPoint, setVerifiedPoint] = useState<{ latitude: number; longitude: number }>({
    latitude: area.latitude,
    longitude: area.longitude,
  });
  const [stats, setStats] = useState({
    capacity: area.estimatedCapacity ?? 100,
    reserved: 0,
    occupied: 0,
  });

  const title = locale === "th" ? area.th : area.en;
  const detail = locale === "th" ? area.detailTh : area.detailEn;

  useEffect(() => {
    let active = true;
    async function loadLiveArea() {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.from("parking_areas").select("id, slot_mode, latitude, longitude, capacity").eq("code", area.code).maybeSingle();
        if (active && (data?.slot_mode === "AREA_ONLY" || data?.slot_mode === "INDIVIDUAL_SLOT")) {
          setSlotMode(data.slot_mode);
        }
        const latitude = Number(data?.latitude);
        const longitude = Number(data?.longitude);
        if (active && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude > 0) {
          setVerifiedPoint({ latitude, longitude });
        }

        const areaDbId = data?.id;
        const totalCapacity = typeof data?.capacity === "number" && data.capacity > 0 ? data.capacity : (area.estimatedCapacity ?? 100);

        if (areaDbId) {
          const { count: reservedCount } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("parking_area_id", areaDbId)
            .in("status", ["CONFIRMED", "RESERVED", "CHECKED_IN"]);

          const { count: occupiedCount } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("parking_area_id", areaDbId)
            .eq("status", "CHECKED_IN");

          if (active) {
            setStats({
              capacity: totalCapacity,
              reserved: reservedCount ?? 0,
              occupied: occupiedCount ?? 0,
            });
          }
        } else if (active) {
          setStats((prev) => ({ ...prev, capacity: totalCapacity }));
        }
      } catch {
        // Safe fallback to defaults
      }
    }
    void loadLiveArea();
    return () => { active = false; };
  }, [area.code, area.estimatedCapacity]);

  const canShowSlotLayout = slotMode === "INDIVIDUAL_SLOT" || area.prototypeSlotGrid;
  const bookingHref = canShowSlotLayout ? `/${locale}/parking/${area.id}/slots` : `/${locale}/app/bookings/new?area=${area.id}`;
  const bookingLabel = canShowSlotLayout ? t.selectSlot : t.reserveArea;

  return (
    <div className="app-frame">
      <div className="mobile-page page-wrap">
        <div className="page-topbar"><Link className="back-button" href={`/${locale}/parking`} aria-label={t.back}><ArrowLeft size={18} /></Link><div><h1>{t.details}</h1><p>{area.code} · {title}</p></div></div>
        <AreaImage areaCode={area.code} title={title} locale={locale} className="detail-image" loading="eager" />
        <main className="detail-content">
          <div className="detail-title-row"><div><h1>{title}<span>{locale === "th" ? area.en : area.th}</span></h1></div><LiveAreaStatus areaCode={area.code} locale={locale} fallback={area.status} /></div>
          <div className="inline-actions" style={{ marginTop: 13 }}>
            <span className="data-badge"><ShieldCheck size={12} /> {t.officialMap}</span>
            <span className="data-badge">{slotMode === "INDIVIDUAL_SLOT" ? t.individualSlot : t.areaOnly}</span>
            <span className="data-badge"><Navigation size={12} /> {locale === "th" ? "พิกัดทางการ มมส." : "Official MSU GPS"}</span>
          </div>
          <div className="stat-grid">
            <div className="stat-card"><strong>{stats.capacity}</strong><span>{locale === "th" ? "ความจุทั้งหมด" : "Total Capacity"}<br />{locale === "th" ? "ช่องจอดมาตรฐาน" : "Standard Spaces"}</span></div>
            <div className="stat-card"><strong>{stats.reserved}</strong><span>{locale === "th" ? "จองแล้ว" : "Active Bookings"}<br />{locale === "th" ? "ช่วงเวลานี้" : "Current Window"}</span></div>
            <div className="stat-card"><strong>{stats.occupied}</strong><span>{locale === "th" ? "กำลังใช้งาน" : "In Use / Occupied"}<br />{locale === "th" ? "จอดอยู่ในพื้นที่" : "Parked Onsite"}</span></div>
          </div>
          <div className="tabs" role="tablist">
            {([["overview", t.overview], ["map", t.map], ["photos", t.photos], ["details", t.detailsTab]] as const).map(([key, label]) => <button className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}>{label}</button>)}
          </div>
          {tab === "map" ? <InteractiveCampusMap locale={locale} areas={parkingAreas} selectedAreaCode={area.code} showAreaPicker={false} /> : null}
          {tab === "photos" ? <div className="detail-photo-card"><AreaImage areaCode={area.code} title={title} locale={locale} className="detail-photo-image" /><div><strong>{locale === "th" ? "ผังลานจอด มมส." : "MSU Car Park"}</strong><p>{locale === "th" ? "ภาพผังลานจอดและช่องจอดมาตรฐานตามประกาศทางการของมหาวิทยาลัยมหาสารคาม" : "Official parking layout map according to Mahasarakham University announcement"}</p><a className="text-link" href={officialSource} target="_blank" rel="noreferrer">{t.officialMap} · {t.realSource} <ExternalLink size={13} /></a></div></div> : null}
          {tab === "overview" ? <>
            <p className="page-subtitle" style={{ marginTop: 18 }}>{detail}</p>
            <ul className="detail-list">
              <li><Building2 size={16} />{t.officialMap} · {locale === "th" ? "มหาวิทยาลัยมหาสารคาม (วิทยาเขตขามเรียง)" : "Mahasarakham University (Khamriang Campus)"}</li>
              <li><Clock3 size={16} />{t.operatingHours}: {area.operatingHours || "06:00 – 22:00 น."}</li>
              <li><ParkingSquare size={16} />{t.vehicleTypes}: {locale === "th" ? "รถเก๋ง, รถจักรยานยนต์, รถกระบะ, EV, รถตู้" : "Car, Motorcycle, Pickup, EV, Van"}</li>
            </ul>
          </> : null}
          {tab === "details" ? (
            <div className="info-card parking-rules-card" style={{ padding: 20, marginTop: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={18} color="#f8c928" />
                {locale === "th" ? "กฎระเบียบและข้อปฏิบัติการจอดรถ มหาวิทยาลัยมหาสารคาม" : "MSU Official Parking Rules & Regulations"}
              </h3>
              <ol className="parking-rules-list" style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                <li>{locale === "th" ? "นิสิต บุคลากร และผู้มาติดต่อต้องจอดรถในช่องจอดที่กำหนด และไม่จอดกีดขวางทางสัญจร" : "Students, staff, and visitors must park within designated spaces and avoid obstructing traffic."}</li>
                <li>{locale === "th" ? "สำหรับช่องจอดที่มีการจองผ่านระบบ ParkSpace MSU ขอสงวนสิทธิ์ให้แก่ผู้ที่ทำการจองล่วงหน้าตามช่วงเวลาที่กำหนด" : "Reserved spaces via ParkSpace MSU are strictly reserved for the registered booking holder during their slot window."}</li>
                <li>{locale === "th" ? "แสดงบัตรอนุญาตหรือ QR Code การจองผ่านระบบเมื่อเจ้าหน้าที่รักษาความปลอดภัยเรียกตรวจสอบ" : "Present valid booking QR Code or parking permit upon security inspection."}</li>
                <li>{locale === "th" ? "ห้ามจอดรถทิ้งค้างคืนโดยไม่ได้รับอนุญาตล่วงหน้าจากกองอาคารสถานที่" : "Overnight parking is prohibited unless prior authorization is granted by Buildings and Grounds Division."}</li>
                <li>{locale === "th" ? "โปรดล็อกยานพาหนะและไม่วางทรัพย์สินมีค่าไว้ในรถ ทางมหาวิทยาลัยไม่รับผิดชอบต่อการสูญหายหรือความเสียหาย" : "Ensure vehicle is locked and valuables are removed; university assumes no liability for theft or loss."}</li>
                <li>{locale === "th" ? "กรณีเกิดเหตุฉุกเฉินหรือข้อขัดข้อง ติดต่อกองอาคารสถานที่ มหาวิทยาลัยมหาสารคาม โทร 043-754321-40 หรือสายด่วน รปภ." : "In case of emergency or assistance, contact MSU Buildings & Grounds Division at 043-754321-40 or campus security."}</li>
              </ol>
            </div>
          ) : null}
          {tab === "overview" ? <CapacitySummary areaCode={area.code} locale={locale} /> : null}
          <div className="sticky-action"><a className="secondary-button" href={getGoogleMapsNavigationUrl(area, verifiedPoint)} target="_blank" rel="noreferrer"><Navigation size={16} />{t.navigate}</a><Link className="primary-button" href={bookingHref}>{bookingLabel}</Link></div>
        </main>
      </div>
      <div className="page-wrap"><PublicFooter locale={locale} /></div>
    </div>
  );
}

